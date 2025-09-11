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
  analysisType: AnalysisType
): Promise<TripCountResult> => {
  const data = await fetch(API_URL + "/trip-counts", {
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
