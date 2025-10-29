"use client";
import { useMetricsStore, MetricType } from "@/store/metrics-store";
import { TotalTripsMetric } from "./total-trips-metric";
import { ComparisonMetric } from "./comparison-metric";
import { SparklineMetric } from "./sparkline-metric";
import { PercentageMetric } from "./percentage-metric";
import { MobileMetricWrapper } from "./mobile-metric-wrapper";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import { isMobileDevice } from "@/utils/mobile-detection";
import classNames from "classnames";
import { useMapConfigStore } from "@/store/store";
import { AnalysisType } from "@/utils/api";
import { BasicMetric } from "./mobile-basic-metric";
import { TestMetric } from "./test-metric";

const metricComponents: Record<MetricType, React.FC> = {
  total: TotalTripsMetric,
  comparison: ComparisonMetric,
  sparkline: SparklineMetric,
  percentage: PercentageMetric,
};
const getDisplayText = (analysisType: AnalysisType, originCells: string[]) => {
  if (!originCells || originCells.length === 0) {
    return "System-wide";
  }
  if (originCells.length >= 1) {
    return `${analysisType === "departures" ? "to" : "from"}`;
  }
};

export const MetricsContainer: React.FC = () => {
  const { selectedMobileMetric } = useMetricsStore();
  const { analysisType, originCells } = useMapConfigStore();

  const allMetrics: MetricType[] = [
    "comparison",
    "total",
    "sparkline",
    "percentage",
  ];

  const MetricComponentMobile = metricComponents[selectedMobileMetric];
  return (
    <div className="pointer-events-auto flex w-full lg:max-w-none">
      {/* Render the visible metrics */}

      <MobileMetricWrapper key={selectedMobileMetric}>
        <BasicMetric />
        {/* <SparklineMetric /> */}
      </MobileMetricWrapper>
      <div className="flex hidden w-full cursor-default flex-col items-center gap-2 overflow-hidden rounded-md border-[0.5px] border-cb-white/40 bg-white/30 px-4 py-2 font-sans font-bold tracking-wide text-black drop-shadow-md backdrop-blur-md lg:flex">
        {/* Header */}
        <p className="flex w-fit gap-[2px] text-nowrap rounded-full bg-cb-white/30 px-8 font-light uppercase tracking-wider text-gray-600">
          {getDisplayText(analysisType, originCells)}
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
