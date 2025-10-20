import React from "react";
import { useTripCountData } from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import dayjs from "dayjs";
import { AnimatedNumber } from "../other/animated-digits";

export const TotalTripsMetric: React.FC = () => {
  const { selectedMonth } = useMapConfigStore();
  const dateObj = dayjs(selectedMonth);
  const startDate = dateObj.format("MMMM YYYY");
  const query = useTripCountData();
  const totalTrips = query.data?.data.sum_all_values || 0;

  return (
    <div className="flex cursor-default flex-col items-center">
      <div className="flex w-full flex-row justify-center gap-1 text-left">
        {query.isLoading ? (
          <span className="animate-pulse text-xl tabular-nums tracking-wider text-gray-900 blur-sm">
            12,345
            <span className="ml-2 font-light uppercase">Trips</span>
          </span>
        ) : (
          <p>
            <AnimatedNumber value={totalTrips} className="text-gray-900" />
            <span className="ml-2 font-light uppercase">Trips</span>
          </p>
        )}
      </div>
      <h4 className="cursor-default text-xs font-light uppercase tracking-wider text-gray-900">
        {startDate}
      </h4>
    </div>
  );
};
