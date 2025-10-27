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
        {queryFiltered.isLoading ? (
          <p className="w-[6rem] shrink-0 animate-pulse text-nowrap tabular-nums tracking-wider text-gray-900 blur-sm">
            <span className="hidden text-xl sm:inline">12,345</span>
            <span className="inline text-xl sm:hidden">
              {formatter.format(12_345)}
            </span>{" "}
            <TripsText />
          </p>
        ) : (
          <p className="w-[6rem] shrink-0 text-nowrap">
            <AnimatedNumber
              value={totalTrips}
              className="hidden text-xl text-gray-900 sm:flex"
            />
            <AnimatedNumber
              value={formatter.format(totalTrips)}
              className="text-xl text-gray-900 sm:hidden"
            />{" "}
            <TripsText />
          </p>
        )}
        {/* <div className="inline-flex items-baseline gap-[4px] bg-blue-400 px-2 py-1">
          <TrendingUpIcon fontSize="small" className="self-center" />
          <p className="text-sm">12.3%</p>
        </div>
        <p className="text-xs">From prev year</p> */}

        <TripDeltaBadge />
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

const DeltaAbsoluteNumber: React.FC<{
  absoluteChange: number;
  isLoading: boolean;
  isPositive: boolean;
}> = ({ absoluteChange, isLoading, isPositive }) => {
  if (isLoading)
    return (
      <span className="animate-pulse tabular-nums text-gray-900 blur-sm">
        +{formatter.format(12_345)}
      </span>
    );
  return (
    <span>
      {isPositive ? "+" : "-"}
      <AnimatedNumber
        value={formatter.format(Math.abs(absoluteChange))}
        className={isPositive ? "text-cb-increase" : "text-cb-decrease"}
      />
    </span>
  );
};

const ComparisonCard: React.FC<{}> = () => {
  const { selectedMonth, comparisonDelta } = useMapConfigStore();
  const dateObj = dayjs(selectedMonth);

  const comparison = useComparison();
  const isPositiveChange = comparison.absoluteChange > 0;
  const comparisonDate = dateObj.add(comparisonDelta).format("MMMM YYYY");

  return (
    <div
      className={classNames(
        {
          "border-cb-lightGray/10 bg-cb-lightGray/20": comparison.isLoading,
          "bg-cb-increase-pastel/50 border-cb-increase/10":
            !comparison.isLoading && isPositiveChange,
          "bg-cb-decrease-pastel/50 border-cb-decrease/10":
            !comparison.isLoading && !isPositiveChange,
        },
        "flex w-full flex-col rounded-md border-[0.5px] px-4 py-1 drop-shadow-sm",
      )}
    >
      <div
        className={classNames(
          "flex items-center gap-1 text-lg font-medium tabular-nums sm:text-xl",
          isPositiveChange ? "text-cb-increase" : "text-cb-decrease",
        )}
      >
        <TrendIcon
          isPositive={isPositiveChange}
          isLoading={comparison.isLoading}
        />
        <DeltaAbsoluteNumber
          absoluteChange={comparison.absoluteChange}
          isLoading={comparison.isLoading}
          isPositive={isPositiveChange}
        />
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
        Vs {comparisonDelta.humanize(true)}
      </p>
    </div>
  );
};

// const BaselineComparison:React.FC = () => {
//     {comparison.showBaseline && !comparison.isLoading && (
//         <span className="text-xs font-light text-gray-500">
//           {comparison.baselineLabel}: {isBaselinePositive ? "+" : ""}
//           {comparison.baselinePercentageChange.toFixed(1)}%
//         </span>
//       )}
// }

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
