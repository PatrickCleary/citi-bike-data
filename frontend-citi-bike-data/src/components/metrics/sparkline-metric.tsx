import React from "react";
import {
  useTripMonthlySumData,
  useBaselineMonthlySumData,
} from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import { Sparkline } from "../sparkline";

export const SparklineMetric: React.FC = () => {
  const { originCells, selectedMonth, analysisType } = useMapConfigStore();
  const sumQuery = useTripMonthlySumData();
  const baselineQuery = useBaselineMonthlySumData();

  return (
    <div className="flex w-full cursor-default flex-col items-center">
      <div className="w-full">
        {baselineQuery.data ? (
          <Sparkline
            data={
              originCells.length > 0 && sumQuery.data?.data
                ? sumQuery.data.data
                : baselineQuery.data
            }
            baselineData={
              originCells.length > 0 ? baselineQuery.data : undefined
            }
            selectedDate={selectedMonth}
            title={
              originCells.length > 0
                ? analysisType === "departures"
                  ? "Departing trips"
                  : "Arriving trips"
                : "Trips"
            }
            unit=" trips"
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
