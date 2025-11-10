"use client";
import { useMetricsStore } from "@/store/metrics-store";
import { MobileMetricWrapper } from "./mobile-metric-wrapper";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import classNames from "classnames";
import { BasicMetric } from "./mobile-basic-metric";

import { useState, useMemo } from "react";
import { SparklineMetric } from "./sparkline-metric";
import { useTripMonthlySumData } from "@/map/map-config";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PercentageMetric } from "./percentage-metric";
import {
  Menu,
  MenuButton,
  MenuItems,
  MenuItem as HeadlessMenuItem,
} from "@headlessui/react";
import { ChartWindowTabs } from "./chart-window-tabs";
import { useMapConfigStore } from "@/store/store";
import { CHART_OPTIONS } from "../charts/basic-chart-wrapper";
import { buttonHoverStyle } from "../display-settings";

dayjs.extend(duration);

type ChartType = "sparkline" | "percentage";
const CHARTS: Array<{ type: ChartType; label: string }> = [
  { type: "sparkline", label: "Trips" },
  { type: "percentage", label: "Percentages" },
];

export const MobileMetricsContainer: React.FC = () => {
  const { selectedMobileMetric } = useMetricsStore();
  const { chartDatasetView, setChartDatasetView } = useMapConfigStore();

  const [expanded, setExpanded] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("sparkline");

  const sumQuery = useTripMonthlySumData();
  const data = sumQuery.data?.data;

  // Calculate the window size for the label
  const trendWindowSize = useMemo(() => {
    if (!data) return CHART_OPTIONS.smoothingWindowSize;
    return Math.min(
      CHART_OPTIONS.smoothingWindowSize,
      Math.floor(data.length / 3),
    );
  }, [data]);

  return (
    <div className="pointer-events-auto z-10 flex w-full flex-col items-center   bg-white lg:hidden">
      {/* Render the visible metrics */}
      <MobileMetricWrapper
        key={selectedMobileMetric}
        setExpanded={setExpanded}
        expanded={expanded}
      >
        <BasicMetric />
        <div
          className={classNames(
            "grid w-full bg-cb-white px-4 pb-2 transition-all duration-300 ease-in-out",
            expanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="bg overflow-hidden">
            <div className="flex flex-row items-center justify-between">
              <ChartWindowTabs />

              <Menu>
                <MenuButton className="flex h-10 w-10 items-center justify-center rounded-full text-cb-blue transition hover:bg-cb-blue/10 focus:outline-none active:scale-95">
                  <MoreHorizIcon fontSize="small" />
                </MenuButton>
                <MenuItems
                  anchor="bottom end"
                  transition
                  className="z-10 w-48 origin-top-right rounded-lg border-[0.5px] border-cb-lightGray bg-cb-white shadow-lg drop-shadow-md duration-100 ease-out [--anchor-gap:theme(spacing.1)] focus:outline-none data-[closed]:translate-y-1 data-[closed]:opacity-0"
                >
                  <div className="p-1">
                    <p className="px-3 py-2 text-xs font-light uppercase tracking-wide text-gray-400">
                      Data View
                    </p>
                    <HeadlessMenuItem>
                      <button
                        onClick={() => setChartDatasetView("main")}
                        className={classNames(
                          "w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-light tracking-wide text-cb-blue",
                          buttonHoverStyle,
                          chartDatasetView === "main" && "bg-cb-blue/30",
                        )}
                      >
                        Monthly
                      </button>
                    </HeadlessMenuItem>
                    <HeadlessMenuItem>
                      <button
                        onClick={() => setChartDatasetView("rolling_avg")}
                        className={classNames(
                          "w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-light tracking-wide text-cb-blue",
                          buttonHoverStyle,
                          chartDatasetView === "rolling_avg" && "bg-cb-blue/30",
                        )}
                      >
                        {trendWindowSize}-month avg
                      </button>
                    </HeadlessMenuItem>

                    <div className="my-1 h-[0.5px] bg-cb-lightGray" />

                    <p className="px-3 py-2 text-xs font-light uppercase tracking-wide text-gray-400">
                      Chart Type
                    </p>
                    {CHARTS.map((chart) => (
                      <HeadlessMenuItem key={chart.type}>
                        <button
                          onClick={() => setChartType(chart.type)}
                          className={classNames(
                            "w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-light tracking-wide text-cb-blue",
                            buttonHoverStyle,
                            chartType === chart.type && "bg-cb-blue/30",
                          )}
                        >
                          {chart.label}
                        </button>
                      </HeadlessMenuItem>
                    ))}
                  </div>
                </MenuItems>
              </Menu>
            </div>
            {chartType === "sparkline" && <SparklineMetric />}
            {chartType === "percentage" && <PercentageMetric />}
          </div>
        </div>
      </MobileMetricWrapper>
    </div>
  );
};
