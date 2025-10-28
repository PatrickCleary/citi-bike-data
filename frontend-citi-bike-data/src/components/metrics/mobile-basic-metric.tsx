import React from "react";
import {
  useComparison,
  useTripCountData,
  useTripCountDataFilteredbyDestination,
} from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import dayjs from "dayjs";
import classNames from "classnames";
import { AnimatedNumber } from "../other/animated-digits";
import { TripsText } from "./total-trips-metric";
import { formatter } from "@/utils/utils";

import relativeTime from "dayjs/plugin/relativeTime"; // For humanize()
import { SvgIconOwnProps } from "@mui/material/SvgIcon";
dayjs.extend(relativeTime);

export const MobileBasicMetric: React.FC = () => {
  const { selectedMonth } = useMapConfigStore();

  const query = useTripCountData();
  const queryFiltered = useTripCountDataFilteredbyDestination(query);
  const totalTrips = queryFiltered?.data?.data.sum_all_values || 0;

  return (
    <div className="flex w-full cursor-default">
      <div className="flex w-full flex-row flex-nowrap items-baseline gap-2">
        <DeltaComparedToOriginBadge />
      </div>
    </div>
  );
};

const TrendIcon: React.FC<{
  isPositive: boolean;
  isLoading: boolean;
  fontSize?: SvgIconOwnProps["fontSize"];
  className?: string;
}> = ({ isPositive, isLoading, fontSize = "medium", className }) => {
  if (isLoading)
    return (
      <TrendingUpIcon
        fontSize={fontSize}
        className={classNames(className, "animate-pulse text-gray-700 blur-sm")}
      />
    );
  if (isPositive)
    return (
      <TrendingUpIcon
        fontSize={fontSize}
        className={classNames(className, isLoading ? "invisible" : "")}
      />
    );

  return (
    <TrendingDownIcon
      fontSize={fontSize}
      className={classNames(className, isLoading ? "invisible" : "")}
    />
  );
};

const TripDeltaBadge: React.FC<{}> = () => {
  const { selectedMonth, comparisonDelta } = useMapConfigStore();
  const dateObj = dayjs(selectedMonth);

  const comparison = useComparison();
  const isPositiveChange = comparison.absoluteChange > 0;

  return (
    <div
      className={classNames(
        "flex flex-1 flex-row items-baseline gap-1 rounded-md",
      )}
    >
      <div
        className={classNames(
          {
            "text-cb-gray-700 border-cb-lightGray/10 bg-cb-lightGray":
              comparison.isLoading,
            "text-cb-increase-pastel border-cb-increase/10 bg-cb-increase":
              !comparison.isLoading && isPositiveChange,
            "text-cb-decrease-pastel border-cb-decrease/10 bg-cb-decrease":
              !comparison.isLoading && !isPositiveChange,
          },
          "inline-flex items-baseline rounded-full px-2 py-[2px] text-lg text-sm font-medium tabular-nums sm:text-xl",
        )}
      >
        <TrendIcon
          isPositive={isPositiveChange}
          isLoading={comparison.isLoading}
          fontSize="small"
          className="self-center"
        />
        <span
          className={classNames(
            "flex w-14 justify-center text-sm font-medium tabular-nums",
          )}
        >
          {comparison.isLoading ? (
            <span className="animate-pulse text-gray-900 blur-sm">+12.3%</span>
          ) : (
            <>
              {isPositiveChange ? "+" : ""}
              {formatter.format(comparison.percentageChange)}%
            </>
          )}
        </span>
      </div>
      <p className="text-xs font-light uppercase tracking-wider text-gray-700">
        VS {dateObj.add(comparisonDelta).format("MMM 'YY")}
      </p>
    </div>
  );
};

const DeltaComparedToOriginBadge: React.FC<{}> = () => {
  const comparison = useComparison();
  const { originCells, destinationCells, selectedMonth, comparisonDelta } =
    useMapConfigStore();

  // Don't show anything if no cells are selected
  if (originCells.length === 0 && destinationCells.length === 0) {
    return null;
  }

  const isPositiveChange = comparison.normalizedPercentageChange > 0;
  const dateObj = dayjs(selectedMonth);
  const comparisonDate = dateObj.add(comparisonDelta).format("MMM YYYY");

  // Determine subtext based on selection
  const hasOrigin = originCells.length > 0;
  const hasDestination = destinationCells.length > 0;
  const baseComparison =
    hasOrigin && hasDestination ? "trips from Origin" : "system-wide trips";
  const subtext = `vs ${comparisonDate} ${baseComparison}`;

  return (
    <div className="flex w-full flex-col gap-0.5">
      <div className="flex flex-row items-center justify-between gap-3">
        <div
          className={classNames(
            {
              "text-cb-gray-700 border-cb-lightGray/10 bg-cb-lightGray":
                comparison.isLoading,
              "text-cb-increase-pastel border-cb-increase/10 bg-cb-increase":
                !comparison.isLoading && isPositiveChange,
              "text-cb-decrease-pastel border-cb-decrease/10 bg-cb-decrease":
                !comparison.isLoading && !isPositiveChange,
            },
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-base font-medium tabular-nums sm:text-lg",
          )}
        >
          <TrendIcon
            isPositive={isPositiveChange}
            isLoading={comparison.isLoading}
            fontSize="small"
            className="mr-0.5"
          />
          <span className="tabular-nums">
            {comparison.isLoading ? (
              <span className="animate-pulse text-gray-900 blur-sm">
                +12.3%
              </span>
            ) : (
              <>
                {isPositiveChange ? "+" : ""}
                {formatter.format(comparison.normalizedPercentageChange)}%
              </>
            )}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0 text-xs font-light leading-tight text-gray-600">
          <span className="tabular-nums">
            {comparison.isLoading ? (
              <span className="animate-pulse blur-sm">12K trips</span>
            ) : (
              <>{formatter.format(comparison.currentTotal)} trips</>
            )}
          </span>
          <span className="text-xs tabular-nums uppercase tracking-wide opacity-75">
            {comparison.isLoading ? (
              <span className="animate-pulse blur-sm">+12% vs Sep 24</span>
            ) : (
              <>
                {comparison.percentageChange > 0 ? "+" : ""}
                {formatter.format(comparison.percentageChange)}% vs{" "}
                {dateObj.add(comparisonDelta).format("MMM 'YY")}
              </>
            )}
          </span>
        </div>
      </div>
      <p className="text-xs font-light uppercase tracking-wide text-gray-500 opacity-75">
        {subtext}
      </p>
    </div>
  );
};
