"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { X, Minus, Plus, Check } from "lucide-react";
import {
  loadDailyStateAsync,
  saveDailyStateAsync,
  isWebViewEnvironment,
  type DailyState,
  type MealCompletionState,
} from "@/lib/dailyStateStorage";

type FoodItem = {
  name: string;
  amount: number;
  unit: "g" | "개";
};

type MealType = "breakfast" | "lunch" | "dinner";

type DailyLog = {
  date: string;
  breakfast: FoodItem[];
  lunch: FoodItem[];
  dinner: FoodItem[];
  breakfastMedications: string[];
  lunchMedications: string[];
  dinnerMedications: string[];
  workout: boolean;
  memo: string;
};

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
};

function serializeFoodItems(items: FoodItem[]): string {
  return items
    .map((item) => `${item.name} ${item.amount}${item.unit}`)
    .join("\n");
}

function parseFoodItems(mealString: string): FoodItem[] {
  if (!mealString) return [];

  const lines = mealString.split("\n");
  const items: FoodItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const pattern = /^(.+)\s+([1-9]\d*)(g|개)$/;
    const match = trimmed.match(pattern);

    if (match) {
      items.push({
        name: match[1].trim(),
        amount: parseInt(match[2], 10),
        unit: match[3] as "g" | "개",
      });
    }
  }

  return items;
}

function getTodayString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

const DEFAULT_DAILY_LOG: DailyLog = {
  date: "",
  breakfast: [],
  lunch: [],
  dinner: [],
  breakfastMedications: [],
  lunchMedications: [],
  dinnerMedications: [],
  workout: false,
  memo: "",
};

const DEFAULT_MEAL_COMPLETION: MealCompletionState = {
  breakfast: false,
  lunch: false,
  dinner: false,
};

