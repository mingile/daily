"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import type {
  MedicationMealSlot,
  MedicationResponse,
} from "@/lib/medication-types";
import {
  MEDICATION_MEAL_SLOT_LABELS,
  MEDICATION_MEAL_SLOTS,
} from "@/lib/medication-types";
import {
  getPushSubscriptionStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "@/lib/web-push-subscription";

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
  const [medications, setMedications] = useState<MedicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [draftTimes, setDraftTimes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [time, setTime] = useState("09:00");
  const [mealSlot, setMealSlot] = useState<MedicationMealSlot>("breakfast");
  const [isOpen, setIsOpen] = useState(false);

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
    void fetchPushStatus();
  }, [fetchMedications, fetchPushStatus]);

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
  };

  const getDraftTime = (medication: MedicationResponse) =>
    draftTimes[medication.id] ?? medication.schedule.time;

  const clearDraftTime = (medicationId: string) => {
    setDraftTimes((prev) => {
      if (!(medicationId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[medicationId];
      return next;
    });
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

  const handleUnsubscribePush = async () => {
    setPushLoading(true);
    setError("");

    try {
      await unsubscribeFromPushNotifications();
      setPushSubscribed(false);
      showMessage("알림 구독이 해제되었습니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알림 해제에 실패했습니다.",
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
          schedule: { time, repeat: "daily", mealSlot },
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

  const commitTimeChange = async (medication: MedicationResponse) => {
    const nextTime = getDraftTime(medication);

    if (nextTime === medication.schedule.time) {
      clearDraftTime(medication.id);
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
          schedule: {
            time: nextTime,
            repeat: "daily",
            mealSlot: medication.schedule.mealSlot,
          },
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
      clearDraftTime(medication.id);
      showMessage("복용 시간이 변경되었습니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "복용 시간 변경에 실패했습니다.",
      );
    } finally {
      setActionId(null);
    }
  };

  const handleMealSlotChange = async (
    medication: MedicationResponse,
    nextMealSlot: MedicationMealSlot,
  ) => {
    if (nextMealSlot === medication.schedule.mealSlot) {
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
          schedule: {
            time: medication.schedule.time,
            repeat: "daily",
            mealSlot: nextMealSlot,
          },
        }),
      });
      const data = (await response.json()) as {
        medication?: MedicationResponse;
        error?: string;
      };

      if (!response.ok || !data.medication) {
        throw new Error(data.error ?? "복용 시간대 변경에 실패했습니다.");
      }

      setMedications((prev) =>
        prev.map((item) =>
          item.id === medication.id ? data.medication! : item,
        ),
      );
      showMessage("복용 시간대가 변경되었습니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "복용 시간대 변경에 실패했습니다.",
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
      clearDraftTime(medicationId);
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
        <div className="flex w-full items-start justify-between gap-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsOpen((prev) => !prev)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setIsOpen((prev) => !prev);
              }
            }}
            className="min-w-0 flex-1 cursor-pointer space-y-1 text-left"
            aria-expanded={isOpen}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-stone-800 text-lg">복약 알림</CardTitle>
              {pushSubscribed && (
                <Badge
                  asChild
                  variant="secondary"
                  className="cursor-pointer bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleUnsubscribePush();
                    }}
                    disabled={pushLoading}
                    aria-label="알림 해제"
                  >
                    {pushLoading ? "해제 중..." : "허용됨"}
                  </button>
                </Badge>
              )}
            </div>
            <p className="text-sm text-stone-600">
              매일 정해진 시간에 Push 알림을 받을 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="shrink-0 rounded-sm p-1 text-stone-500 hover:text-stone-700"
            aria-expanded={isOpen}
            aria-label={isOpen ? "복약 알림 접기" : "복약 알림 펼치기"}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-4">
          {!pushSubscribed && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-stone-800">Push 알림</p>
                <p className="text-xs text-stone-500">
                  알림을 받으려면 먼저 알림을 허용해 주세요.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-stone-200 text-stone-600"
                >
                  미허용
                </Badge>
                <Button
                  size="sm"
                  onClick={() => {
                    void handleSubscribePush();
                  }}
                  disabled={pushLoading}
                  className="h-8 bg-stone-700 hover:bg-stone-800 text-white"
                >
                  {pushLoading ? "허용 중..." : "알림 허용"}
                </Button>
              </div>
            </div>
          )}

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

          <div className="space-y-3 rounded-lg border border-stone-200 p-4">
            <p className="text-sm font-medium text-stone-800">새 복약 알림</p>
            <div className="space-y-2">
              <Label
                htmlFor="medication-name"
                className="text-stone-700 text-sm"
              >
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
              <Label
                htmlFor="medication-time"
                className="text-stone-700 text-sm"
              >
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
            <div className="space-y-2">
              <Label className="text-stone-700 text-sm">복용 시간대</Label>
              <div className="flex flex-wrap gap-2">
                {MEDICATION_MEAL_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setMealSlot(slot)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      mealSlot === slot
                        ? "bg-amber-600 text-white border border-amber-700"
                        : "bg-stone-50 text-stone-700 border border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    {MEDICATION_MEAL_SLOT_LABELS[slot]}
                  </button>
                ))}
              </div>
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
              medications.map((medication) => {
                const draftTime = getDraftTime(medication);
                const hasDraftTimeChange =
                  draftTime !== medication.schedule.time;

                return (
                  <div
                    key={medication.id}
                    className="rounded-lg border border-stone-200 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-stone-800">
                          {medication.name}
                        </p>
                        <p className="text-xs text-stone-500">
                          매일 반복 ·{" "}
                          {
                            MEDICATION_MEAL_SLOT_LABELS[
                              medication.schedule.mealSlot
                            ]
                          }
                        </p>
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

                    <div className="space-y-2">
                      <p className="text-xs text-stone-500">복용 시간대</p>
                      <div className="flex flex-wrap gap-2">
                        {MEDICATION_MEAL_SLOTS.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              void handleMealSlotChange(medication, slot);
                            }}
                            disabled={actionId === medication.id}
                            className={`px-3 py-1.5 text-xs rounded-md transition-colors disabled:opacity-50 ${
                              medication.schedule.mealSlot === slot
                                ? "bg-amber-600 text-white border border-amber-700"
                                : "bg-stone-50 text-stone-700 border border-stone-200 hover:bg-stone-100"
                            }`}
                          >
                            {MEDICATION_MEAL_SLOT_LABELS[slot]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Input
                        type="time"
                        value={draftTime}
                        onChange={(e) => {
                          setDraftTimes((prev) => ({
                            ...prev,
                            [medication.id]: e.target.value,
                          }));
                        }}
                        onBlur={() => {
                          void commitTimeChange(medication);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                        disabled={actionId === medication.id}
                        className="h-9 w-32 border-stone-200"
                      />
                      {hasDraftTimeChange && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void commitTimeChange(medication);
                          }}
                          disabled={actionId === medication.id}
                          className="h-9 border-stone-300 text-stone-600"
                        >
                          저장
                        </Button>
                      )}
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
                );
              })
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
