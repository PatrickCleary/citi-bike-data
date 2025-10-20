import React from "react";
import { useMapConfigStore } from "@/store/store";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import CheckIcon from "@mui/icons-material/Check";
import { AnalysisType } from "@/utils/api";
import classNames from "classnames";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";
import { useMetricsStore, MetricType } from "@/store/metrics-store";
import { TotalTripsMetric } from "./total-trips-metric";
import { ComparisonMetric } from "./comparison-metric";
import { SparklineMetric } from "./sparkline-metric";

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

const getDisplayText = (
  analysisType: AnalysisType,
  departureCells: string[],
) => {
  if (!departureCells || departureCells.length === 0) {
    return "System-wide";
  }
  if (departureCells.length >= 1) {
    return `${analysisType === "departures" ? "to" : "from"}`;
  }
};

interface MobileMetricWrapperProps {
  children: React.ReactNode;
}

export const MobileMetricWrapper: React.FC<MobileMetricWrapperProps> = ({
  children,
}) => {
  const { analysisType, departureCells } = useMapConfigStore();
  const { selectedMobileMetric, setSelectedMobileMetric } = useMetricsStore();
  const allMetrics: MetricType[] = ["total", "comparison", "sparkline"];

  return (
    <div className="flex w-full cursor-default flex-col rounded-md border-[0.5px] border-cb-white/40 bg-white/30 px-4 py-2 font-sans font-bold tracking-wide text-black drop-shadow-md backdrop-blur-md lg:hidden">
      {/* Header with menu button */}
      <div className="flex w-full items-center justify-between">
        <div className="invisible p-1">
          <MoreHorizIcon />
        </div>
        <p className="flex w-fit justify-center gap-[2px] px-4 text-nowrap rounded-full bg-black/5 font-light uppercase tracking-wider text-gray-600">
          {getDisplayText(analysisType, departureCells)}
          {departureCells.length > 0 && (
            <span className={classNames("flex items-center text-gray-900")}>
              <span>selection</span>
              <HexagonOutlinedIcon
                fontSize="inherit"
                className="ml-1 text-xs"
              />
            </span>
          )}
        </p>
        <Menu>
          <MenuButton className="flex items-center justify-center rounded-full p-1 focus:outline-none active:scale-95 active:bg-cb-white/30">
            <MoreHorizIcon fontSize="small" className="text-gray-600" />
          </MenuButton>
          <MenuItems
            anchor="bottom"
            transition
            className="fixed !inset-x-4 z-10 flex origin-top flex-col rounded-lg border-[0.5px] border-cb-lightGray bg-cb-white p-6 px-4 shadow-lg duration-100 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <p className="mb-4 px-2 py-1 text-lg font-light uppercase tracking-wide text-gray-500">
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
      <div className="flex flex-col items-center">{children}</div>
    </div>
  );
};
