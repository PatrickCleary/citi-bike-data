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
    <div className="flex w-full cursor-default bg-white px-4 pb-2 drop-shadow-sm lg:mb-0 lg:px-0 lg:drop-shadow-none">
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

const DeltaComparedToOriginBadge: React.FC = () => {
  const comparison = useComparison();
  const { selectedMonth, comparisonDelta } = useMapConfigStore();

  const isPositiveChange = comparison.percentageChange > 0;
  const dateObj = dayjs(selectedMonth);
  const compDate = dateObj.add(comparisonDelta);
  const compDateString = compDate.format("MMM 'YY");

  return (
    <div className="flex w-full flex-col gap-2 lg:gap-4">
      <div className="flex flex-col justify-between gap-1 md:gap-1 lg:flex-col lg:items-start">
        <div className="flex flex-col items-start gap-0 text-xs font-light leading-tight text-gray-600">
          <span className="tabular-nums">
            <LoadingNumber
              value={comparison.currentTotal}
              isLoading={comparison.isLoading}
              className="text-xl font-semibold tabular-nums tracking-wider text-gray-900 lg:text-3xl"
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
              className="text-sm tabular-nums tracking-wider lg:text-base"
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

const ContextTextWrapper: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div className="flex flex-col items-start gap-1 rounded-md border-[0.5px] border-gray-300 bg-gray-200 px-2 py-1">
    {children}
  </div>
);

const PercentageChange: React.FC<{
  value: number;
  isLoading: boolean;
  isPositive: boolean;
  isNegative: boolean;
}> = ({ value, isLoading, isPositive, isNegative }) => (
  <span
    className={classNames("font-semibold", {
      "text-cb-increase": isPositive,
      "text-cb-decrease": isNegative,
      "text-gray-700": !isPositive && !isNegative,
    })}
  >
    <LoadingNumber
      value={formatter.format(Math.abs(value))}
      isLoading={isLoading}
      className="tabular-nums"
    />
    %
  </span>
);

export const ContextText: React.FC<{ compDate: dayjs.Dayjs }> = ({
  compDate,
}) => {
  const { destinationCells, originCells } = useMapConfigStore();
  const comparison = useComparison();
  if (destinationCells.length === 0 && originCells.length === 0) {
    return null;
  }

  const isPositive = comparison.normalizedPercentageChange > 0;
  const isNegative = comparison.normalizedPercentageChange < 0;

  const getText = () => {
    if (destinationCells.length > 0 && originCells.length > 0) {
      return "Trips on this route are ";
    }
    if (originCells.length > 0 && destinationCells.length === 0) {
      return "Trips from origin are ";
    }
    if (originCells.length === 0 && destinationCells.length > 0) {
      return "Trips to destination are ";
    }
  };

  if (originCells.length > 0 || destinationCells.length > 0) {
    return (
      <ContextTextWrapper>
        <div className="flex flex-row items-center gap-2">
          <ChangeIcon isNegative={isNegative} isPositive={isPositive} />

          <p className="font-base text-xs text-gray-600">
            {getText()}
            {isPositive ? "up" : "down"}{" "}
            <PercentageChange
              isLoading={comparison.isLoading}
              value={comparison.normalizedPercentageChange}
              isPositive={isPositive}
              isNegative={isNegative}
            />{" "}
            vs {compDate.format("MMM YYYY")}{" "}
            <span className="font-bold">relative to system-wide traffic.</span>
          </p>
        </div>
        <p className="flex w-full flex-row justify-center rounded-full bg-gray-300 text-center text-xs italic text-gray-500">
          System-wide traffic{" "}
          {comparison.baselinePercentageChange > 0 ? "up" : "down"}
          <LoadingNumber
            value={formatter.format(
              Math.abs(comparison.baselinePercentageChange),
            )}
            isLoading={comparison.isLoading}
            className="ml-[3px] tabular-nums"
          />
          %
        </p>
      </ContextTextWrapper>
    );
  }

  return null;
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
