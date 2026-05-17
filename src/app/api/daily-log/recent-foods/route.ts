import { getMongoDb } from "@/lib/mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type NotionRichText = {
  plain_text?: string;
};

type NotionRichTextProperty = {
  type: string;
  rich_text?: NotionRichText[];
};

type NotionPageProperties = {
  [key: string]: NotionRichTextProperty;
};

type NotionPage = {
  properties?: NotionPageProperties;
};

type FoodItem = {
  name: string;
  amount: number;
  unit: string;
};

// Helper: rich_text 속성을 plain text로 변환
function extractRichText(property: NotionRichTextProperty): string {
  if (!property || property.type !== "rich_text") return "";
  const richTextArray = property.rich_text || [];
  return richTextArray.map((rt) => rt.plain_text || "").join("");
}

// Helper: 음식 문자열 파싱
function parseFoodLine(line: string): FoodItem | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 마지막의 양의 정수 + 단위(g|개)
  const pattern = /^(.+)\s+([1-9]\d*)(g|개)$/;
  const match = trimmed.match(pattern);

  if (!match) return null;

  return {
    name: match[1].trim(),
    amount: parseInt(match[2], 10),
    unit: match[3],
  };
}

// 최근 음식 후보 조회
export async function GET() {
  try {
    const cookieStore = await cookies();
    const user_key = cookieStore.get("user_key")?.value;

    if (!user_key) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getMongoDb();
    const collection = db.collection("connections_info");
    const connectionDoc = await collection.findOne({ user_key });
    const accessToken = connectionDoc?.access_token;
    const dailyHealthDbId = connectionDoc?.daily_health_db_id;

    if (!accessToken || !dailyHealthDbId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Notion Database Query API 호출 (최근 30개, 날짜 descending)
    const notionResponse = await fetch(
      `https://api.notion.com/v1/databases/${dailyHealthDbId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sorts: [
            {
              property: "날짜",
              direction: "descending",
            },
          ],
          page_size: 30,
        }),
      },
    );

    if (!notionResponse.ok) {
      const errorData = await notionResponse.text();
      console.error("Notion API error:", notionResponse.status, errorData);
      return NextResponse.json(
        { error: "Failed to query Notion database" },
        { status: 500 },
      );
    }

    const notionData = await notionResponse.json();
    const results: NotionPage[] = notionData.results || [];

    // 음식 추출 및 중복 제거 (Map 사용, 최근 기록 유지)
    const foodsMap = new Map<string, FoodItem>();

    for (const page of results) {
      const properties = page.properties || {};

      // 아침, 점심, 저녁 추출
      const breakfast = extractRichText(
        properties["아침"] as NotionRichTextProperty,
      );
      const lunch = extractRichText(properties["점심"] as NotionRichTextProperty);
      const dinner = extractRichText(properties["저녁"] as NotionRichTextProperty);

      // 모든 식사를 하나의 배열로 합침
      const allMeals = [breakfast, lunch, dinner];

      for (const meal of allMeals) {
        if (!meal) continue;

        // 줄바꿈으로 분리
        const lines = meal.split("\n");

        for (const line of lines) {
          const foodItem = parseFoodLine(line);
          if (foodItem && !foodsMap.has(foodItem.name)) {
            // 같은 name이 없을 때만 추가 (최근 기록 유지)
            foodsMap.set(foodItem.name, foodItem);
          }
        }
      }
    }

    // Map을 배열로 변환
    const foods = Array.from(foodsMap.values());

    return NextResponse.json({ foods });
  } catch (error) {
    console.error("Failed to fetch recent foods", error);
    return NextResponse.json(
      { error: "Failed to fetch recent foods" },
      { status: 500 },
    );
  }
}
