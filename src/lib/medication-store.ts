import { getMongoDb } from "@/lib/mongodb";
import {
  MEDICATIONS_COLLECTION,
  MEDICATION_LOGS_COLLECTION,
  NOTIFICATION_JOBS_COLLECTION,
  type MedicationInput,
  type MedicationLogRecord,
  type MedicationLogStatus,
  type MedicationRecord,
  type MedicationUpdateInput,
  type NotificationJobRecord,
} from "@/lib/medication-types";
import crypto from "crypto";

export async function createMedication(
  user_key: string,
  input: MedicationInput,
): Promise<MedicationRecord> {
  const db = await getMongoDb();
  const now = new Date();
  const record: MedicationRecord = {
    medication_id: crypto.randomUUID(),
    user_key,
    name: input.name.trim(),
    schedule: input.schedule,
    enabled: input.enabled ?? true,
    qstash_schedule_id: null,
    created_at: now,
    updated_at: now,
  };

  await db.collection(MEDICATIONS_COLLECTION).insertOne(record);
  return record;
}

export async function listMedications(
  user_key: string,
): Promise<MedicationRecord[]> {
  const db = await getMongoDb();
  const docs = await db
    .collection(MEDICATIONS_COLLECTION)
    .find({ user_key })
    .sort({ created_at: -1 })
    .toArray();

  return docs as unknown as MedicationRecord[];
}

export async function getMedication(
  user_key: string,
  medication_id: string,
): Promise<MedicationRecord | null> {
  const db = await getMongoDb();
  const doc = await db.collection(MEDICATIONS_COLLECTION).findOne({
    user_key,
    medication_id,
  });

  return (doc as MedicationRecord | null) ?? null;
}

export async function updateMedication(
  user_key: string,
  medication_id: string,
  input: MedicationUpdateInput,
): Promise<MedicationRecord | null> {
  const db = await getMongoDb();
  const updates: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (input.name !== undefined) {
    updates.name = input.name.trim();
  }

  if (input.schedule !== undefined) {
    updates.schedule = input.schedule;
  }

  if (input.enabled !== undefined) {
    updates.enabled = input.enabled;
  }

  const result = await db.collection(MEDICATIONS_COLLECTION).findOneAndUpdate(
    { user_key, medication_id },
    { $set: updates },
    { returnDocument: "after" },
  );

  return (result as MedicationRecord | null) ?? null;
}

export async function setMedicationQstashScheduleId(
  user_key: string,
  medication_id: string,
  qstash_schedule_id: string | null,
): Promise<MedicationRecord | null> {
  const db = await getMongoDb();
  const result = await db.collection(MEDICATIONS_COLLECTION).findOneAndUpdate(
    { user_key, medication_id },
    {
      $set: {
        qstash_schedule_id,
        updated_at: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  return (result as MedicationRecord | null) ?? null;
}

export async function deleteMedication(
  user_key: string,
  medication_id: string,
): Promise<boolean> {
  const db = await getMongoDb();
  const result = await db.collection(MEDICATIONS_COLLECTION).deleteOne({
    user_key,
    medication_id,
  });

  return result.deletedCount === 1;
}

export async function createNotificationJob(input: {
  user_key: string;
  medication_id: string;
  scheduled_at: Date;
  delivery_key: string;
}): Promise<NotificationJobRecord> {
  const db = await getMongoDb();
  const now = new Date();
  const record: NotificationJobRecord = {
    job_id: crypto.randomUUID(),
    user_key: input.user_key,
    medication_id: input.medication_id,
    scheduled_at: input.scheduled_at,
    sent_at: null,
    delivery_key: input.delivery_key,
    created_at: now,
    updated_at: now,
  };

  await db.collection(NOTIFICATION_JOBS_COLLECTION).insertOne(record);
  return record;
}

export async function findNotificationJobByDeliveryKey(
  delivery_key: string,
): Promise<NotificationJobRecord | null> {
  const db = await getMongoDb();
  const doc = await db.collection(NOTIFICATION_JOBS_COLLECTION).findOne({
    delivery_key,
  });

  return (doc as NotificationJobRecord | null) ?? null;
}

export async function findSentNotificationJobByDeliveryKey(
  delivery_key: string,
): Promise<NotificationJobRecord | null> {
  const job = await findNotificationJobByDeliveryKey(delivery_key);
  if (!job?.sent_at) {
    return null;
  }

  return job;
}

export async function getNotificationJob(
  user_key: string,
  job_id: string,
): Promise<NotificationJobRecord | null> {
  const db = await getMongoDb();
  const doc = await db.collection(NOTIFICATION_JOBS_COLLECTION).findOne({
    user_key,
    job_id,
  });

  return (doc as NotificationJobRecord | null) ?? null;
}

export async function markNotificationJobSent(
  user_key: string,
  job_id: string,
  sent_at: Date = new Date(),
): Promise<NotificationJobRecord | null> {
  const db = await getMongoDb();
  const result = await db
    .collection(NOTIFICATION_JOBS_COLLECTION)
    .findOneAndUpdate(
      { user_key, job_id },
      {
        $set: {
          sent_at,
          updated_at: sent_at,
        },
      },
      { returnDocument: "after" },
    );

  return (result as NotificationJobRecord | null) ?? null;
}

export async function createMedicationLog(input: {
  user_key: string;
  medication_id: string;
  taken_at: Date;
  status: MedicationLogStatus;
}): Promise<MedicationLogRecord> {
  const db = await getMongoDb();
  const record: MedicationLogRecord = {
    log_id: crypto.randomUUID(),
    user_key: input.user_key,
    medication_id: input.medication_id,
    taken_at: input.taken_at,
    status: input.status,
    created_at: new Date(),
  };

  await db.collection(MEDICATION_LOGS_COLLECTION).insertOne(record);
  return record;
}

export async function listMedicationLogs(
  user_key: string,
  medication_id?: string,
): Promise<MedicationLogRecord[]> {
  const db = await getMongoDb();
  const filter: { user_key: string; medication_id?: string } = { user_key };

  if (medication_id) {
    filter.medication_id = medication_id;
  }

  const docs = await db
    .collection(MEDICATION_LOGS_COLLECTION)
    .find(filter)
    .sort({ taken_at: -1 })
    .toArray();

  return docs as unknown as MedicationLogRecord[];
}
