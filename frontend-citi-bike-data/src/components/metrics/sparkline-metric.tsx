import React from "react";
import {
  useTripMonthlySumData,
  useBaselineMonthlySumData,
} from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import { Sparkline } from "../sparkline";

export const SparklineMetric: React.FC = () => {
  const { selectedMonth } = useMapConfigStore();
  const sumQuery = useTripMonthlySumData();
  const baselineQuery = useBaselineMonthlySumData();

  return (
    <div className="flex w-full cursor-default flex-col items-center">
      <div className="w-full">
        {baselineQuery.data ? (
          <Sparkline
            data={
              !!sumQuery.data?.data ? sumQuery.data.data : baselineQuery.data
            }
            baselineData={baselineQuery.data}
            selectedDate={selectedMonth}
            title={"Trips vs. baseline"}
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
