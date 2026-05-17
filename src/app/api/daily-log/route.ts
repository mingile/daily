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

type NotionMultiSelectItem = {
  name?: string;
};

type NotionMultiSelectProperty = {
  type: string;
  multi_select?: NotionMultiSelectItem[];
};

type NotionCheckboxProperty = {
  type: string;
  checkbox?: boolean;
};

type NotionPageProperties = {
  [key: string]:
    | NotionRichTextProperty
    | NotionMultiSelectProperty
    | NotionCheckboxProperty;
};

type NotionPage = {
  properties?: NotionPageProperties;
};

// Helper: rich_text 속성을 plain text로 변환
function extractRichText(property: NotionRichTextProperty): string {
  if (!property || property.type !== "rich_text") return "";
  const richTextArray = property.rich_text || [];
  return richTextArray.map((rt) => rt.plain_text || "").join("");
}

// Helper: multi_select 속성을 name 배열로 변환
function extractMultiSelect(property: NotionMultiSelectProperty): string[] {
  if (!property || property.type !== "multi_select") return [];
  const multiSelectArray = property.multi_select || [];
  return multiSelectArray.map((item) => item.name || "");
}

// Helper: checkbox 속성을 boolean으로 변환
function extractCheckbox(property: NotionCheckboxProperty): boolean {
  if (!property || property.type !== "checkbox") return false;
  return property.checkbox === true;
}

// Helper: Notion page properties를 log 객체로 변환
function convertPageToLog(page: NotionPage) {
  const properties = page.properties || {};

  return {
    breakfast: extractRichText(properties["아침"] as NotionRichTextProperty),
    lunch: extractRichText(properties["점심"] as NotionRichTextProperty),
    dinner: extractRichText(properties["저녁"] as NotionRichTextProperty),
    breakfastMedications: extractMultiSelect(
      properties["아침약"] as NotionMultiSelectProperty,
    ),
    lunchMedications: extractMultiSelect(
      properties["점심약"] as NotionMultiSelectProperty,
    ),
    dinnerMedications: extractMultiSelect(
      properties["저녁약"] as NotionMultiSelectProperty,
    ),
    workout: extractCheckbox(properties["운동"] as NotionCheckboxProperty),
    memo: extractRichText(properties["메모"] as NotionRichTextProperty),
  };
}

// Helper: 날짜를 "5월 17일 식단" 형식으로 변환
function formatDateTitle(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일 식단`;
}

// Helper: 식단 문자열 포맷 검증
function validateMealFormat(meal: string): boolean {
  if (meal === "") return true; // 빈 문자열 허용

  const lines = meal.split("\n");
  // 최소 1글자 + 공백 + 양의 정수 + 단위(g|개)
  const pattern = /^.+\s+([1-9]\d*)(g|개)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue; // 공백 줄 무시

    if (!pattern.test(trimmed)) {
      return false;
    }
  }

  return true;
}

// Helper: log 객체를 Notion properties로 변환
function convertLogToProperties(
  date: string,
  log: {
    breakfast: string;
    lunch: string;
    dinner: string;
    breakfastMedications: string[];
    lunchMedications: string[];
    dinnerMedications: string[];
    workout: boolean;
    memo: string;
  },
) {
  return {
    기록: {
      title: [{ text: { content: formatDateTitle(date) } }],
    },
    날짜: {
      date: { start: date },
    },
    아침: {
      rich_text: log.breakfast ? [{ text: { content: log.breakfast } }] : [],
    },
    점심: {
      rich_text: log.lunch ? [{ text: { content: log.lunch } }] : [],
    },
    저녁: {
      rich_text: log.dinner ? [{ text: { content: log.dinner } }] : [],
    },
    아침약: {
      multi_select: log.breakfastMedications.map((name) => ({ name })),
    },
    점심약: {
      multi_select: log.lunchMedications.map((name) => ({ name })),
    },
    저녁약: {
      multi_select: log.dinnerMedications.map((name) => ({ name })),
    },
    운동: {
      checkbox: log.workout,
    },
    메모: {
      rich_text: log.memo ? [{ text: { content: log.memo } }] : [],
    },
  };
}

// 선택 날짜 기록 조회
export async function GET(req: Request) {
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

    const searchParams = new URL(req.url).searchParams;
    const date = searchParams.get("date");
    if (!date) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    // Notion Database Query API 호출
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
          filter: {
            property: "날짜",
            date: {
              equals: date,
            },
          },
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
    const results = notionData.results || [];

    if (results.length > 0) {
      const page = results[0];
      return NextResponse.json({
        date,
        found: true,
        pageId: page.id,
        log: convertPageToLog(page),
      });
    } else {
      return NextResponse.json({
        date,
        found: false,
        pageId: null,
        log: {
          breakfast: "",
          lunch: "",
          dinner: "",
          breakfastMedications: [],
          lunchMedications: [],
          dinnerMedications: [],
          workout: false,
          memo: "",
        },
      });
    }
  } catch (error) {
    console.error("Failed to fetch daily log", error);
    return NextResponse.json(
      { error: "Failed to fetch daily log" },
      { status: 500 },
    );
  }
}

// 선택 날짜 기록 저장
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, log } = body;

    if (!date) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    // 식단 포맷 검증
    if (!validateMealFormat(log?.breakfast || "")) {
      return NextResponse.json(
        { error: "Invalid meal format", field: "breakfast" },
        { status: 400 },
      );
    }

    if (!validateMealFormat(log?.lunch || "")) {
      return NextResponse.json(
        { error: "Invalid meal format", field: "lunch" },
        { status: 400 },
      );
    }

    if (!validateMealFormat(log?.dinner || "")) {
      return NextResponse.json(
        { error: "Invalid meal format", field: "dinner" },
        { status: 400 },
      );
    }

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

    // 해당 날짜의 page가 이미 있는지 조회
    const queryResponse = await fetch(
      `https://api.notion.com/v1/databases/${dailyHealthDbId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            property: "날짜",
            date: {
              equals: date,
            },
          },
        }),
      },
    );

    if (!queryResponse.ok) {
      const errorData = await queryResponse.text();
      console.error("Notion query error:", queryResponse.status, errorData);
      return NextResponse.json(
        { error: "Failed to query Notion database" },
        { status: 500 },
      );
    }

    const queryData = await queryResponse.json();
    const results = queryData.results || [];
    const properties = convertLogToProperties(date, log);

    let mode: "created" | "updated";
    let pageId: string;

    if (results.length > 0) {
      // 기존 page 업데이트
      const existingPage = results[0];
      pageId = existingPage.id;
      mode = "updated";

      const updateResponse = await fetch(
        `https://api.notion.com/v1/pages/${pageId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ properties }),
        },
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.text();
        console.error("Notion update error:", updateResponse.status, errorData);
        return NextResponse.json(
          { error: "Failed to update Notion page" },
          { status: 500 },
        );
      }
    } else {
      // 새 page 생성
      mode = "created";

      const createResponse = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: dailyHealthDbId },
          properties,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.text();
        console.error("Notion create error:", createResponse.status, errorData);
        return NextResponse.json(
          { error: "Failed to create Notion page" },
          { status: 500 },
        );
      }

      const createData = await createResponse.json();
      pageId = createData.id;
    }

    return NextResponse.json({
      ok: true,
      mode,
      pageId,
    });
  } catch (error) {
    console.error("Failed to save daily log", error);
    return NextResponse.json(
      { error: "Failed to save daily log" },
      { status: 500 },
    );
  }
}
