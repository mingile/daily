import { getQstashClient } from "@/lib/qstash-client";
import {
  getMedication,
  setMedicationQstashScheduleId,
} from "@/lib/medication-store";
import type {
  MedicationRecord,
  MedicationSchedule,
} from "@/lib/medication-types";

export const MEDICATION_SCHEDULE_TIMEZONE = "Asia/Seoul";

export function buildMedicationScheduleId(medication_id: string): string {
  return `med-${medication_id}`;
}

export function toDailyKstCron(schedule: MedicationSchedule): string {
  const [hour, minute] = schedule.time.split(":");
  return `CRON_TZ=${MEDICATION_SCHEDULE_TIMEZONE} ${minute} ${hour} * * *`;
}

export function getNotificationSendDestination(): string {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/api/notifications/send`;
}

function buildScheduleBody(medication: MedicationRecord): string {
  return JSON.stringify({
    medicationId: medication.medication_id,
    userKey: medication.user_key,
  });
}

export async function createMedicationSchedule(
  medication: MedicationRecord,
): Promise<string> {
  const client = getQstashClient();
  const scheduleId = buildMedicationScheduleId(medication.medication_id);

  const result = await client.schedules.create({
    destination: getNotificationSendDestination(),
    cron: toDailyKstCron(medication.schedule),
    scheduleId,
    body: buildScheduleBody(medication),
    headers: {
      "Content-Type": "application/json",
    },
  });

  return result.scheduleId;
}

export async function deleteMedicationSchedule(
  scheduleId: string,
): Promise<void> {
  const client = getQstashClient();

  try {
    await client.schedules.delete(scheduleId);
  } catch (error) {
    console.warn("Failed to delete QStash schedule:", scheduleId, error);
  }
}

export async function syncMedicationSchedule(
  medication: MedicationRecord,
): Promise<MedicationRecord> {
  const scheduleId = buildMedicationScheduleId(medication.medication_id);

  if (!medication.enabled) {
    if (medication.qstash_schedule_id) {
      await deleteMedicationSchedule(medication.qstash_schedule_id);
    }

    const updated = await setMedicationQstashScheduleId(
      medication.user_key,
      medication.medication_id,
      null,
    );

    return updated ?? medication;
  }

  const createdScheduleId = await createMedicationSchedule(medication);
  const updated = await setMedicationQstashScheduleId(
    medication.user_key,
    medication.medication_id,
    createdScheduleId,
  );

  if (!updated) {
    throw new Error("Failed to persist QStash schedule id");
  }

  return updated;
}

export async function removeMedicationScheduleForRecord(
  medication: MedicationRecord,
): Promise<void> {
  const scheduleId =
    medication.qstash_schedule_id ??
    buildMedicationScheduleId(medication.medication_id);

  await deleteMedicationSchedule(scheduleId);
  await setMedicationQstashScheduleId(
    medication.user_key,
    medication.medication_id,
    null,
  );
}

export async function reloadMedicationWithSchedule(
  user_key: string,
  medication_id: string,
): Promise<MedicationRecord | null> {
  const medication = await getMedication(user_key, medication_id);
  if (!medication) {
    return null;
  }

  return syncMedicationSchedule(medication);
}

export function shouldSyncMedicationSchedule(patch: {
  schedule?: MedicationSchedule;
  enabled?: boolean;
}): boolean {
  return patch.schedule !== undefined || patch.enabled !== undefined;
}
