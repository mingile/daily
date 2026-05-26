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

const DAILY_STATE_KEY = "daily.state.v1";

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
      Object.entries(data).filter(([key]) => key >= sevenDaysAgo)
    );

    localStorage.setItem(DAILY_STATE_KEY, JSON.stringify(cleaned));
  } catch (error) {
    console.error("Failed to save daily state:", error);
  }
}
