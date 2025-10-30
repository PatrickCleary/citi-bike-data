import React from "react";
import {
  useBaselineMonthlySumData,
  useComparison,
  useTripCountData,
  useTripCountDataFilteredbyDestination,
} from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";

import dayjs from "dayjs";
import classNames from "classnames";
import { formatter } from "@/utils/utils";
import { Switch } from "@headlessui/react";

export const TestMetric: React.FC = () => {
  const { selectedMonth, comparisonDelta } = useMapConfigStore();
  const [unit, setUnit] = React.useState<"absolute" | "percent">("absolute");
  const dateObj = dayjs(selectedMonth);
  const originQuery = useBaselineMonthlySumData();

  const query = useTripCountData();
  const queryFiltered = useTripCountDataFilteredbyDestination(query);
  const comparisonDate = dateObj.subtract(comparisonDelta).format("MMMM YYYY");
  const comparison = useComparison();
  const isPositiveChange = comparison.absoluteChange > 0;
  const isBaselinePositive = comparison.baselineAbsoluteChange > 0;
  const totalTrips = queryFiltered?.data?.data.sum_all_values || 0;
  const totalTripsFromOrigin = query.data?.data.sum_all_values || 0;
  let percentTrips = (100 * totalTrips) / totalTripsFromOrigin;

  const thisMonthsTotal =
    originQuery.data?.find((item) => item["date_month"] === selectedMonth)
      ?.total_count || 0;
  const percentTripsOfTotal = (100 * totalTrips) / thisMonthsTotal;
  if (percentTrips === 100) percentTrips = percentTripsOfTotal;

  return (
    <div className="flex cursor-default flex-row items-center">
      <div className="flex items-center">
        <label className="mr-2">Toggle Unit:</label>
        <Switch
          checked={unit === "percent"}
          onChange={() => setUnit(unit === "absolute" ? "percent" : "absolute")}
          className={classNames(
            "relative inline-flex h-6 w-11 items-center rounded-full",
            {
              "bg-blue-600": unit === "percent",
              "bg-gray-200": unit === "absolute",
            },
          )}
        >
          <span className="sr-only">Toggle unit</span>
          <span
            className={classNames(
              "inline-block h-4 w-4 transform rounded-full bg-white transition",
              {
                "translate-x-6": unit === "percent",
                "translate-x-1": unit === "absolute",
              },
            )}
          />
        </Switch>
      </div>
      <div>
        Total trips:{" "}
        {formatter.format(unit === "absolute" ? totalTrips : percentTrips)} |
      </div>
      <div>
        change:{" "}
        {formatter.format(
          unit === "absolute"
            ? comparison.absoluteChange
            : comparison.percentageChange,
        )}
        |
      </div>
      <div>
        baseline change:
        {formatter.format(
          unit === "absolute"
            ? comparison.baselineAbsoluteChange
            : comparison.baselinePercentageChange,
        )}
      </div>
    </div>
  );
};
