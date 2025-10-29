"use client";
import { useMetricsStore, MetricType } from "@/store/metrics-store";
import { MobileMetricWrapper } from "./mobile-metric-wrapper";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import classNames from "classnames";
import { useMapConfigStore } from "@/store/store";
import { BasicMetric } from "./mobile-basic-metric";

import { useState } from "react";
import { SparklineMetric } from "./sparkline-metric";
import { useComparison } from "@/map/map-config";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Tab, TabGroup, TabList } from "@headlessui/react";
import { PercentageMetric } from "./percentage-metric";
import { Menu, MenuItem, IconButton } from "@mui/material";

dayjs.extend(duration);

type ChartType = "sparkline" | "percentage";

export const MobileMetricsContainer: React.FC = () => {
  const { selectedMobileMetric } = useMetricsStore();

  const comparison = useComparison();
  const [expanded, setExpanded] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("sparkline");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleChartTypeChange = (type: ChartType) => {
    setChartType(type);
    handleMenuClose();
  };

  return (
    <div className="pointer-events-auto z-10 flex w-full flex-col items-center rounded-t-md bg-white lg:hidden">
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
            <div className="flex flex-row justify-between">
              <IconButton
                onClick={handleMenuClick}
                size="small"
                aria-controls={menuOpen ? "chart-type-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={menuOpen ? "true" : undefined}
              >
                <MoreHorizIcon className="text-cb-blue" fontSize="small" />
              </IconButton>
              <Menu
                id="chart-type-menu"
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                MenuListProps={{
                  "aria-labelledby": "chart-type-button",
                }}
              >
                <MenuItem
                  onClick={() => handleChartTypeChange("sparkline")}
                  selected={chartType === "sparkline"}
                >
                  Trips
                </MenuItem>
                <MenuItem
                  onClick={() => handleChartTypeChange("percentage")}
                  selected={chartType === "percentage"}
                >
                  Percentages
                </MenuItem>
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

export const ChartWindowTabs: React.FC = () => {
  const { chartWindow, setChartWindow } = useMapConfigStore();
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
    <TabGroup selectedIndex={getActiveTab()} onChange={handleTabChange}>
      <TabList className={"flex w-fit flex-row gap-1 p-1"}>
        {Object.values(chartTabs).map((tab, index) => (
          <Tab
            key={index}
            className="flex h-10 w-16 w-full items-center justify-center text-nowrap rounded-full px-3 uppercase text-cb-blue focus:bg-cb-blue/20 focus:outline-none data-[hover]:bg-cb-blue/10 data-[selected]:bg-cb-blue/30 data-[selected]:data-[hover]:bg-cb-blue/30 lg:h-fit"
          >
            {tab.label}
          </Tab>
        ))}
      </TabList>
    </TabGroup>
  );
};
