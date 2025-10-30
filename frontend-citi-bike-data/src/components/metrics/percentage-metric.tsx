import React, { useMemo } from "react";
import {
  useTripMonthlySumData,
  useBaselineMonthlySumData,
} from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import { BasicChartWrapper } from "../charts/basic-chart-wrapper";

export const PercentageMetric: React.FC = () => {
  const {
    originCells,
    destinationCells,
    setOriginCells,
    setDestinationCells,
    chartDatasetView,
  } = useMapConfigStore();

  const selectedQuery = useTripMonthlySumData();
  const baselineQuery = useBaselineMonthlySumData();

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

  if (!shouldDisplay) {
    return (
      <div className="flex h-16 items-center justify-center text-gray-500">
        <p className="text-sm font-light">Select origin or destination</p>
        <button
          className="hover:bg-cb-darkBlue ml-4 rounded bg-cb-blue px-3 py-1 text-sm font-medium text-cb-white"
          onClick={() => {
            setOriginCells([
              "892a100dbd3ffff",
              "892a100d86fffff",
              "892a100d86bffff",
              "892a100dbd7ffff",
            ]);
            setDestinationCells([
              "892a100d84bffff",
              "892a100da87ffff",
              "892a100da97ffff",
              "892a100d85bffff",
              "892a100d843ffff",
            ]);
          }}
        >
          bedford
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <div className="w-full">
        <BasicChartWrapper
          title={percentageTitle}
          data={percentageData}
          unit="%"
          dataLoading={!percentageData}
          datasetConfig={datasetConfigForPercentage}
          showDatasetToggles={false}
        />
      </div>
    </div>
  );
};
