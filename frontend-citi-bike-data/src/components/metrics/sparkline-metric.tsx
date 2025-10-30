import React, { useMemo, useState } from "react";
import {
  useTripMonthlySumData,
  useBaselineMonthlySumData,
} from "@/map/map-config";
import { BasicChartWrapper } from "../charts/basic-chart-wrapper";
import { useMapConfigStore } from "@/store/store";

export const SparklineMetric: React.FC = () => {
  const sumQuery = useTripMonthlySumData();
  const baselineQuery = useBaselineMonthlySumData();
  const { chartDatasetView, originCells, destinationCells } =
    useMapConfigStore();
  const [showBaseline, setShowBaseline] = useState(true);

  const datasetConfig = useMemo(
    () => ({
      rolling_avg: chartDatasetView === "rolling_avg",
      main: chartDatasetView === "main",
      baseline: showBaseline,
    }),
    [chartDatasetView, showBaseline],
  );

  // Check if we have both origin and destination selected (for baseline toggle)
  const hasBaselineData = originCells.length > 0 && destinationCells.length > 0;

  return (
    <div className="flex w-full flex-col items-center">
      <div className="w-full">
        <BasicChartWrapper
          data={!!sumQuery.data?.data ? sumQuery.data.data : baselineQuery.data}
          baselineData={baselineQuery.data}
          unit=" trips"
          dataLoading={!baselineQuery.data}
          datasetConfig={datasetConfig}
          showDatasetToggles={false}
          title={"Trips vs. Baseline"}
        >
          <ToggleBaselineButton
            showBaseline={showBaseline}
            setShowBaseline={setShowBaseline}
          />
        </BasicChartWrapper>
      </div>
    </div>
  );
};

const ToggleBaselineButton: React.FC<{
  showBaseline: boolean;
  setShowBaseline: (show: boolean) => void;
}> = ({ showBaseline, setShowBaseline }) => {
  return (
    <button
      onClick={() => setShowBaseline(!showBaseline)}
      className="flex items-center gap-2 rounded-full px-2 py-1 text-xs font-light transition-all hover:opacity-80"
      title="Toggle Baseline"
    >
      <span className="text-gray-600">Baseline</span>
      <div
        className={`relative h-4 w-8 rounded-full transition-colors ${
          showBaseline ? "bg-cb-blue" : "bg-gray-300"
        }`}
      >
        <div
          className={`absolute top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
            showBaseline ? "translate-x-[1.125rem]" : "translate-x-0.5"
          }`}
        ></div>
      </div>
    </button>
  );
};
