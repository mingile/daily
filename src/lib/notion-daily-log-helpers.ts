export type NotionRichText = {
  plain_text?: string;
};

export type NotionRichTextProperty = {
  type: string;
  rich_text?: NotionRichText[];
};

export type NotionMultiSelectItem = {
  name?: string;
};

export type NotionMultiSelectProperty = {
  type: string;
  multi_select?: NotionMultiSelectItem[];
};

export type NotionCheckboxProperty = {
  type: string;
  checkbox?: boolean;
};

export type NotionPageProperties = {
  [key: string]:
    | NotionRichTextProperty
    | NotionMultiSelectProperty
    | NotionCheckboxProperty;
};

export type NotionPage = {
  properties?: NotionPageProperties;
};

export type DailyLog = {
  breakfast: string;
  lunch: string;
  dinner: string;
  breakfastMedications: string[];
  lunchMedications: string[];
  dinnerMedications: string[];
  workout: boolean;
  memo: string;
};

export function extractRichText(property: NotionRichTextProperty): string {
  if (!property || property.type !== "rich_text") return "";
  const richTextArray = property.rich_text || [];
  return richTextArray.map((rt) => rt.plain_text || "").join("");
}

export function extractMultiSelect(property: NotionMultiSelectProperty): string[] {
  if (!property || property.type !== "multi_select") return [];
  const multiSelectArray = property.multi_select || [];
  return multiSelectArray.map((item) => item.name || "");
}

export function extractCheckbox(property: NotionCheckboxProperty): boolean {
  if (!property || property.type !== "checkbox") return false;
  return property.checkbox === true;
}

export function convertPageToLog(page: NotionPage): DailyLog {
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

export async function queryNotionDailyLog(
  accessToken: string,
  dailyHealthDbId: string,
  date: string,
): Promise<{ found: boolean; log: DailyLog }> {
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
    throw new Error("Failed to query Notion database");
  }

  const notionData = await notionResponse.json();
  const results = notionData.results || [];

  if (results.length > 0) {
    const page = results[0];
    return {
      found: true,
      log: convertPageToLog(page),
    };
  }

  return {
    found: false,
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
  };
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