export default function HomePage() {
  const [todayStr, setTodayStr] = useState("");
  const [dailyLog, setDailyLog] = useState<DailyLog>(DEFAULT_DAILY_LOG);
  const [isDailyLogLoading, setIsDailyLogLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [isLoadingRecentFoods, setIsLoadingRecentFoods] = useState(false);
  const [recentMedications, setRecentMedications] = useState<string[]>([]);
  const [isLoadingRecentMedications, setIsLoadingRecentMedications] =
    useState(false);
  const [mealCompletion, setMealCompletion] = useState<MealCompletionState>(
    DEFAULT_MEAL_COMPLETION,
  );
  const [isMounted, setIsMounted] = useState(false);
  const [notionConnection, setNotionConnection] = useState<{
    loading: boolean;
    notionConnected: boolean;
    dbConnected: boolean;
  }>({
    loading: true,
    notionConnected: false,
    dbConnected: false,
  });
  const [databaseOptions, setDatabaseOptions] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [isLoadingDatabaseOptions, setIsLoadingDatabaseOptions] =
    useState(false);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string>("");
  const [isConnectingDb, setIsConnectingDb] = useState(false);
  const [dbConnectError, setDbConnectError] = useState("");
  const widgetTokenSentRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  const applyLoadedDailyState = useCallback((loaded: DailyState, date: string) => {
    setDailyLog({
      date,
      breakfast: loaded.breakfast,
      lunch: loaded.lunch,
      dinner: loaded.dinner,
      breakfastMedications: loaded.breakfastMedications,
      lunchMedications: loaded.lunchMedications,
      dinnerMedications: loaded.dinnerMedications,
      workout: loaded.workout,
      memo: loaded.memo,
    });
    setMealCompletion(loaded.mealCompletion);
  }, []);

  const reloadDailyStateFromIOS = useCallback(
    async (source: string) => {
      if (!isWebViewEnvironment() || !todayStr) {
        return;
      }

      console.debug(`[Daily] reloadDailyStateFromIOS (${source})`);

      try {
        const loaded = await loadDailyStateAsync(todayStr);
        applyLoadedDailyState(loaded, todayStr);
      } catch (error) {
        console.error(
          `[Daily] reloadDailyStateFromIOS failed (${source}):`,
          error,
        );
      }
    },
    [todayStr, applyLoadedDailyState],
  );

  useEffect(() => {
    setTodayStr(getTodayString()); // eslint-disable-line
  }, []);

  // hydration mismatch 방지를 위해 useEffect에서 초기화
  useEffect(() => {
    if (!todayStr) {
      return;
    }

    let cancelled = false;

    const loadState = async () => {
      try {
        const loaded = await loadDailyStateAsync(todayStr);
        if (cancelled) {
          return;
        }

        applyLoadedDailyState(loaded, todayStr);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error("Failed to load daily state:", error);
      } finally {
        if (!cancelled && isInitialLoadRef.current) {
          setIsMounted(true);
          isInitialLoadRef.current = false;
        }
      }
    };

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [todayStr, applyLoadedDailyState]);

  useEffect(() => {
    if (!isWebViewEnvironment()) {
      return;
    }

    const handleNativeEvent = () => {
      void reloadDailyStateFromIOS("dailyAppStateDidChange");
    };

    const handlePageShow = () => {
      void reloadDailyStateFromIOS("pageshow");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void reloadDailyStateFromIOS("visibilitychange");
      }
    };

    window.addEventListener("dailyAppStateDidChange", handleNativeEvent);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("dailyAppStateDidChange", handleNativeEvent);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reloadDailyStateFromIOS]);

  const persistDailyState = useCallback(
    (overrides: Partial<DailyState> = {}) => {
      const state: DailyState = {
        mealCompletion: overrides.mealCompletion ?? mealCompletion,
        workout: overrides.workout ?? dailyLog.workout,
        memo: overrides.memo ?? dailyLog.memo,
        breakfast: overrides.breakfast ?? dailyLog.breakfast,
        lunch: overrides.lunch ?? dailyLog.lunch,
        dinner: overrides.dinner ?? dailyLog.dinner,
        breakfastMedications:
          overrides.breakfastMedications ?? dailyLog.breakfastMedications,
        lunchMedications:
          overrides.lunchMedications ?? dailyLog.lunchMedications,
        dinnerMedications:
          overrides.dinnerMedications ?? dailyLog.dinnerMedications,
      };

      void saveDailyStateAsync(todayStr, state).catch((error) => {
        console.error("Failed to save daily state:", error);
      });
    },
    [todayStr, mealCompletion, dailyLog],
  );

  const fetchDatabaseOptions = useCallback(async () => {
    setIsLoadingDatabaseOptions(true);
    setDbConnectError("");

    try {
      const response = await fetch("/api/notion/database-options");

      if (!response.ok) {
        if (response.status === 401) {
          setDbConnectError("Notion 연결 후 DB를 선택할 수 있습니다.");
        } else {
          throw new Error("DB 목록을 불러오지 못했습니다");
        }
        return;
      }

      const data = await response.json();
      setDatabaseOptions(data.data || []);
    } catch (error) {
      console.error("DB 목록 로딩 오류:", error);
      setDbConnectError(
        error instanceof Error
          ? error.message
          : "DB 목록을 불러오지 못했습니다",
      );
    } finally {
      setIsLoadingDatabaseOptions(false);
    }
  }, []);

  const fetchNotionConnection = useCallback(async () => {
    setNotionConnection((prev) => ({ ...prev, loading: true }));

    try {
      const response = await fetch("/api/notion/connection");
      const data = await response.json();

      if (
        data.notionConnected !== undefined &&
        data.dbConnected !== undefined
      ) {
        setNotionConnection({
          loading: false,
          notionConnected: data.notionConnected,
          dbConnected: data.dbConnected,
        });

        if (data.notionConnected && !data.dbConnected) {
          fetchDatabaseOptions();
        }
      } else if (data.connected !== undefined) {
        setNotionConnection({
          loading: false,
          notionConnected: data.connected,
          dbConnected: data.connected,
        });
      } else {
        setNotionConnection({
          loading: false,
          notionConnected: false,
          dbConnected: false,
        });
      }
    } catch (error) {
      console.error("Notion 연결 상태 확인 오류:", error);
      setNotionConnection({
        loading: false,
        notionConnected: false,
        dbConnected: false,
      });
    }
  }, [fetchDatabaseOptions]);

  const fetchDailyLog = useCallback(async () => {
    if (isWebViewEnvironment()) {
      console.debug(
        "[Daily] Skipping Notion fetchDailyLog in iOS WebView; iOS Storage is SSOT",
      );
      return;
    }

    setIsDailyLogLoading(true);
    setLoadError("");

    try {
      const response = await fetch(`/api/daily-log?date=${todayStr}`);

      if (!response.ok) {
        throw new Error("기록을 불러오지 못했습니다");
      }

      const data = await response.json();

      if (data.found && data.log) {
        setDailyLog({
          date: todayStr,
          breakfast: parseFoodItems(data.log.breakfast || ""),
          lunch: parseFoodItems(data.log.lunch || ""),
          dinner: parseFoodItems(data.log.dinner || ""),
          breakfastMedications: data.log.breakfastMedications || [],
          lunchMedications: data.log.lunchMedications || [],
          dinnerMedications: data.log.dinnerMedications || [],
          workout: data.log.workout || false,
          memo: data.log.memo || "",
        });
      }
    } catch (error) {
      console.error("기록 로딩 오류:", error);
      setLoadError(
        error instanceof Error ? error.message : "기록을 불러오지 못했습니다",
      );
    } finally {
      setIsDailyLogLoading(false);
    }
  }, [todayStr]);

  const fetchRecentFoods = useCallback(async () => {
    setIsLoadingRecentFoods(true);

    try {
      const response = await fetch("/api/daily-log/recent-foods");

      if (!response.ok) {
        throw new Error("최근 음식을 불러오지 못했습니다");
      }

      const data = await response.json();
      setRecentFoods(data.foods || []);
    } catch (error) {
      console.error("최근 음식 로딩 오류:", error);
    } finally {
      setIsLoadingRecentFoods(false);
    }
  }, []);

  const fetchRecentMedications = useCallback(async () => {
    setIsLoadingRecentMedications(true);

    try {
      const response = await fetch("/api/daily-log/recent-medications");

      if (!response.ok) {
        throw new Error("최근 약을 불러오지 못했습니다");
      }

      const data = await response.json();
      setRecentMedications(data.medications || []);
    } catch (error) {
      console.error("최근 약 로딩 오류:", error);
    } finally {
      setIsLoadingRecentMedications(false);
    }
  }, []);

  const sendWidgetTokenToNativeApp = useCallback(async () => {
    if (widgetTokenSentRef.current) return;
    widgetTokenSentRef.current = true;

    const webkit = (
      window as unknown as {
        webkit?: {
          messageHandlers?: {
            widgetToken?: { postMessage: (token: string) => void };
          };
        };
      }
    ).webkit;

    if (!webkit?.messageHandlers?.widgetToken) {
      return;
    }

    try {
      const response = await fetch("/api/widget/token", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) return;

      const data = await response.json();
      const token = data.widgetToken;

      if (!token) return;

      webkit.messageHandlers.widgetToken.postMessage(token);
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    sendWidgetTokenToNativeApp();
  }, [sendWidgetTokenToNativeApp]);

  useEffect(() => {
    // eslint-disable-next-line
    fetchNotionConnection();
  }, [fetchNotionConnection]);

  useEffect(() => {
    if (notionConnection.dbConnected) {
      // eslint-disable-next-line
      fetchDailyLog();
      fetchRecentFoods();
      fetchRecentMedications();
    }
  }, [
    notionConnection.dbConnected,
    fetchDailyLog,
    fetchRecentFoods,
    fetchRecentMedications,
  ]);

  const handleAddFood = (mealType: MealType, food: FoodItem) => {
    setDailyLog((prev) => ({
      ...prev,
      [mealType]: [...prev[mealType], food],
    }));
  };

  const handleRemoveFood = (mealType: MealType, index: number) => {
    setDailyLog((prev) => ({
      ...prev,
      [mealType]: prev[mealType].filter((_, idx) => idx !== index),
    }));
  };

  const handleAddMedication = (
    mealType: "breakfast" | "lunch" | "dinner",
    medication: string,
  ) => {
    const medicationKey = `${mealType}Medications` as
      | "breakfastMedications"
      | "lunchMedications"
      | "dinnerMedications";

    setDailyLog((prev) => ({
      ...prev,
      [medicationKey]: [...prev[medicationKey], medication],
    }));
  };

  const handleRemoveMedication = (
    mealType: "breakfast" | "lunch" | "dinner",
    medication: string,
  ) => {
    const medicationKey = `${mealType}Medications` as
      | "breakfastMedications"
      | "lunchMedications"
      | "dinnerMedications";

    setDailyLog((prev) => ({
      ...prev,
      [medicationKey]: prev[medicationKey].filter((m) => m !== medication),
    }));
  };

  const handleToggleMealCompletion = (mealType: MealType) => {
    setMealCompletion((prev) => {
      const nextState = {
        ...prev,
        [mealType]: !prev[mealType],
      };
      persistDailyState({ mealCompletion: nextState });
      return nextState;
    });
  };

  const handleNotionConnect = () => {
    window.location.href = "/api/notion/auth";
  };

  const handleNotionDisconnect = async () => {
    try {
      const response = await fetch("/api/notion/disconnect", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("연결 해제 실패");
      }

      setNotionConnection({
        loading: false,
        notionConnected: false,
        dbConnected: false,
      });

      setDailyLog({
        date: todayStr,
        breakfast: [],
        lunch: [],
        dinner: [],
        breakfastMedications: [],
        lunchMedications: [],
        dinnerMedications: [],
        workout: false,
        memo: "",
      });
      setRecentFoods([]);
      setRecentMedications([]);
      setLoadError("");

      setSaveMessage("Notion 연결 해제 완료");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("연결 해제 오류:", error);
      setSaveMessage(
        `연결 해제 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      );
    }
  };

  const handleConnectDatabase = async () => {
    if (!selectedDatabaseId) return;

    setIsConnectingDb(true);
    setDbConnectError("");

    try {
      const response = await fetch("/api/notion/connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          daily_health_db_id: selectedDatabaseId,
        }),
      });

      if (!response.ok) {
        throw new Error("DB 연결에 실패했습니다.");
      }

      const connectionResponse = await fetch("/api/notion/connection");
      const connectionData = await connectionResponse.json();

      if (
        connectionData.notionConnected !== undefined &&
        connectionData.dbConnected !== undefined
      ) {
        setNotionConnection({
          loading: false,
          notionConnected: connectionData.notionConnected,
          dbConnected: connectionData.dbConnected,
        });
      }

      setSaveMessage("DB 연결 완료");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("DB 연결 오류:", error);
      setDbConnectError(
        error instanceof Error ? error.message : "DB 연결에 실패했습니다.",
      );
    } finally {
      setIsConnectingDb(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");

    try {
      const requestBody = {
        date: dailyLog.date,
        log: {
          breakfast: serializeFoodItems(dailyLog.breakfast),
          lunch: serializeFoodItems(dailyLog.lunch),
          dinner: serializeFoodItems(dailyLog.dinner),
          breakfastMedications: dailyLog.breakfastMedications,
          lunchMedications: dailyLog.lunchMedications,
          dinnerMedications: dailyLog.dinnerMedications,
          workout: dailyLog.workout,
          memo: dailyLog.memo,
        },
      };

      const response = await fetch("/api/daily-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "저장 실패");
      }

      const data = await response.json();
      console.log("저장 응답:", data);
      setSaveMessage("저장 완료");

      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("저장 오류:", error);
      setSaveMessage(
        `저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#f5f3ef] flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-3 border-stone-300 border-t-stone-700 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-stone-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div key={todayStr} className="min-h-screen bg-[#f5f3ef] py-8 px-4 pb-24">
      <div className="max-w-[480px] mx-auto space-y-6">
        <header className="text-center space-y-3 px-4">
          <h1 className="text-3xl font-semibold text-stone-800">daily</h1>
          <p className="text-sm text-stone-600">{dailyLog.date}</p>

          <div className="pt-2">
            {notionConnection.loading ? (
              <div className="text-xs text-stone-500">
                Notion 연결 상태 확인 중...
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Badge
                    variant={
                      notionConnection.notionConnected ? "default" : "secondary"
                    }
                    className={
                      notionConnection.notionConnected
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-stone-200 text-stone-600"
                    }
                  >
                    {notionConnection.notionConnected
                      ? notionConnection.dbConnected
                        ? "Daily DB 연결됨"
                        : "Notion 연결됨"
                      : "Notion 연결 필요"}
                  </Badge>
                </div>
                {notionConnection.notionConnected ? (
                  <Button
                    onClick={handleNotionDisconnect}
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 border-stone-300 text-stone-600 hover:bg-stone-100"
                  >
                    연결 해제
                  </Button>
                ) : (
                  <Button
                    onClick={handleNotionConnect}
                    size="sm"
                    className="text-xs h-7 bg-stone-700 hover:bg-stone-800 text-white"
                  >
                    Notion 연결
                  </Button>
                )}
              </div>
            )}
          </div>
        </header>

        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm text-center">
            {loadError}
          </div>
        )}

        {!notionConnection.loading && !notionConnection.notionConnected && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm text-center">
            Notion을 연결하면 daily 기록을 저장하고 불러올 수 있습니다.
          </div>
        )}

        {!notionConnection.loading &&
          notionConnection.notionConnected &&
          !notionConnection.dbConnected && (
            <Card className="bg-white border-stone-200 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-stone-800 text-lg">
                  Daily Health Log DB 선택
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingDatabaseOptions ? (
                  <div className="text-center py-4">
                    <div className="w-6 h-6 border-3 border-stone-300 border-t-stone-700 rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-stone-600">
                      DB 목록을 불러오는 중...
                    </p>
                  </div>
                ) : dbConnectError ? (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm text-center">
                    {dbConnectError}
                  </div>
                ) : databaseOptions.length === 0 ? (
                  <div className="text-center py-4 text-sm text-stone-500">
                    사용 가능한 DB가 없습니다.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {databaseOptions.map((db) => (
                        <button
                          key={db.id}
                          onClick={() => setSelectedDatabaseId(db.id)}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                            selectedDatabaseId === db.id
                              ? "border-stone-700 bg-stone-50 shadow-sm"
                              : "border-stone-200 bg-white hover:bg-stone-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-stone-800">
                              {db.title || "Untitled"}
                            </span>
                            {selectedDatabaseId === db.id && (
                              <Badge className="bg-stone-700 text-white text-xs">
                                선택됨
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={handleConnectDatabase}
                      disabled={!selectedDatabaseId || isConnectingDb}
                      className="w-full h-10 bg-stone-700 hover:bg-stone-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isConnectingDb ? "연결 중..." : "선택한 DB 연결"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

        {notionConnection.dbConnected && isDailyLogLoading && (
          <div className="text-center py-6">
            <div className="w-6 h-6 border-3 border-stone-300 border-t-stone-700 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-stone-600">기록을 불러오는 중...</p>
          </div>
        )}

        {(["breakfast", "lunch", "dinner"] as MealType[]).map((mealType) => (
          <MealCard
            key={mealType}
            mealType={mealType}
            label={MEAL_LABELS[mealType]}
            items={dailyLog[mealType]}
            onAddFood={(food) => handleAddFood(mealType, food)}
            onRemoveFood={(index) => handleRemoveFood(mealType, index)}
            medications={
              dailyLog[
                `${mealType}Medications` as
                  | "breakfastMedications"
                  | "lunchMedications"
                  | "dinnerMedications"
              ]
            }
            onAddMedication={(med) => handleAddMedication(mealType, med)}
            onRemoveMedication={(med) => handleRemoveMedication(mealType, med)}
            completed={mealCompletion[mealType]}
            onToggleCompleted={() => handleToggleMealCompletion(mealType)}
            recentFoods={recentFoods}
            isLoadingRecentFoods={isLoadingRecentFoods}
            recentMedications={recentMedications}
            isLoadingRecentMedications={isLoadingRecentMedications}
          />
        ))}

        <Card
          className={`border-stone-200 shadow-sm transition-colors ${
            dailyLog.workout ? "bg-green-50" : "bg-white"
          }`}
        >
          <CardHeader className="pb-4">
            <CardTitle className="text-stone-800 text-lg">운동</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="workout"
                checked={dailyLog.workout}
                onCheckedChange={(checked) => {
                  const newWorkout = checked === true;
                  setDailyLog((prev) => ({
                    ...prev,
                    workout: newWorkout,
                  }));
                  persistDailyState({ workout: newWorkout });
                }}
                className="border-stone-300"
              />
              <Label
                htmlFor="workout"
                className="text-stone-700 font-normal cursor-pointer"
              >
                오늘 운동했어요
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-stone-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-stone-800 text-lg">메모</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={dailyLog.memo}
              onChange={(e) =>
                setDailyLog((prev) => ({ ...prev, memo: e.target.value }))
              }
              onBlur={() => {
                persistDailyState({ memo: dailyLog.memo });
              }}
              placeholder="오늘 하루를 기록해보세요"
              className="min-h-[100px] border-stone-200 focus-visible:border-stone-400 focus-visible:ring-stone-300 resize-none"
            />
          </CardContent>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#f5f3ef]/95 backdrop-blur-sm border-t border-stone-200">
          <div className="max-w-[480px] mx-auto space-y-3">
            {saveMessage && (
              <div
                className={`text-center text-sm font-medium py-2 px-4 rounded-lg ${
                  saveMessage.includes("완료")
                    ? "bg-green-100 text-green-800 border border-green-200"
                    : "bg-red-100 text-red-800 border border-red-200"
                }`}
              >
                {saveMessage}
              </div>
            )}
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                !notionConnection.notionConnected ||
                !notionConnection.dbConnected
              }
              className="w-full h-12 bg-stone-700 hover:bg-stone-800 text-white text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MealCard({
  mealType,
  label,
  items,
  onAddFood,
  onRemoveFood,
  medications,
  onAddMedication,
  onRemoveMedication,
  completed,
  onToggleCompleted,
  recentFoods,
  isLoadingRecentFoods,
  recentMedications,
  isLoadingRecentMedications,
}: {
  mealType: MealType;
  label: string;
  items: FoodItem[];
  onAddFood: (food: FoodItem) => void;
  onRemoveFood: (index: number) => void;
  medications: string[];
  onAddMedication: (medication: string) => void;
  onRemoveMedication: (medication: string) => void;
  completed: boolean;
  onToggleCompleted: () => void;
  recentFoods: FoodItem[];
  isLoadingRecentFoods: boolean;
  recentMedications: string[];
  isLoadingRecentMedications: boolean;
}) {
  const [foodName, setFoodName] = useState("");
  const [foodAmount, setFoodAmount] = useState("");
  const [foodUnit, setFoodUnit] = useState<"g" | "개">("g");
  const [medicationName, setMedicationName] = useState("");

  const handleAddFood = () => {
    const trimmedName = foodName.trim();
    const amount = parseInt(foodAmount, 10);

    if (!trimmedName) return;
    if (!foodAmount || amount <= 0 || isNaN(amount)) return;

    onAddFood({
      name: trimmedName,
      amount,
      unit: foodUnit,
    });

    setFoodName("");
    setFoodAmount("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddFood();
    }
  };

  const handleRecentFoodClick = (food: FoodItem) => {
    setFoodName(food.name);
    setFoodAmount(food.amount.toString());
    setFoodUnit(food.unit);
  };

  const getAmountStep = () => {
    return foodUnit === "개" ? 1 : 10;
  };

  const handleAmountChange = (direction: "increase" | "decrease") => {
    const step = getAmountStep();
    const delta = direction === "increase" ? step : -step;
    const currentAmount = parseInt(foodAmount, 10) || 0;
    const newAmount = Math.max(0, currentAmount + delta);
    setFoodAmount(newAmount.toString());
  };

  const handleAddMedication = () => {
    const trimmedMed = medicationName.trim();
    if (!trimmedMed) return;
    if (medications.includes(trimmedMed)) return;

    onAddMedication(trimmedMed);
    setMedicationName("");
  };

  const handleMedicationKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddMedication();
    }
  };

  const handleToggleRecentMedication = (med: string) => {
    if (medications.includes(med)) {
      onRemoveMedication(med);
    } else {
      onAddMedication(med);
    }
  };

  return (
    <Card
      className={`border-stone-200 shadow-sm transition-colors ${
        completed ? "bg-green-50" : "bg-white"
      }`}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-stone-800 text-lg">{label}</CardTitle>
          {!completed && (
            <button
              onClick={onToggleCompleted}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-500 bg-stone-100 hover:bg-green-100 hover:text-green-700 rounded-md transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              완료
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {completed ? (
          <div className="space-y-4">
            <div className="space-y-3">
              {items.length > 0 || medications.length > 0 ? (
                <>
                  {items.length > 0 && (
                    <div>
                      <p className="text-xs text-stone-500 mb-1.5">식단</p>
                      <p className="text-sm text-stone-700">
                        {items
                          .map(
                            (item) => `${item.name} ${item.amount}${item.unit}`,
                          )
                          .join(", ")}
                      </p>
                    </div>
                  )}
                  {medications.length > 0 && (
                    <div>
                      <p className="text-xs text-stone-500 mb-1.5">약</p>
                      <p className="text-sm text-amber-700">
                        {medications.join(", ")}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-stone-400">기록 없음</p>
              )}
            </div>
            <Button
              onClick={onToggleCompleted}
              variant="outline"
              className="w-full h-10 border-stone-300 text-stone-700 hover:bg-stone-100"
            >
              수정
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor={`food-name-${mealType}`}
                  className="text-stone-700 text-sm font-medium"
                >
                  음식명
                </Label>
                <Input
                  id={`food-name-${mealType}`}
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="예: 닭가슴살"
                  className="h-10 border-stone-200 focus-visible:border-stone-400 focus-visible:ring-stone-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor={`food-amount-${mealType}`}
                    className="text-stone-700 text-sm font-medium"
                  >
                    양
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`food-amount-${mealType}`}
                      type="number"
                      min="0"
                      value={foodAmount}
                      onChange={(e) => setFoodAmount(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="예: 200"
                      className="flex-1 h-10 border-stone-200 focus-visible:border-stone-400 focus-visible:ring-stone-300"
                    />
                    {foodUnit === "g" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleAmountChange("decrease")}
                          className="h-10 w-10 border-stone-200 text-stone-700 hover:bg-stone-50"
                          title="10 감소"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleAmountChange("increase")}
                          className="h-10 w-10 border-stone-200 text-stone-700 hover:bg-stone-50"
                          title="10 증가"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-stone-700 text-sm font-medium">
                    단위
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={foodUnit === "g" ? "default" : "outline"}
                      size="default"
                      onClick={() => setFoodUnit("g")}
                      className={
                        foodUnit === "g"
                          ? "flex-1 h-10 bg-stone-700 hover:bg-stone-800 text-white"
                          : "flex-1 h-10 border-stone-200 text-stone-700 hover:bg-stone-50"
                      }
                    >
                      g
                    </Button>
                    <Button
                      type="button"
                      variant={foodUnit === "개" ? "default" : "outline"}
                      size="default"
                      onClick={() => setFoodUnit("개")}
                      className={
                        foodUnit === "개"
                          ? "flex-1 h-10 bg-stone-700 hover:bg-stone-800 text-white"
                          : "flex-1 h-10 border-stone-200 text-stone-700 hover:bg-stone-50"
                      }
                    >
                      개
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleAddFood}
                className="w-full h-10 bg-stone-700 hover:bg-stone-800 text-white"
              >
                추가
              </Button>
            </div>

            {items.length > 0 && (
              <div className="pt-4 border-t border-stone-200">
                <div className="flex flex-wrap gap-2">
                  {items.map((item, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="bg-stone-100 text-stone-700 border border-stone-200 px-3 py-1.5 text-sm flex items-center gap-2"
                    >
                      <span>
                        {item.name} {item.amount}
                        {item.unit}
                      </span>
                      <button
                        onClick={() => onRemoveFood(idx)}
                        className="hover:bg-stone-200 rounded-full p-0.5 transition-colors"
                        aria-label="삭제"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {recentFoods.length > 0 && (
              <div className="pt-4 border-t border-stone-200">
                <div className="mb-3">
                  <p className="text-xs font-medium text-stone-600">
                    최근 음식
                  </p>
                </div>
                {isLoadingRecentFoods ? (
                  <div className="text-xs text-stone-500">불러오는 중...</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {recentFoods.map((food, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleRecentFoodClick(food)}
                        className="px-3 py-1.5 text-xs bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md text-stone-700 transition-colors"
                      >
                        {food.name} {food.amount}
                        {food.unit}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-stone-200 space-y-3">
              <Label className="text-stone-700 text-sm font-medium block">
                복용 약
              </Label>

              <div className="flex flex-col sm:flex-row gap-3">
                {/* 좌측: 최근 약 토글 */}
                <div className="flex-1 space-y-2">
                  {isLoadingRecentMedications ? (
                    <div className="text-xs text-stone-500">불러오는 중...</div>
                  ) : recentMedications.length > 0 ? (
                    <>
                      <p className="text-xs text-stone-500">최근 복용 약</p>
                      <div className="flex flex-wrap gap-2">
                        {recentMedications.map((med) => (
                          <button
                            key={med}
                            onClick={() => handleToggleRecentMedication(med)}
                            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                              medications.includes(med)
                                ? "bg-amber-600 text-white border border-amber-700"
                                : "bg-stone-50 text-stone-700 border border-stone-200 hover:bg-stone-100"
                            }`}
                          >
                            {med}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <p className="p-10 pb-5 text-xs text-stone-500">
                          최근 복용 약이 없습니다.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* 우측: 직접 입력 */}
                <div className="sm:w-48 space-y-2">
                  <p className="text-xs text-stone-500">직접 입력</p>
                  <div className="flex gap-2">
                    <Input
                      id={`medication-name-${mealType}`}
                      value={medicationName}
                      onChange={(e) => setMedicationName(e.target.value)}
                      onKeyPress={handleMedicationKeyPress}
                      placeholder="약 이름"
                      className="flex-1 h-9 text-sm border-stone-200 focus-visible:border-stone-400 focus-visible:ring-stone-300"
                    />
                    <Button
                      onClick={handleAddMedication}
                      size="sm"
                      className="h-9 bg-stone-700 hover:bg-stone-800 text-white px-3 text-xs"
                    >
                      추가
                    </Button>
                  </div>
                </div>
              </div>

              {medications.length > 0 && (
                <div>
                  <p className="text-xs text-stone-500 mb-2">선택된 약</p>
                  <div className="flex flex-wrap gap-2">
                    {medications.map((med) => (
                      <Badge
                        key={med}
                        variant="secondary"
                        className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 text-sm flex items-center gap-2"
                      >
                        <span>{med}</span>
                        <button
                          onClick={() => onRemoveMedication(med)}
                          className="hover:bg-amber-100 rounded-full p-0.5 transition-colors"
                          aria-label={`${med} 제거`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
