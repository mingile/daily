import { getMongoDb } from "@/lib/mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type NotionMultiSelectItem = {
  name?: string;
};

type NotionMultiSelectProperty = {
  type: string;
  multi_select?: NotionMultiSelectItem[];
};

type NotionPageProperties = {
  [key: string]: NotionMultiSelectProperty;
};

type NotionPage = {
  properties?: NotionPageProperties;
};

// Helper: multi_select 속성을 name 배열로 변환
function extractMultiSelect(property: NotionMultiSelectProperty): string[] {
  if (!property || property.type !== "multi_select") return [];
  const multiSelectArray = property.multi_select || [];
  return multiSelectArray.map((item) => item.name || "").filter(Boolean);
}

// 최근 복용 약 목록 조회
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

    // 약 추출 및 중복 제거 (순서 유지, 최대 8개)
    const medicationsSet = new Set<string>();
    const medications: string[] = [];

    for (const page of results) {
      if (medications.length >= 8) break;

      const properties = page.properties || {};

      // 아침약, 점심약, 저녁약 추출
      const breakfastMeds = extractMultiSelect(
        properties["아침약"] as NotionMultiSelectProperty,
      );
      const lunchMeds = extractMultiSelect(
        properties["점심약"] as NotionMultiSelectProperty,
      );
      const dinnerMeds = extractMultiSelect(
        properties["저녁약"] as NotionMultiSelectProperty,
      );

      // 모든 약을 하나의 배열로 합침
      const allMeds = [...breakfastMeds, ...lunchMeds, ...dinnerMeds];

      for (const med of allMeds) {
        if (med && !medicationsSet.has(med)) {
          medicationsSet.add(med);
          medications.push(med);

          if (medications.length >= 8) break;
        }
      }
    }

    return NextResponse.json({ medications });
  } catch (error) {
    console.error("Failed to fetch recent medications", error);
    return NextResponse.json(
      { error: "Failed to fetch recent medications" },
      { status: 500 },
    );
  }
}
