import React from "react";
import {
  useTripCountData,
  useTripCountDataFilteredbyDestination,
} from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import dayjs from "dayjs";
import { AnimatedNumber } from "../other/animated-digits";
import { formatter } from "@/utils/utils";

export const TotalTripsMetric: React.FC = () => {
  const { selectedMonth } = useMapConfigStore();
  const dateObj = dayjs(selectedMonth);
  const startDate = dateObj.format("MMMM YYYY");
  const query = useTripCountData();
  const queryFiltered = useTripCountDataFilteredbyDestination(query);
  const totalTrips = queryFiltered?.data?.data.sum_all_values || 0;

  return (
    <div className="flex cursor-default flex-col items-center">
      <div className="flex w-full flex-row items-center justify-center gap-1 text-nowrap text-left text-lg sm:text-xl">
        {queryFiltered.isLoading ? (
          <span className="animate-pulse tabular-nums tracking-wider text-gray-900 blur-sm ">
            <span className="hidden sm:block">12,345</span>
            <span className="block sm:hidden">{formatter.format(12_345)}</span>
            <TripsText />
          </span>
        ) : (
          <p>
            <AnimatedNumber
              value={totalTrips}
              className="hidden text-gray-900 sm:flex tracking-wider"
            />
            <AnimatedNumber
              value={formatter.format(totalTrips)}
              className="text-gray-900 sm:hidden tracking-wider"
            />
            <TripsText />
          </p>
        )}
      </div>
      <h4 className="cursor-default text-xs font-light uppercase tracking-wider text-gray-500">
        <span className="hidden sm:block">{startDate}</span>
        <span className="block sm:hidden">{dateObj.format("MMM 'YY")}</span>
      </h4>
    </div>
  );
};

export const TripsText: React.FC = () => {
  return (
    <span className="text-sm font-medium uppercase text-gray-700 sm:ml-2">
      Trips
    </span>
  );
};
