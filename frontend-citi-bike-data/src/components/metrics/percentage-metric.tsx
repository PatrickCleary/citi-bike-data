import React, { useMemo } from "react";
import {
  useTripMonthlySumData,
  useBaselineMonthlySumData,
} from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import { Sparkline } from "../sparkline";

export const PercentageMetric: React.FC = () => {
  const { originCells, destinationCells, selectedMonth } = useMapConfigStore();
  const destinationQuery = useTripMonthlySumData();
  const originQuery = useBaselineMonthlySumData();

  // Calculate percentage data over the 2-year window
  const percentageData = useMemo(() => {
    if (!destinationQuery.data?.data || !originQuery.data) return undefined;

    const destination = destinationQuery.data.data;
    const origin = originQuery.data;

    // Create a map for quick lookup of origin totals by month
    const originMap = new Map(origin.map((d) => [d.date_month, d.total_count]));

    // Calculate percentage for each month in the destination data
    // Both datasets should have the same 2-year window
    const percentages = destination.map((d) => {
      const originTotal = originMap.get(d.date_month) || 0;
      const percentage =
        originTotal > 0 ? (d.total_count / originTotal) * 100 : 0;

      return {
        date_month: d.date_month,
        total_count: percentage,
      };
    });

    return percentages;
  }, [destinationQuery.data, originQuery.data]);

  // Only show when both origin and destination cells are selected
  const shouldDisplay = originCells.length > 0 && destinationCells.length > 0;

  if (!shouldDisplay) {
    return (
      <div className="flex h-16 items-center justify-center">
        <p className="text-sm font-light text-gray-500">
          Select origin and destination
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full cursor-default flex-col items-center">
      <div className="w-full">
        {percentageData && percentageData.length > 0 ? (
          <Sparkline
            data={percentageData}
            selectedDate={selectedMonth}
            title="% of origin trips"
            unit="%"
          />
        ) : (
          <div className="flex h-16 items-center justify-center">
            <p className="text-sm font-light text-gray-600">Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
};
