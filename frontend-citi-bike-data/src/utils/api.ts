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
  targetMonth: string,
  analysisType: AnalysisType,
): Promise<TripCountResult> => {
  const data = await fetch(API_URL + "/functions/v1/trip-counts", {
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
