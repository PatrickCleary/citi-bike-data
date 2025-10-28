import React from "react";
import { useMapConfigStore } from "@/store/store";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import CheckIcon from "@mui/icons-material/Check";
import { AnalysisType } from "@/utils/api";
import classNames from "classnames";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";
import { useMetricsStore, MetricType } from "@/store/metrics-store";
import { TotalTripsMetric } from "./total-trips-metric";
import { ComparisonMetric } from "./comparison-metric";
import { SparklineMetric } from "./sparkline-metric";
import dayjs from "dayjs";

const metricLabels: Record<MetricType, string> = {
  total: "Total Trips",
  comparison: "Year-over-Year",
  sparkline: "Trend",
};

const metricComponents: Record<MetricType, React.FC> = {
  total: TotalTripsMetric,
  comparison: ComparisonMetric,
  sparkline: SparklineMetric,
};

const getDisplayText = (analysisType: AnalysisType, originCells: string[]) => {
  if (!originCells || originCells.length === 0) {
    return "System-wide";
  }
  if (originCells.length >= 1) {
    return `${analysisType === "departures" ? "to" : "from"}`;
  }
};

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
  const { analysisType, originCells } = useMapConfigStore();
  const { selectedMobileMetric, setSelectedMobileMetric } = useMetricsStore();
  const allMetrics: MetricType[] = ["total", "comparison", "sparkline"];

  return (
    <div className="flex w-full cursor-default flex-col gap-2 rounded-md rounded-b-none border-[0.5px] bg-cb-white px-4 py-2 font-sans font-bold tracking-wide text-black drop-shadow-lg md:hidden">
      {/* Header with menu button */}
      <div className="flex w-full items-center justify-between">
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

        <Menu>
          {/* <MenuButton className="flex items-center justify-center rounded-full p-1 focus:outline-none active:scale-95 active:bg-cb-white/30">
              <MoreHorizIcon fontSize="small" className="text-gray-600" />
            </MenuButton> */}
          <MenuItems
            anchor="bottom"
            transition
            className="fixed !inset-x-4 z-10 flex origin-top flex-col rounded-lg border-[0.5px] border-cb-lightGray bg-cb-white p-6 px-4 shadow-lg duration-100 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <p className="mb-4 px-2 py-1 text-sm font-light uppercase tracking-wide text-gray-500">
              Metrics
            </p>
            <div className="flex flex-col gap-4">
              {allMetrics.map((metricType) => {
                const isSelected = selectedMobileMetric === metricType;
                const MetricComponent = metricComponents[metricType];

                return (
                  <MenuItem key={metricType}>
                    <button
                      onClick={() => setSelectedMobileMetric(metricType)}
                      className={classNames(
                        "relative w-full rounded-lg transition-all",
                        isSelected && "ring-2 ring-cb-blue ring-offset-2",
                      )}
                    >
                      {/* Full metric card */}
                      <div className="pointer-events-none flex w-full cursor-default flex-col items-center rounded-md border-[0.5px] border-cb-white/40 bg-white/30 px-4 py-2 font-sans font-bold tracking-wide text-black drop-shadow-md backdrop-blur-md">
                        <p className="mb-1 flex w-full justify-center gap-[2px] rounded-sm font-light uppercase tracking-wider text-gray-600">
                          {metricLabels[metricType]}
                        </p>
                        <div className="w-full">
                          <MetricComponent />
                        </div>
                      </div>
                      {/* Check icon for selected state */}
                      {isSelected && (
                        <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-cb-blue shadow-md">
                          <CheckIcon fontSize="small" className="text-white" />
                        </div>
                      )}
                    </button>
                  </MenuItem>
                );
              })}
            </div>
          </MenuItems>
        </Menu>
      </div>

      {/* Metric content */}
      <div className="flex w-full flex-col items-center justify-center gap-4">
        {children}
      </div>
    </div>
  );
};

export const MetricHeader: React.FC = (): React.ReactNode => {
  const { selectedMonth, originCells, destinationCells } = useMapConfigStore();
  const dateObj = dayjs(selectedMonth);
  const startDate = dateObj.format("MMM YYYY");

  const getText = () => {
    if (destinationCells.length === 0 && originCells.length === 0) {
      return "Total";
    }
    if (originCells.length > 0 && destinationCells.length === 0) {
      return `from origin`;
    }
    if (originCells.length === 0 && destinationCells.length > 0) {
      return `To destination`;
    }
    return `Origin to destination`;
  };
  return (
    <p className="flex flex-row items-baseline gap-1 text-xs font-light uppercase text-gray-700">
      <span className="flex w-[80px] justify-center rounded-md border border-[0.5px] border-white/10 bg-cb-lightGray tabular-nums">
        {startDate}
      </span>
      • {getText()}
    </p>
  );
};
