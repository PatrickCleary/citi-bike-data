import { API_URL } from "@/components/constants";

export type AnalysisType = "departures" | "arrivals";

export type TripCountResult = {
  data: {
    trip_counts: Record<string, number>;
    sum_all_values: number;
    highest_value: number;
  };
};

export const getTripCountData = async (
  referenceCellIds: string[],
  targetMonth: string | undefined,
  analysisType: AnalysisType,
): Promise<TripCountResult | undefined> => {
  if (!targetMonth) return undefined;
  const data = await fetch(API_URL + "/functions/v1/trip-counts-v2", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    method: "POST",
    body: JSON.stringify({
      reference_cell_ids: referenceCellIds,
      target_month: targetMonth,
      analysis_type: analysisType,
    }),
  });
  return data.json();
};

export const getMaxDate = async (): Promise<string> => {
  const data = await fetch(
    API_URL +
      "/rest/v1/citi-bike-monthly?select=date_month&order=date_month.desc&limit=1",
    {
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      method: "GET",
    },
  );

  const result = await data.json();
  return result[0].date_month;
};

export type MonthlyAggResult = {
  data: {
    date_month: string;
    total_count: number;
  }[];
};

export const getMonthlySum = async (
  originCellIds: string[],
  destinationCellIds: string[],
  year: string,
): Promise<MonthlyAggResult | undefined> => {
  if (
    !year ||
    (originCellIds.length === 0 && destinationCellIds.length === 0)
  ) {
    return undefined;
  }

  const data = await fetch(API_URL + "/functions/v1/sum-monthly-v2", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    method: "POST",
    body: JSON.stringify({
      origin_cell_ids: originCellIds,
      destination_cell_ids: destinationCellIds,
      year,
    }),
  });
  return data.json();
};

export type MonthlyTotal = {
  date_month: string;
  total_count: number;
};

export const getMonthlyTotals = async (): Promise<MonthlyTotal[]> => {
  const data = await fetch(
    API_URL + "/rest/v1/monthly_totals?select=*&order=date_month.asc",
    {
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      method: "GET",
    },
  );

  return data.json();
};
