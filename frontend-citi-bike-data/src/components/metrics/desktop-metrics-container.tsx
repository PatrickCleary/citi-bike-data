"use client";
import { useMetricsStore } from "@/store/metrics-store";
import { MobileMetricWrapper } from "./mobile-metric-wrapper";
import classNames from "classnames";
import { useMapConfigStore } from "@/store/store";
import { MobileBasicMetric } from "./mobile-basic-metric";
import { useState } from "react";
import { SparklineMetric } from "./sparkline-metric";
import { useComparison } from "@/map/map-config";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Tab, TabGroup, TabList } from "@headlessui/react";
import { PercentageMetric } from "./percentage-metric";

dayjs.extend(duration);

export const DesktopMetricsContainer: React.FC = () => {
  const { selectedMobileMetric } = useMetricsStore();

  const comparison = useComparison();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pointer-events-auto z-10 flex hidden w-full flex-col items-center rounded-t-md bg-cb-white lg:inline">
      {/* Render the visible metrics */}

      <div className="flex hidden w-full cursor-default flex-row items-center gap-2 overflow-hidden border-[0.5px] border-cb-white/40 px-4 py-2 font-sans font-bold tracking-wide text-black drop-shadow-md backdrop-blur-md lg:flex">
        <div className="flex w-full">
          <PercentageMetric />
        </div>
        <div className="flex w-full">
          <SparklineMetric />
        </div>
        <ChartWindowTabs />
      </div>

      {/* Add/Switch Menu - only on desktop, mobile has it in wrapper */}
    </div>
  );
};

export const ChartWindowTabs: React.FC = () => {
  const { analysisType, originCells, chartWindow, setChartWindow } =
    useMapConfigStore();
  const chartTabs: {
    [key: number]: { durationObj: duration.Duration; label: string };
  } = {
    0: { durationObj: dayjs.duration(6, "months"), label: "1 year" },
    1: { durationObj: dayjs.duration(12, "months"), label: "2 years" },
    2: { durationObj: dayjs.duration(24, "months"), label: "4 years" },
  };

  // Determine which tab is active based on chartWindow
  const getActiveTab = () => {
    const months = chartWindow.asMonths();
    if (months === 6) return 0;
    if (months === 12) return 1;
    if (months === 24) return 2;
    return 1; // default to 2 years
  };

  const handleTabChange = (index: number) => {
    const tabObj = chartTabs[index];
    setChartWindow(tabObj.durationObj);
  };

  return (
    <TabGroup
      selectedIndex={getActiveTab()}
      onChange={handleTabChange}
      className={""}
    >
      <TabList className={"flex w-full flex-row"}>
        {Object.values(chartTabs).map((tab, index) => (
          <Tab
            key={index}
            className="h-10 w-full text-nowrap border-cb-blue px-4 py-1 text-center text-sm text-xs font-medium uppercase tracking-wide text-gray-700 active:scale-95 data-[selected]:border-b-[0.5px] data-[selected]:text-cb-blue"
          >
            {tab.label}
          </Tab>
        ))}
      </TabList>
    </TabGroup>
  );
};
