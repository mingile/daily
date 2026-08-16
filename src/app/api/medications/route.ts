import {
  createMedication,
  deleteMedication,
  listMedications,
} from "@/lib/medication-store";
import { syncMedicationSchedule } from "@/lib/medication-qstash-schedule";
import {
  isValidMedicationInput,
  toMedicationResponse,
  type MedicationInput,
} from "@/lib/medication-types";
import { cookies } from "next/headers";
import crypto from "crypto";
import { NextResponse } from "next/server";

async function resolveUserKey() {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };

  let user_key = cookieStore.get("user_key")?.value;
  if (!user_key) {
    user_key = crypto.randomUUID();
    cookieStore.set("user_key", user_key, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return user_key;
}

export async function GET() {
  try {
    const user_key = await resolveUserKey();
    const medications = await listMedications(user_key);

    return NextResponse.json({
      medications: medications.map(toMedicationResponse),
    });
  } catch (error) {
    console.error("Medication list failed:", error);
    return NextResponse.json(
      { error: "Failed to list medications" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: MedicationInput;

  try {
    body = (await req.json()) as MedicationInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidMedicationInput(body)) {
    return NextResponse.json(
      {
        error:
          "Invalid medication payload. name, schedule.time (HH:mm), schedule.repeat ('daily'), and optional schedule.mealSlot ('breakfast' | 'lunch' | 'dinner') are required.",
      },
      { status: 400 },
    );
  }

  try {
    const user_key = await resolveUserKey();
    const created = await createMedication(user_key, body);
    const medication = await syncMedicationSchedule(created);

    return NextResponse.json(
      { medication: toMedicationResponse(medication) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Medication create failed:", error);
    return NextResponse.json(
      { error: "Failed to create medication" },
      { status: 500 },
    );
  }
}
