import {
  createNotificationJob,
  findNotificationJobByDeliveryKey,
  getMedication,
  markNotificationJobSent,
} from "@/lib/medication-store";
import {
  buildNotificationDeliveryKey,
  sendPushToUser,
} from "@/lib/web-push-send";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";

type NotificationSendBody = {
  medicationId?: string;
  userKey?: string;
};

function getNotificationSendUrl(): string {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/api/notifications/send`;
}

async function handler(request: Request): Promise<Response> {
  let body: NotificationSendBody;

  try {
    body = (await request.json()) as NotificationSendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { medicationId, userKey } = body;

  if (!medicationId || !userKey) {
    return NextResponse.json(
      { error: "Missing medicationId or userKey" },
      { status: 400 },
    );
  }

  const medication = await getMedication(userKey, medicationId);

  if (!medication || !medication.enabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "medication_not_active",
    });
  }

  const scheduledAt = new Date();
  const deliveryKey = buildNotificationDeliveryKey(medicationId, scheduledAt);
  const existingJob = await findNotificationJobByDeliveryKey(deliveryKey);

  if (existingJob?.sent_at) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      jobId: existingJob.job_id,
    });
  }

  const job =
    existingJob ??
    (await createNotificationJob({
      user_key: userKey,
      medication_id: medicationId,
      scheduled_at: scheduledAt,
      delivery_key: deliveryKey,
    }));

  const pushResult = await sendPushToUser(userKey, {
    title: "복약 알림",
    body: `${medication.name} 복용 시간입니다.`,
    url: `/?medicationId=${encodeURIComponent(medicationId)}`,
  });

  if (pushResult.sent === 0) {
    return NextResponse.json(
      {
        error: "No active push subscriptions",
        jobId: job.job_id,
      },
      { status: 503 },
    );
  }

  const sentJob = await markNotificationJobSent(userKey, job.job_id);

  return NextResponse.json({
    ok: true,
    jobId: sentJob?.job_id ?? job.job_id,
    push: pushResult,
  });
}

export const POST = verifySignatureAppRouter(handler, {
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  url: getNotificationSendUrl(),
});
