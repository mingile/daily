export type FoodItem = {
  name: string;
  amount: number;
  unit: "g" | "개";
};

export type MealCompletionState = {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
};

export type DailyState = {
  mealCompletion: MealCompletionState;
  workout: boolean;
  memo: string;
  breakfast: FoodItem[];
  lunch: FoodItem[];
  dinner: FoodItem[];
  breakfastMedications: string[];
  lunchMedications: string[];
  dinnerMedications: string[];
};

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        getDailyState?: {
          postMessage: (message: unknown) => void;
        };
        saveDailyState?: {
          postMessage: (message: unknown) => void;
        };
      };
    };
    __dailyAppBridge?: {
      resolve: (requestId: string, payload?: unknown) => void;
      reject: (requestId: string, error: unknown) => void;
    };
  }
}

const DAILY_STATE_KEY = "daily.state.v1";
const BRIDGE_TIMEOUT_MS = 5000;

type PendingBridgeRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const pendingBridgeRequests = new Map<string, PendingBridgeRequest>();

function createEmptyDailyState(): DailyState {
  return {
    mealCompletion: { breakfast: false, lunch: false, dinner: false },
    workout: false,
    memo: "",
    breakfast: [],
    lunch: [],
    dinner: [],
    breakfastMedications: [],
    lunchMedications: [],
    dinnerMedications: [],
  };
}

function normalizeDailyState(dateData: unknown): DailyState {
  if (!dateData || typeof dateData !== "object") {
    return createEmptyDailyState();
  }

  const data = dateData as Partial<DailyState>;

  return {
    mealCompletion: {
      breakfast: data.mealCompletion?.breakfast ?? false,
      lunch: data.mealCompletion?.lunch ?? false,
      dinner: data.mealCompletion?.dinner ?? false,
    },
    workout: data.workout ?? false,
    memo: data.memo ?? "",
    breakfast: data.breakfast ?? [],
    lunch: data.lunch ?? [],
    dinner: data.dinner ?? [],
    breakfastMedications: data.breakfastMedications ?? [],
    lunchMedications: data.lunchMedications ?? [],
    dinnerMedications: data.dinnerMedications ?? [],
  };
}

function ensureDailyAppBridge(): void {
  if (typeof window === "undefined" || window.__dailyAppBridge) {
    return;
  }

  window.__dailyAppBridge = {
    resolve(requestId: string, payload?: unknown) {
      const pending = pendingBridgeRequests.get(requestId);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeoutId);
      pendingBridgeRequests.delete(requestId);
      pending.resolve(payload);
    },
    reject(requestId: string, error: unknown) {
      const pending = pendingBridgeRequests.get(requestId);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeoutId);
      pendingBridgeRequests.delete(requestId);
      pending.reject(error);
    },
  };
}

function createBridgeRequestId(): string {
  return crypto.randomUUID();
}

function sendBridgeRequest<T>(
  handlerName: "getDailyState" | "saveDailyState",
  message: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    ensureDailyAppBridge();

    const requestId = createBridgeRequestId();
    const handler = window.webkit?.messageHandlers?.[handlerName];

    if (!handler) {
      reject(new Error(`Bridge handler "${handlerName}" is not available`));
      return;
    }

    const timeoutId = setTimeout(() => {
      const pending = pendingBridgeRequests.get(requestId);
      if (!pending) {
        return;
      }

      pendingBridgeRequests.delete(requestId);
      reject(
        new Error(
          `Bridge request "${handlerName}" timed out after ${BRIDGE_TIMEOUT_MS}ms`,
        ),
      );
    }, BRIDGE_TIMEOUT_MS);

    pendingBridgeRequests.set(requestId, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timeoutId,
    });

    handler.postMessage({ requestId, ...message });
  });
}

export function isWebViewEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    window.webkit?.messageHandlers?.getDailyState &&
    window.webkit?.messageHandlers?.saveDailyState,
  );
}

function getDateString(baseDate: Date, offsetDays: number = 0): string {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function loadDailyState(date: string): DailyState {
  try {
    const stored = localStorage.getItem(DAILY_STATE_KEY);
    if (!stored) {
      return {
        mealCompletion: { breakfast: false, lunch: false, dinner: false },
        workout: false,
        memo: "",
        breakfast: [],
        lunch: [],
        dinner: [],
        breakfastMedications: [],
        lunchMedications: [],
        dinnerMedications: [],
      };
    }

    const data = JSON.parse(stored);
    const dateData = data[date];

    if (!dateData) {
      return {
        mealCompletion: { breakfast: false, lunch: false, dinner: false },
        workout: false,
        memo: "",
        breakfast: [],
        lunch: [],
        dinner: [],
        breakfastMedications: [],
        lunchMedications: [],
        dinnerMedications: [],
      };
    }

    return {
      mealCompletion: {
        breakfast: dateData.mealCompletion?.breakfast ?? false,
        lunch: dateData.mealCompletion?.lunch ?? false,
        dinner: dateData.mealCompletion?.dinner ?? false,
      },
      workout: dateData.workout ?? false,
      memo: dateData.memo ?? "",
      breakfast: dateData.breakfast ?? [],
      lunch: dateData.lunch ?? [],
      dinner: dateData.dinner ?? [],
      breakfastMedications: dateData.breakfastMedications ?? [],
      lunchMedications: dateData.lunchMedications ?? [],
      dinnerMedications: dateData.dinnerMedications ?? [],
    };
  } catch (error) {
    console.error("Failed to load daily state:", error);
    return {
      mealCompletion: { breakfast: false, lunch: false, dinner: false },
      workout: false,
      memo: "",
      breakfast: [],
      lunch: [],
      dinner: [],
      breakfastMedications: [],
      lunchMedications: [],
      dinnerMedications: [],
    };
  }
}

export function saveDailyState(date: string, state: DailyState) {
  try {
    const stored = localStorage.getItem(DAILY_STATE_KEY);
    const data = stored ? JSON.parse(stored) : {};

    data[date] = state;

    const sevenDaysAgo = getDateString(new Date(date), -7);
    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([key]) => key >= sevenDaysAgo),
    );

    localStorage.setItem(DAILY_STATE_KEY, JSON.stringify(cleaned));
  } catch (error) {
    console.error("Failed to save daily state:", error);
  }
}

export async function loadDailyStateAsync(date: string): Promise<DailyState> {
  if (isWebViewEnvironment()) {
    try {
      const payload = await sendBridgeRequest<{ state?: unknown }>(
        "getDailyState",
        {
          date,
        },
      );
      return normalizeDailyState(
        payload && typeof payload === "object" && "state" in payload
          ? payload.state
          : payload,
      );
    } catch (error) {
      console.error("Failed to load daily state via bridge:", error);
      return createEmptyDailyState();
    }
  }

  return loadDailyState(date);
}

export async function saveDailyStateAsync(
  date: string,
  state: DailyState,
): Promise<void> {
  if (isWebViewEnvironment()) {
    await sendBridgeRequest<void>("saveDailyState", { date, state });
    return;
  }

  saveDailyState(date, state);
}
