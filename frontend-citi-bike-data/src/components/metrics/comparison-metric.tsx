import React from "react";
import { useComparison } from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import dayjs from "dayjs";
import classNames from "classnames";
import { AnimatedNumber } from "../other/animated-digits";
import { TripsText } from "./total-trips-metric";

export const ComparisonMetric: React.FC = () => {
  const { selectedMonth } = useMapConfigStore();
  const dateObj = dayjs(selectedMonth);

  const previousMonthDate = dateObj.subtract(1, "year").format("MMMM YYYY");
  const comparison = useComparison();
  const isPositiveChange = comparison.absoluteChange > 0;

  return (
    <div className="flex cursor-default flex-col items-center">
      <div className="flex flex-col items-center gap-0.5">
        <div
          className={classNames(
            "flex items-center gap-1 text-xl font-medium tabular-nums",
            isPositiveChange ? "text-cb-increase" : "text-cb-decrease",
          )}
        >
          {isPositiveChange ? (
            <TrendingUpIcon
              fontSize="medium"
              className={comparison.isLoading ? "invisible" : ""}
            />
          ) : (
            <TrendingDownIcon
              fontSize="medium"
              className={comparison.isLoading ? "invisible" : ""}
            />
          )}
          {comparison.isLoading ? (
            <span className="animate-pulse tabular-nums text-gray-900 blur-sm">
              +12,345
              <TripsText />
            </span>
          ) : (
            <span>
              {isPositiveChange ? "+" : ""}
              <AnimatedNumber
                value={Math.abs(comparison.absoluteChange)}
                className={
                  isPositiveChange ? "text-cb-increase" : "text-cb-decrease"
                }
              />
              <TripsText />
            </span>
          )}
        </div>
        <span
          className={classNames(
            "text-sm font-medium",
            isPositiveChange ? "text-cb-increase" : "text-cb-decrease",
          )}
        >
          {comparison.isLoading ? (
            <span className="animate-pulse text-gray-900 blur-sm">
              (+12.3%)
            </span>
          ) : (
            <>
              ({isPositiveChange ? "+" : ""}
              {comparison.percentageChange.toFixed(1)}%)
            </>
          )}
        </span>
      </div>
      <p className="text-xs font-light uppercase text-gray-500">
        vs {previousMonthDate}
      </p>
    </div>
  );
};
