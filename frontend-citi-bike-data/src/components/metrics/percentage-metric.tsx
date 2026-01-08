import React, { useMemo } from "react";
import {
  useTripMonthlySumData,
  useOriginBaselineMonthlySumData,
} from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import { BasicChartWrapper } from "../charts/basic-chart-wrapper";

export const PercentageMetric: React.FC = () => {
  const { originCells, destinationCells, chartDatasetView } =
    useMapConfigStore();

  const selectedQuery = useTripMonthlySumData();
  const baselineQuery = useOriginBaselineMonthlySumData();

  const hasOrigin = originCells.length > 0;
  const hasDestination = destinationCells.length > 0;

  // Determine title based on selection
  const percentageTitle = useMemo(() => {
    if (hasOrigin && hasDestination) {
      return "Share of trips to destination (%)";
    } else if (hasOrigin && !hasDestination) {
      return "Share of system departures (%)";
    } else if (!hasOrigin && hasDestination) {
      return "Share of system arrivals (%)";
    }
    return "trips %";
  }, [hasOrigin, hasDestination]);

  // Calculate percentage data over the 4-year window
  const percentageData = useMemo(() => {
    if (!selectedQuery.data?.data || !baselineQuery.data) return undefined;
    const selected = selectedQuery.data.data;
    const baseline = baselineQuery.data;

    // Create a map for quick lookup of baseline totals by month
    const baselineMap = new Map(
      baseline.map((d) => [d.date_month, d.total_count]),
    );

    // Calculate percentage for each month in the selected data
    const percentages = selected.map((d) => {
      const baselineTotal = baselineMap.get(d.date_month) || 0;
      const share_percentage =
        baselineTotal > 0 ? (d.total_count / baselineTotal) * 100 : 0;

      const roundedPercentage = Math.round(share_percentage * 100) / 100;

      return {
        date_month: d.date_month,
        total_count: roundedPercentage,
      };
    });

    return percentages;
  }, [selectedQuery.data, baselineQuery.data]);

  const datasetConfigForPercentage = useMemo(
    () => ({
      rolling_avg: chartDatasetView === "rolling_avg",
      main: chartDatasetView === "main",
    }),
    [chartDatasetView],
  );

  // Show when at least origin OR destination is selected
  const shouldDisplay = hasOrigin || hasDestination;

  return (
    <div className="relative flex w-full flex-col items-center">
      {!shouldDisplay && (
        <div className="absolute z-10 flex h-full w-full items-center justify-center bg-white/10 text-center font-light text-gray-400 backdrop-blur-sm">
          <p>Select origin/destination for trip percentage chart</p>
        </div>
      )}
      <div className="w-full">
        <BasicChartWrapper
          title={percentageTitle}
          data={percentageData}
          unit="%"
          dataLoading={!percentageData}
          datasetConfig={datasetConfigForPercentage}
        />
      </div>
    </div>
  );
};
