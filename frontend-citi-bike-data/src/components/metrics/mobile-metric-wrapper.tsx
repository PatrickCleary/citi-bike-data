import React from "react";
import { useMapConfigStore } from "@/store/store";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import classNames from "classnames";
import dayjs from "dayjs";

interface MobileMetricWrapperProps {
  children: React.ReactNode;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

export const MobileMetricWrapper: React.FC<MobileMetricWrapperProps> = ({
  children,
  expanded,
  setExpanded,
}) => {
  return (
    <div className="flex w-full cursor-default flex-col gap-2 pt-2">
      {/* Header with menu button */}
      <div className="flex w-full items-center justify-between px-4">
        <MetricHeader />

        <button
          onClick={() => {
            setExpanded(!expanded);
          }}
        >
          <KeyboardArrowUpRoundedIcon
            fontSize="small"
            className={classNames(
              "text-gray-600 transition-transform duration-200 ease-in-out",
              expanded ? "rotate-180" : "rotate-0",
            )}
          />
        </button>
      </div>

      {/* Metric content */}
      <div className="flex w-full flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
};

export const MetricHeader: React.FC = (): React.ReactNode => {
  const { selectedMonth, originCells, destinationCells } = useMapConfigStore();
  const dateObj = dayjs(selectedMonth);
  const startDate = dateObj.format("MMMM YYYY");

  const getText = () => {
    if (destinationCells.length === 0 && originCells.length === 0) {
      return "Total trips";
    }
    if (originCells.length > 0 && destinationCells.length === 0) {
      return `Trips from origin`;
    }
    if (originCells.length === 0 && destinationCells.length > 0) {
      return `Trips to destination`;
    }
    return `Trips from origin to destination`;
  };
  return (
    <p className="flex flex-row items-baseline gap-1 text-xs font-light tracking-wide text-gray-700">
      {getText()} in {startDate}
    </p>
  );
};
