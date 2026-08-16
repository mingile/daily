import {
  createMedicationLog,
  getMedication,
  listMedicationLogs,
  listMedications,
} from "@/lib/medication-store";
import {
  toMedicationLogResponse,
  type MedicationLogStatus,
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

const VALID_STATUSES: MedicationLogStatus[] = ["taken", "skipped", "missed"];

export async function GET(req: Request) {
  try {
    const user_key = await resolveUserKey();
    const medicationId = new URL(req.url).searchParams.get("medicationId");
    const logs = await listMedicationLogs(
      user_key,
      medicationId ?? undefined,
    );
    const medications = await listMedications(user_key);
    const nameById = new Map(
      medications.map((medication) => [medication.medication_id, medication.name]),
    );

    return NextResponse.json({
      logs: logs.map((log) =>
        toMedicationLogResponse(log, nameById.get(log.medication_id) ?? null),
      ),
    });
  } catch (error) {
    console.error("Medication log list failed:", error);
    return NextResponse.json(
      { error: "Failed to list medication logs" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: { medicationId?: string; status?: MedicationLogStatus };

  try {
    body = (await req.json()) as { medicationId?: string; status?: MedicationLogStatus };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { medicationId, status = "taken" } = body;

  if (!medicationId) {
    return NextResponse.json({ error: "Missing medicationId" }, { status: 400 });
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const user_key = await resolveUserKey();
    const medication = await getMedication(user_key, medicationId);

    if (!medication) {
      return NextResponse.json({ error: "Medication not found" }, { status: 404 });
    }

    const log = await createMedicationLog({
      user_key,
      medication_id: medicationId,
      taken_at: new Date(),
      status,
    });

    return NextResponse.json(
      {
        log: toMedicationLogResponse(log, medication.name),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Medication log create failed:", error);
    return NextResponse.json(
      { error: "Failed to create medication log" },
      { status: 500 },
    );
  }
}
