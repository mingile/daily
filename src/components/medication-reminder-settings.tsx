"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import type {
  MedicationLogResponse,
  MedicationResponse,
} from "@/lib/medication-types";
import {
  getPushSubscriptionStatus,
  subscribeToPushNotifications,
} from "@/lib/web-push-subscription";

const LOG_STATUS_LABEL: Record<MedicationLogResponse["status"], string> = {
  taken: "복용 완료",
  skipped: "건너뜀",
  missed: "미복용",
};

function formatLogTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MedicationReminderSettings() {
  return (
    <Suspense
      fallback={
        <Card className="bg-white border-stone-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-stone-800 text-lg">복약 알림</CardTitle>
            <p className="text-sm text-stone-600">
              매일 정해진 시간에 Push 알림을 받을 수 있습니다.
            </p>
          </CardHeader>
        </Card>
      }
    >
      <MedicationReminderSettingsContent />
    </Suspense>
  );
}

function MedicationReminderSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingMedicationId = searchParams.get("medicationId");

  const [medications, setMedications] = useState<MedicationResponse[]>([]);
  const [logs, setLogs] = useState<MedicationLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [time, setTime] = useState("09:00");
  const [isOpen, setIsOpen] = useState(!!pendingMedicationId);

  const pendingMedication = pendingMedicationId
    ? medications.find((medication) => medication.id === pendingMedicationId)
    : null;

  const fetchMedications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/medications", {
        credentials: "include",
      });
      const data = (await response.json()) as {
        medications?: MedicationResponse[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "복약 일정을 불러오지 못했습니다.");
      }

      setMedications(data.medications ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "복약 일정을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);

    try {
      const response = await fetch("/api/medications/logs", {
        credentials: "include",
      });
      const data = (await response.json()) as {
        logs?: MedicationLogResponse[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "복용 기록을 불러오지 못했습니다.");
      }

      setLogs(data.logs ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "복용 기록을 불러오지 못했습니다.",
      );
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const fetchPushStatus = useCallback(async () => {
    try {
      const status = await getPushSubscriptionStatus();
      setPushSubscribed(status.subscribed);
    } catch {
      setPushSubscribed(false);
    }
  }, []);

  useEffect(() => {
    void fetchMedications();
    void fetchLogs();
    void fetchPushStatus();
  }, [fetchMedications, fetchLogs, fetchPushStatus]);

  const clearPendingMedicationParam = useCallback(() => {
    if (!pendingMedicationId) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("medicationId");
    const next = params.toString();
    router.replace(next ? `/?${next}` : "/");
  }, [pendingMedicationId, router, searchParams]);

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
  };

  const handleLogMedication = async (
    medicationId: string,
    status: MedicationLogResponse["status"],
  ) => {
    setLogLoading(true);
    setError("");

    try {
      const response = await fetch("/api/medications/logs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicationId, status }),
      });
      const data = (await response.json()) as {
        log?: MedicationLogResponse;
        error?: string;
      };

      if (!response.ok || !data.log) {
        throw new Error(data.error ?? "복용 기록 저장에 실패했습니다.");
      }

      setLogs((prev) => [data.log!, ...prev]);
      clearPendingMedicationParam();
      showMessage(
        status === "taken" ? "복용 완료로 기록했습니다." : "기록을 저장했습니다.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "복용 기록 저장에 실패했습니다.",
      );
    } finally {
      setLogLoading(false);
    }
  };

  const handleSubscribePush = async () => {
    setPushLoading(true);
    setError("");

    try {
      await subscribeToPushNotifications();
      setPushSubscribed(true);
      showMessage("알림 구독이 완료되었습니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알림 구독에 실패했습니다.",
      );
    } finally {
      setPushLoading(false);
    }
  };

  const handleAddMedication = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("약 이름을 입력해 주세요.");
      return;
    }

    setFormLoading(true);
    setError("");

    try {
      const response = await fetch("/api/medications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          schedule: { time, repeat: "daily" },
          enabled: true,
        }),
      });
      const data = (await response.json()) as {
        medication?: MedicationResponse;
        error?: string;
      };

      if (!response.ok || !data.medication) {
        throw new Error(data.error ?? "복약 일정 등록에 실패했습니다.");
      }

      setMedications((prev) => [data.medication!, ...prev]);
      setName("");
      showMessage("복약 알림이 등록되었습니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "복약 일정 등록에 실패했습니다.",
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleEnabled = async (medication: MedicationResponse) => {
    setActionId(medication.id);
    setError("");

    try {
      const response = await fetch(`/api/medications/${medication.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !medication.enabled }),
      });
      const data = (await response.json()) as {
        medication?: MedicationResponse;
        error?: string;
      };

      if (!response.ok || !data.medication) {
        throw new Error(data.error ?? "알림 설정 변경에 실패했습니다.");
      }

      setMedications((prev) =>
        prev.map((item) =>
          item.id === medication.id ? data.medication! : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알림 설정 변경에 실패했습니다.",
      );
    } finally {
      setActionId(null);
    }
  };

  const handleTimeChange = async (
    medication: MedicationResponse,
    nextTime: string,
  ) => {
    if (nextTime === medication.schedule.time) {
      return;
    }

    setActionId(medication.id);
    setError("");

    try {
      const response = await fetch(`/api/medications/${medication.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule: { time: nextTime, repeat: "daily" },
        }),
      });
      const data = (await response.json()) as {
        medication?: MedicationResponse;
        error?: string;
      };

      if (!response.ok || !data.medication) {
        throw new Error(data.error ?? "복용 시간 변경에 실패했습니다.");
      }

      setMedications((prev) =>
        prev.map((item) =>
          item.id === medication.id ? data.medication! : item,
        ),
      );
      showMessage("복용 시간이 변경되었습니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "복용 시간 변경에 실패했습니다.",
      );
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (medicationId: string) => {
    setActionId(medicationId);
    setError("");

    try {
      const response = await fetch(`/api/medications/${medicationId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "복약 일정 삭제에 실패했습니다.");
      }

      setMedications((prev) => prev.filter((item) => item.id !== medicationId));
      showMessage("복약 알림이 삭제되었습니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "복약 일정 삭제에 실패했습니다.",
      );
    } finally {
      setActionId(null);
    }
  };

  return (
    <Card className="bg-white border-stone-200 shadow-sm">
      <CardHeader className="pb-4">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={isOpen}
        >
          <div className="space-y-1">
            <CardTitle className="text-stone-800 text-lg">복약 알림</CardTitle>
            <p className="text-sm text-stone-600">
              매일 정해진 시간에 Push 알림을 받을 수 있습니다.
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-stone-500 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </CardHeader>
      {isOpen && (
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-stone-800">Push 알림</p>
            <p className="text-xs text-stone-500">
              {pushSubscribed
                ? "이 기기에서 알림을 받을 준비가 되었습니다."
                : "알림을 받으려면 먼저 구독해 주세요."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={pushSubscribed ? "default" : "secondary"}
              className={
                pushSubscribed
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-stone-200 text-stone-600"
              }
            >
              {pushSubscribed ? "구독됨" : "미구독"}
            </Badge>
            {!pushSubscribed && (
              <Button
                size="sm"
                onClick={() => {
                  void handleSubscribePush();
                }}
                disabled={pushLoading}
                className="h-8 bg-stone-700 hover:bg-stone-800 text-white"
              >
                {pushLoading ? "구독 중..." : "알림 허용"}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            {message}
          </div>
        )}

        {pendingMedicationId && !loading && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            {pendingMedication ? (
              <>
                <p className="text-sm font-medium text-stone-800">
                  {pendingMedication.name} 복용하셨나요?
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void handleLogMedication(pendingMedication.id, "taken");
                    }}
                    disabled={logLoading}
                    className="h-8 bg-green-700 hover:bg-green-800 text-white"
                  >
                    {logLoading ? "저장 중..." : "복용 완료"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void handleLogMedication(pendingMedication.id, "skipped");
                    }}
                    disabled={logLoading}
                    className="h-8 border-stone-300 text-stone-600"
                  >
                    건너뛰기
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearPendingMedicationParam}
                    disabled={logLoading}
                    className="h-8 text-stone-500"
                  >
                    나중에
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-stone-600">
                알림에 해당하는 복약 일정을 찾을 수 없습니다.
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-stone-200 p-4">
          <p className="text-sm font-medium text-stone-800">새 복약 알림</p>
          <div className="space-y-2">
            <Label htmlFor="medication-name" className="text-stone-700 text-sm">
              약 이름
            </Label>
            <Input
              id="medication-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 비타민D"
              className="h-10 border-stone-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medication-time" className="text-stone-700 text-sm">
              복용 시간 (매일)
            </Label>
            <Input
              id="medication-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-10 border-stone-200"
            />
          </div>
          <Button
            onClick={() => {
              void handleAddMedication();
            }}
            disabled={formLoading}
            className="w-full h-10 bg-stone-700 hover:bg-stone-800 text-white"
          >
            {formLoading ? "등록 중..." : "알림 등록"}
          </Button>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-stone-800">등록된 알림</p>
          {loading ? (
            <p className="text-sm text-stone-500">불러오는 중...</p>
          ) : medications.length === 0 ? (
            <p className="text-sm text-stone-500">
              등록된 복약 알림이 없습니다.
            </p>
          ) : (
            medications.map((medication) => (
              <div
                key={medication.id}
                className="rounded-lg border border-stone-200 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-stone-800">
                      {medication.name}
                    </p>
                    <p className="text-xs text-stone-500">매일 반복</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void handleDelete(medication.id);
                    }}
                    disabled={actionId === medication.id}
                    className="h-8 border-stone-300 text-stone-600"
                  >
                    삭제
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <Input
                    type="time"
                    value={medication.schedule.time}
                    onChange={(e) => {
                      void handleTimeChange(medication, e.target.value);
                    }}
                    disabled={actionId === medication.id}
                    className="h-9 w-32 border-stone-200"
                  />
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <Checkbox
                      checked={medication.enabled}
                      onCheckedChange={() => {
                        void handleToggleEnabled(medication);
                      }}
                      disabled={actionId === medication.id}
                    />
                    알림 켜기
                  </label>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-stone-800">복용 기록</p>
          {logsLoading ? (
            <p className="text-sm text-stone-500">불러오는 중...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-stone-500">아직 복용 기록이 없습니다.</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-stone-800">
                    {log.medicationName ?? "알 수 없는 약"}
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatLogTime(log.takenAt)}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    log.status === "taken"
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-100"
                  }
                >
                  {LOG_STATUS_LABEL[log.status]}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
      )}
    </Card>
  );
}
