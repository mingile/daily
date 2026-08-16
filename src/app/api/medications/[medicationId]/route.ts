import {
  deleteMedication,
  getMedication,
  updateMedication,
} from "@/lib/medication-store";
import {
  removeMedicationScheduleForRecord,
  shouldSyncMedicationSchedule,
  syncMedicationSchedule,
} from "@/lib/medication-qstash-schedule";
import {
  isValidMedicationSchedule,
  toMedicationResponse,
  type MedicationUpdateInput,
} from "@/lib/medication-types";
import { cookies } from "next/headers";
import crypto from "crypto";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ medicationId: string }>;
};

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

function isValidMedicationUpdate(
  body: MedicationUpdateInput,
): body is MedicationUpdateInput {
  if (body.name !== undefined && body.name.trim().length === 0) {
    return false;
  }

  if (body.schedule !== undefined && !isValidMedicationSchedule(body.schedule)) {
    return false;
  }

  if (
    body.enabled !== undefined &&
    typeof body.enabled !== "boolean"
  ) {
    return false;
  }

  return (
    body.name !== undefined ||
    body.schedule !== undefined ||
    body.enabled !== undefined
  );
}

export async function GET(_req: Request, context: RouteContext) {
  const { medicationId } = await context.params;

  try {
    const user_key = await resolveUserKey();
    const medication = await getMedication(user_key, medicationId);

    if (!medication) {
      return NextResponse.json({ error: "Medication not found" }, { status: 404 });
    }

    return NextResponse.json({
      medication: toMedicationResponse(medication),
    });
  } catch (error) {
    console.error("Medication fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch medication" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const { medicationId } = await context.params;
  let body: MedicationUpdateInput;

  try {
    body = (await req.json()) as MedicationUpdateInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidMedicationUpdate(body)) {
    return NextResponse.json(
      { error: "Invalid medication update payload" },
      { status: 400 },
    );
  }

  try {
    const user_key = await resolveUserKey();
    const existing = await getMedication(user_key, medicationId);

    if (!existing) {
      return NextResponse.json({ error: "Medication not found" }, { status: 404 });
    }

    const updated = await updateMedication(user_key, medicationId, body);

    if (!updated) {
      return NextResponse.json({ error: "Medication not found" }, { status: 404 });
    }

    const medication = shouldSyncMedicationSchedule(body)
      ? await syncMedicationSchedule(updated)
      : updated;

    return NextResponse.json({
      medication: toMedicationResponse(medication),
    });
  } catch (error) {
    console.error("Medication update failed:", error);
    return NextResponse.json(
      { error: "Failed to update medication" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { medicationId } = await context.params;

  try {
    const user_key = await resolveUserKey();
    const existing = await getMedication(user_key, medicationId);

    if (!existing) {
      return NextResponse.json({ error: "Medication not found" }, { status: 404 });
    }

    await removeMedicationScheduleForRecord(existing);
    const deleted = await deleteMedication(user_key, medicationId);

    if (!deleted) {
      return NextResponse.json({ error: "Medication not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Medication delete failed:", error);
    return NextResponse.json(
      { error: "Failed to delete medication" },
      { status: 500 },
    );
  }
}
