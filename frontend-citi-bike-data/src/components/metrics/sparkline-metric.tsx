import React from "react";
import {
  useTripMonthlySumData,
  useBaselineMonthlySumData,
} from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import { Sparkline } from "../sparkline";
import dayjs from "dayjs";

export const SparklineMetric: React.FC = () => {
  const { selectedMonth } = useMapConfigStore();
  const sumQuery = useTripMonthlySumData();
  const baselineQuery = useBaselineMonthlySumData();
  const title = "Trips vs. Baseline";

  return (
    <div className="flex w-full cursor-default flex-col items-center">
      <div className="w-full">
        <div className="relative flex w-full flex-col">
          {title && (
            <h3 className="mb-2 font-outfit text-sm font-light text-gray-500 md:hidden">
              {title}
            </h3>
          )}
          {baselineQuery.data ? (
            <Sparkline
              data={
                !!sumQuery.data?.data ? sumQuery.data.data : baselineQuery.data
              }
              baselineData={baselineQuery.data}
              selectedDate={selectedMonth}
              unit=" trips"
            />
          ) : (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm font-light text-gray-600">Loading...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
