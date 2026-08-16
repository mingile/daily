"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  MedicationMealSlot,
  MedicationResponse,
} from "@/lib/medication-types";
import {
  MEDICATION_MEAL_SLOT_LABELS,
  MEDICATION_SCHEDULE_TIMEZONE,
} from "@/lib/medication-types";

type DailyMedicationsState = {
  breakfastMedications: string[];
  lunchMedications: string[];
  dinnerMedications: string[];
};

type MedicationPendingCardProps = DailyMedicationsState & {
  onMedicationTaken: (
    mealSlot: MedicationMealSlot,
    medicationName: string,
  ) => void;
};

const MEAL_MEDICATION_KEYS: Record<
  MedicationMealSlot,
  "breakfastMedications" | "lunchMedications" | "dinnerMedications"
> = {
  breakfast: "breakfastMedications",
  lunch: "lunchMedications",
  dinner: "dinnerMedications",
};

function getKstNowMinutes(date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: MEDICATION_SCHEDULE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(
    parts.find((part) => part.type === "hour")?.value ?? "0",
    10,
  );
  const minute = parseInt(
    parts.find((part) => part.type === "minute")?.value ?? "0",
    10,
  );

  return hour * 60 + minute;
}

function scheduleTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map((value) => parseInt(value, 10));
  return hour * 60 + minute;
}

function isMedicationDue(scheduleTime: string, nowMinutes: number): boolean {
  return scheduleTimeToMinutes(scheduleTime) <= nowMinutes;
}

function isMedicationPending(
  medication: MedicationResponse,
  medicationsByMeal: DailyMedicationsState,
  nowMinutes: number,
): boolean {
  if (!medication.enabled) {
    return false;
  }

  const mealKey = MEAL_MEDICATION_KEYS[medication.schedule.mealSlot];
  if (medicationsByMeal[mealKey].includes(medication.name)) {
    return false;
  }

  return isMedicationDue(medication.schedule.time, nowMinutes);
}

export function MedicationPendingCard(props: MedicationPendingCardProps) {
  return (
    <Suspense fallback={null}>
      <MedicationPendingCardContent {...props} />
    </Suspense>
  );
}

function MedicationPendingCardContent({
  breakfastMedications,
  lunchMedications,
  dinnerMedications,
  onMedicationTaken,
}: MedicationPendingCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightMedicationId = searchParams.get("medicationId");
  const cardRef = useRef<HTMLDivElement>(null);

  const [medications, setMedications] = useState<MedicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState(() => getKstNowMinutes());

  const medicationsByMeal = useMemo(
    () => ({
      breakfastMedications,
      lunchMedications,
      dinnerMedications,
    }),
    [breakfastMedications, lunchMedications, dinnerMedications],
  );

  const fetchMedications = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/medications", {
        credentials: "include",
      });
      const data = (await response.json()) as {
        medications?: MedicationResponse[];
      };

      if (!response.ok) {
        throw new Error("Failed to fetch medications");
      }

      setMedications(data.medications ?? []);
    } catch (error) {
      console.error("Pending medications load failed:", error);
      setMedications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMedications();
  }, [fetchMedications]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMinutes(getKstNowMinutes());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const pendingMedications = useMemo(
    () =>
      medications.filter((medication) =>
        isMedicationPending(medication, medicationsByMeal, nowMinutes),
      ),
    [medications, medicationsByMeal, nowMinutes],
  );

  const clearHighlightParam = useCallback(() => {
    if (!highlightMedicationId) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("medicationId");
    const next = params.toString();
    router.replace(next ? `/?${next}` : "/");
  }, [highlightMedicationId, router, searchParams]);

  useEffect(() => {
    if (!highlightMedicationId || pendingMedications.length === 0) {
      return;
    }

    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlightMedicationId, pendingMedications.length]);

  const handleComplete = (medication: MedicationResponse) => {
    setCompletingId(medication.id);
    onMedicationTaken(medication.schedule.mealSlot, medication.name);
    clearHighlightParam();
    setCompletingId(null);
  };

  if (loading || pendingMedications.length === 0) {
    return null;
  }

  return (
    <div ref={cardRef}>
      <Card className="bg-amber-50 border-amber-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-stone-800 text-lg">복용 확인</CardTitle>
        <p className="text-sm text-stone-600">
          아래 약을 복용하셨다면 완료를 눌러 주세요.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingMedications.map((medication) => {
          const isHighlighted = medication.id === highlightMedicationId;

          return (
            <div
              key={medication.id}
              className={`rounded-lg border p-4 space-y-3 ${
                isHighlighted
                  ? "border-amber-500 bg-white ring-2 ring-amber-200"
                  : "border-amber-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-800">
                    {medication.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {medication.schedule.time} ·{" "}
                    {MEDICATION_MEAL_SLOT_LABELS[medication.schedule.mealSlot]}
                  </p>
                </div>
                {isHighlighted && (
                  <Badge className="bg-amber-600 text-white hover:bg-amber-600">
                    알림
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => handleComplete(medication)}
                disabled={completingId === medication.id}
                className="h-9 bg-green-700 hover:bg-green-800 text-white"
              >
                {completingId === medication.id ? "처리 중..." : "복용 완료"}
              </Button>
            </div>
          );
        })}
      </CardContent>
      </Card>
    </div>
  );
}
