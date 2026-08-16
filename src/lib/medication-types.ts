export const MEDICATIONS_COLLECTION = "medications";
export const NOTIFICATION_JOBS_COLLECTION = "notification_jobs";
export const MEDICATION_LOGS_COLLECTION = "medication_logs";

export type MedicationScheduleRepeat = "daily";

export type MedicationSchedule = {
  time: string;
  repeat: MedicationScheduleRepeat;
};

export type MedicationRecord = {
  medication_id: string;
  user_key: string;
  name: string;
  schedule: MedicationSchedule;
  enabled: boolean;
  qstash_schedule_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type NotificationJobRecord = {
  job_id: string;
  user_key: string;
  medication_id: string;
  scheduled_at: Date;
  sent_at: Date | null;
  delivery_key: string;
  created_at: Date;
  updated_at: Date;
};

export type MedicationLogStatus = "taken" | "skipped" | "missed";

export type MedicationLogRecord = {
  log_id: string;
  user_key: string;
  medication_id: string;
  taken_at: Date;
  status: MedicationLogStatus;
  created_at: Date;
};

export type MedicationInput = {
  name: string;
  schedule: MedicationSchedule;
  enabled?: boolean;
};

export type MedicationUpdateInput = {
  name?: string;
  schedule?: MedicationSchedule;
  enabled?: boolean;
};

export type MedicationResponse = {
  id: string;
  name: string;
  schedule: MedicationSchedule;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidMedicationSchedule(
  schedule: MedicationSchedule | undefined,
): schedule is MedicationSchedule {
  return !!(
    schedule &&
    typeof schedule.time === "string" &&
    TIME_PATTERN.test(schedule.time) &&
    schedule.repeat === "daily"
  );
}

export function isValidMedicationInput(
  input: MedicationInput | undefined,
): input is MedicationInput {
  return !!(
    input &&
    typeof input.name === "string" &&
    input.name.trim().length > 0 &&
    isValidMedicationSchedule(input.schedule)
  );
}

export type MedicationLogResponse = {
  id: string;
  medicationId: string;
  medicationName: string | null;
  takenAt: string;
  status: MedicationLogStatus;
};

export function toMedicationLogResponse(
  record: MedicationLogRecord,
  medicationName: string | null = null,
): MedicationLogResponse {
  return {
    id: record.log_id,
    medicationId: record.medication_id,
    medicationName,
    takenAt: record.taken_at.toISOString(),
    status: record.status,
  };
}

export function toMedicationResponse(
  record: MedicationRecord,
): MedicationResponse {
  return {
    id: record.medication_id,
    name: record.name,
    schedule: record.schedule,
    enabled: record.enabled,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
}
