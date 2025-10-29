"use client";
import { useMapConfigStore } from "@/store/store";
import { BasicMetric } from "./mobile-basic-metric";
import { useMemo } from "react";
import { SparklineMetric } from "./sparkline-metric";
import { useTripMonthlySumData } from "@/map/map-config";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Tab, TabGroup, TabList } from "@headlessui/react";
import { PercentageMetric } from "./percentage-metric";
import { CHART_OPTIONS } from "../charts/basic-chart-wrapper";
import { MetricHeader } from "./mobile-metric-wrapper";
import { ChartWindowTabs } from "./mobile-metrics-container";

dayjs.extend(duration);

export const DesktopMetricsContainer: React.FC = () => {
  return (
    <div className="pointer-events-auto z-10 flex hidden w-full flex-row items-start rounded-t-md bg-white drop-shadow-lg lg:flex">
      <div className="grow-1 flex w-80 max-w-80 flex-grow items-start p-4">
        <div className="flex flex-col gap-4">
          <MetricHeader />

          <BasicMetric />
        </div>
      </div>
      {/* Render the visible metrics */}
      <div className="flex flex-1 flex-col bg-cb-white lg:pl-2">
        <div className="flex items-center justify-between border-b border-gray-200">
          <ChartWindowTabs />
          <ChartDatasetToggles />
        </div>
        <div className="flex hidden w-full cursor-default flex-row items-center gap-2 overflow-hidden px-4 py-2 tracking-wide lg:flex">
          <div className="flex w-full max-w-lg">
            <PercentageMetric />
          </div>
          <div className="flex w-full max-w-lg">
            <SparklineMetric />
          </div>
        </div>
      </div>
      {/* Add/Switch Menu - only on desktop, mobile has it in wrapper */}
    </div>
  );
};
export const ChartDatasetToggles: React.FC = () => {
  const { chartDatasetView, setChartDatasetView } = useMapConfigStore();

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

  const tabs = [
    { value: "rolling_avg", label: `${trendWindowSize}-month avg`, title: "Show trend line" },
    { value: "main", label: "Monthly", title: "Show current data" },
  ];

  // Determine which tab is active based on chartDatasetView
  const getActiveTab = () => {
    return tabs.findIndex((tab) => tab.value === chartDatasetView);
  };

  const handleTabChange = (index: number) => {
    setChartDatasetView(tabs[index].value as "rolling_avg" | "main");
  };

  return (
    <div className="flex items-center gap-2 px-4">
      <TabGroup selectedIndex={getActiveTab()} onChange={handleTabChange}>
        <TabList className="flex flex-row gap-1">
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              className="flex h-10 w-16 w-full items-center justify-center text-nowrap rounded-full px-3 text-cb-blue data-[hover]:bg-cb-blue/10 data-[selected]:bg-cb-blue/30 data-[selected]:data-[hover]:bg-cb-blue/30 uppercase lg:h-fit focus:outline-none focus:bg-cb-blue/20"
              title={tab.title}
            >
              {tab.label}
            </Tab>
          ))}
        </TabList>
      </TabGroup>
    </div>
  );
};
