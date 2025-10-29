import React from "react";
import { useComparison } from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import dayjs from "dayjs";
import classNames from "classnames";
import { formatter } from "@/utils/utils";
import TrendingFlatRoundedIcon from "@mui/icons-material/TrendingFlatRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDown";

import relativeTime from "dayjs/plugin/relativeTime"; // For humanize()
import { SvgIconOwnProps } from "@mui/material/SvgIcon";
import { LoadingNumber } from "../other/loading-number";
import { Subtext } from "../basic/subtext";
dayjs.extend(relativeTime);

export const BasicMetric: React.FC = () => {
  return (
    <div className="pb-2 flex w-full cursor-default lg:mb-0 lg:px-0 px-4 drop-shadow-sm lg:drop-shadow-none bg-white">
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
      <TrendingUpRoundedIcon
        fontSize={fontSize}
        className={classNames(className, "animate-pulse text-gray-700 blur-sm")}
      />
    );
  if (isPositive)
    return (
      <TrendingUpRoundedIcon
        fontSize={fontSize}
        className={classNames(className, isLoading ? "invisible" : "")}
      />
    );

  return (
    <TrendingDownRoundedIcon
      fontSize={fontSize}
      className={classNames(className, isLoading ? "invisible" : "")}
    />
  );
};

const DeltaComparedToOriginBadge: React.FC<{}> = () => {
  const comparison = useComparison();
  const { selectedMonth, comparisonDelta } = useMapConfigStore();

  const isPositiveChange = comparison.percentageChange > 0;
  const dateObj = dayjs(selectedMonth);
  const compDate = dateObj.add(comparisonDelta);
  const compDateString = compDate.format("MMM 'YY");

  return (
    <div className="flex w-full flex-col gap-2 lg:gap-4">
      <div className="flex flex-col justify-between gap-1 md:gap-1 lg:flex-col lg:items-start ">
        <div className="flex flex-col items-start gap-0 text-xs font-light leading-tight text-gray-600">
          <span className="tabular-nums">
            <LoadingNumber
              value={formatter.format(comparison.currentTotal)}
              isLoading={comparison.isLoading}
              className="text-xl font-semibold tabular-nums text-gray-900 lg:text-3xl"
            />{" "}
            <Subtext>Trips</Subtext>
          </span>
        </div>
        <div className="flex w-full flex-row items-baseline gap-2">
          <div
            className={classNames(
              {
                "text-cb-gray-700 border-cb-lightGray/10 bg-cb-lightGray":
                  comparison.isLoading,
                "border-cb-increase/10 bg-cb-increase text-cb-white":
                  !comparison.isLoading && isPositiveChange,
                "border-cb-decrease/10 bg-cb-decrease text-cb-white":
                  !comparison.isLoading && !isPositiveChange,
              },
              "inline-flex items-baseline text-nowrap rounded-full px-2.5 py-0.5 text-base font-medium tabular-nums",
            )}
          >
            <TrendIcon
              isPositive={isPositiveChange}
              isLoading={comparison.isLoading}
              fontSize="small"
              className="mr-[4px] self-center"
            />

            <LoadingNumber
              value={
                formatter.format(Math.abs(comparison.percentageChange)) + "%"
              }
              isLoading={comparison.isLoading}
              className="text-sm tabular-nums lg:text-base"
            />
          </div>

          <Subtext>
            vs {compDateString} ({formatter.format(comparison.previousTotal)}{" "}
            trips)
          </Subtext>
        </div>
      </div>
      <ContextText compDate={compDate} />
    </div>
  );
};

export const ContextText: React.FC<{ compDate: dayjs.Dayjs }> = ({
  compDate,
}) => {
  const { destinationCells, originCells, selectedMonth, comparisonDelta } =
    useMapConfigStore();
  const comparison = useComparison();
  if (destinationCells.length === 0 && originCells.length === 0) {
    return (
      <p className="text-xs font-light text-gray-600">
        {/* System-wide traffic has increased{" "}
        {formatter.format(comparison.percentageChange)}% since{" "}
        {compDate.format("MMM YYYY")} */}
      </p>
    );
  }
  if (originCells.length > 0 && destinationCells.length === 0) {
    const isPositive = comparison.normalizedPercentageChange > 0;
    const isNegative = comparison.normalizedPercentageChange < 0;
    return (
      <div className="flex flex-row items-center gap-2 rounded-md border-[0.5px] border-gray-300 bg-gray-200 px-2 py-1">
        <ChangeIcon isNegative={isNegative} isPositive={isPositive} />

        <p className="text-xs font-light text-gray-600">
          Traffic from here is {isPositive ? "up" : "down"}{" "}
          {formatter.format(Math.abs(comparison.normalizedPercentageChange))}%
          vs {compDate.format("MMM YYYY")}{" "}
          <span className="font-semibold">
            relative to system-wide traffic.
          </span>
        </p>
      </div>
    );
  }
  if (originCells.length > 0 && destinationCells.length > 0) {
    const isPositive = comparison.normalizedPercentageChange > 0;
    const isNegative = comparison.normalizedPercentageChange < 0;
    return (
      <div className="flex flex-row items-center gap-2 rounded-md border-[0.5px] border-gray-300 bg-gray-200 px-2 py-1">
        <ChangeIcon isNegative={isNegative} isPositive={isPositive} />

        <p className="text-xs font-light text-gray-600">
          Traffic on this route is {isPositive ? "up" : "down"}{" "}
          <span
            className={classNames("font-semibold", {
              "text-cb-increase": isPositive,
              "text-cb-decrease": isNegative,
              "text-gray-700": !isPositive && !isNegative,
            })}
          >
            {formatter.format(Math.abs(comparison.normalizedPercentageChange))}%
          </span>{" "}
          vs {compDate.format("MMM 'YY")}{" "}
          <span className="font-semibold">
            relative to traffic leaving the origin.
          </span>
        </p>
      </div>
    );
  }
  return <p>none</p>;
};

export const ChangeIcon: React.FC<{
  isNegative: boolean;
  isPositive: boolean;
}> = ({ isNegative, isPositive }) => {
  if (isNegative)
    return (
      <TrendingDownRoundedIcon
        fontSize="small"
        className={classNames("text-cb-decrease")}
      />
    );
  if (isPositive)
    return (
      <TrendingUpRoundedIcon
        fontSize="small"
        className={classNames("text-cb-increase")}
      />
    );
  return (
    <TrendingFlatRoundedIcon
      fontSize="small"
      className={classNames("text-gray-700")}
    />
  );
};
