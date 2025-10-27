"use client";
import { useMetricsStore, MetricType } from "@/store/metrics-store";
import { MobileMetricWrapper } from "./mobile-metric-wrapper";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import classNames from "classnames";
import { useMapConfigStore } from "@/store/store";
import { MobileBasicMetric } from "./mobile-basic-metric";
import { TestMetric } from "./test-metric";
import { useState } from "react";
import { Sparkline } from "../sparkline";
import { SparklineMetric } from "./sparkline-metric";

export const MobileMetricsContainer: React.FC = () => {
  const { selectedMobileMetric } = useMetricsStore();
  const { analysisType, originCells } = useMapConfigStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pointer-events-auto z-10 flex w-full flex-col items-center rounded-t-md">
      {/* Render the visible metrics */}
      <MobileMetricWrapper
        key={selectedMobileMetric}
        setExpanded={setExpanded}
        expanded={expanded}
      >
        <MobileBasicMetric />
        <div
          className={classNames(
            "grid w-full transition-all duration-300 ease-in-out",
            expanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <SparklineMetric />
          </div>
        </div>
      </MobileMetricWrapper>
      <div className="flex hidden w-full cursor-default flex-col items-center gap-2 overflow-hidden border-[0.5px] border-cb-white/40 px-4 py-2 font-sans font-bold tracking-wide text-black drop-shadow-md backdrop-blur-md lg:flex">
        {/* Header */}
        <p className="flex w-fit gap-[2px] text-nowrap rounded-full bg-cb-white px-8 font-light uppercase tracking-wider text-gray-600">
          {originCells.length > 0 && (
            <span className={classNames("flex items-center text-gray-900")}>
              <span>selection</span>
              <HexagonOutlinedIcon fontSize="small" className="ml-1" />
            </span>
          )}
        </p>
        {/* Metrics */}
        <div className="flex w-full flex-row items-stretch gap-8 px-4">
          <TestMetric />
          {/* {allMetrics.map((metricType) => {
            const MetricComponent = metricComponents[metricType];
            return (
              <div
                key={metricType}
                className="flex w-full flex-col items-center justify-center overflow-hidden text-nowrap"
              >
                <MetricComponent />
              </div>
            );
          })} */}
        </div>
      </div>

      {/* Add/Switch Menu - only on desktop, mobile has it in wrapper */}
    </div>
  );
};
