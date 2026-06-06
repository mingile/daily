import { getMongoDb } from "@/lib/mongodb";
import {
  getTodayDateString,
  queryNotionDailyLog,
} from "@/lib/notion-daily-log-helpers";
import { NextResponse } from "next/server";

export type ConnectionStatus =
  | "connected"
  | "not_connected"
  | "db_not_connected"
  | "not_found"
  | "error";

export type DailyStatusResponse = {
  status: ConnectionStatus;
  date: string;
  breakfastDone: boolean;
  lunchDone: boolean;
  dinnerDone: boolean;
  breakfastMedicationDone: boolean;
  lunchMedicationDone: boolean;
  dinnerMedicationDone: boolean;
  workoutDone: boolean;
};

function createResponse(
  status: ConnectionStatus,
  date: string,
  overrides?: Partial<Omit<DailyStatusResponse, "status" | "date">>,
): DailyStatusResponse {
  return {
    status,
    date,
    breakfastDone: false,
    lunchDone: false,
    dinnerDone: false,
    breakfastMedicationDone: false,
    lunchMedicationDone: false,
    dinnerMedicationDone: false,
    workoutDone: false,
    ...overrides,
  };
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const date = searchParams.get("date") || getTodayDateString();

  const authHeader = req.headers.get("Authorization");
  const widgetToken = extractBearerToken(authHeader);

  if (!widgetToken) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 },
    );
  }

  try {
    const db = await getMongoDb();
    const collection = db.collection("connections_info");
    const connectionDoc = await collection.findOne({ widget_token: widgetToken });

    if (!connectionDoc) {
      return NextResponse.json(
        { error: "Invalid widget token" },
        { status: 401 },
      );
    }

    if (!connectionDoc.access_token) {
      return NextResponse.json(createResponse("not_connected", date));
    }

    if (!connectionDoc.daily_health_db_id) {
      return NextResponse.json(createResponse("db_not_connected", date));
    }

    const { found, log } = await queryNotionDailyLog(
      connectionDoc.access_token,
      connectionDoc.daily_health_db_id,
      date,
    );

    if (!found) {
      return NextResponse.json(createResponse("not_found", date));
    }

    return NextResponse.json(
      createResponse("connected", date, {
        breakfastDone: log.breakfast.trim().length > 0,
        lunchDone: log.lunch.trim().length > 0,
        dinnerDone: log.dinner.trim().length > 0,
        breakfastMedicationDone: log.breakfastMedications.length > 0,
        lunchMedicationDone: log.lunchMedications.length > 0,
        dinnerMedicationDone: log.dinnerMedications.length > 0,
        workoutDone: log.workout,
      }),
    );
  } catch (error) {
    console.error("Failed to fetch daily status for widget", error);
    return NextResponse.json(createResponse("error", date));
  }
}
