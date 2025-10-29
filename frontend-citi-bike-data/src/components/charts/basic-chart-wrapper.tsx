import { useMemo, useState } from "react";
import { BasicChart } from "./basic-chart";
import { useMapConfigStore } from "@/store/store";
import { ChartDataMonthly } from "./chart-types";
import {
  addBoundsDatasets,
  addMainDataset,
  addRollingAvgDataset,
  addZScoreBaselineDataset,
  calculateStats,
  getLabels,
} from "./chart-utils";
import { ChartDataset } from "chart.js";

export interface StatisticalOptions {
  stdDeviationNum: number;
  smoothingWindowSize: number;
}

export interface DatasetConfig {
  bounds?: boolean;
  rolling_avg?: boolean;
  baseline?: boolean;
  main?: boolean;
}

interface BasicChartWrapperProps {
  data: ChartDataMonthly | undefined;
  dataLoading?: boolean;
  baselineData?: ChartDataMonthly | undefined;

  title?: string;
  unit?: string;
  chartOptions?: Partial<StatisticalOptions>;
  /**
   * Configure which datasets to include and their initial state.
   * - If a dataset key is undefined, it won't be available at all (no toggle shown)
   * - If a dataset key is true/false, it will be available with that initial state
   * Example: { bounds: false, rolling_avg: true, main: true }
   * This excludes "baseline" entirely while including bounds (off), rolling_avg (on), and main (on)
   */
  datasetConfig?: DatasetConfig;
  showDatasetToggles?: boolean;

  children: React.ReactNode;
}

export const CHART_OPTIONS: StatisticalOptions = {
  stdDeviationNum: 1.5,
  smoothingWindowSize: 3,
};

export const DEFAULT_DATASET_CONFIG: Required<DatasetConfig> = {
  bounds: false,
  rolling_avg: true,
  baseline: true,
  main: true,
};

export const BasicChartWrapper: React.FC<BasicChartWrapperProps> = ({
  data,
  baselineData,
  title,
  unit,
  chartOptions = CHART_OPTIONS,
  datasetConfig,
  showDatasetToggles = false,
  children,
}) => {
  const { selectedMonth } = useMapConfigStore();
  const chartOptionsFinal: StatisticalOptions = {
    ...CHART_OPTIONS,
    ...chartOptions,
  };

  // Merge default config with provided config
  // Only include keys that are explicitly defined in datasetConfig, or all defaults if none provided
  const initialConfig = datasetConfig
    ? Object.fromEntries(
        Object.entries(DEFAULT_DATASET_CONFIG).filter(([key]) =>
          Object.prototype.hasOwnProperty.call(datasetConfig, key),
        ),
      )
    : DEFAULT_DATASET_CONFIG;

  const mergedConfig = { ...initialConfig, ...datasetConfig } as DatasetConfig;

  // Use internal state for toggles if enabled, otherwise use merged config
  const [internalDatasetConfig, setInternalDatasetConfig] =
    useState<DatasetConfig>(mergedConfig);

  const datasetConfigFinal: DatasetConfig = showDatasetToggles
    ? internalDatasetConfig
    : mergedConfig;

  const selectedIndex =
    data?.findIndex((d) => d.date_month === selectedMonth) ?? -1;

  const chartData = useMemo(() => {
    const datasets: ChartDataset<"line">[] = [];
    if (!data) return null;

    const dataValues = data?.map((d) => d.total_count);
    const statistics = calculateStats(dataValues);

    // Calculate smooth trend line using moving average
    const windowSize = Math.min(
      chartOptionsFinal.smoothingWindowSize,
      Math.floor(dataValues.length / 3),
    );

    // Add datasets based on configuration (only if defined and true)
    if (datasetConfigFinal.bounds === true) {
      addBoundsDatasets(
        datasets,
        dataValues.length,
        chartOptionsFinal.stdDeviationNum,
        statistics,
      );
    }

    if (datasetConfigFinal.rolling_avg === true) {
      addRollingAvgDataset(datasets, dataValues, windowSize);
    }

    if (datasetConfigFinal.baseline === true && baselineData) {
      addZScoreBaselineDataset(datasets, baselineData, statistics, datasetConfigFinal.rolling_avg === true);
    }

    if (datasetConfigFinal.main === true) {
      addMainDataset(datasets, dataValues);
    }

    return {
      labels: getLabels(data),
      datasets,
    };
  }, [data, baselineData, datasetConfigFinal, chartOptionsFinal]);

  return (
    <div className="relative flex w-full flex-col">
      <div className="flex flex-row justify-between">
        {title && (
          <h3 className="mb-2 font-outfit text-sm font-light text-gray-500">
            {title}
          </h3>
        )}
        {children}
      </div>

      {chartData ? (
        <BasicChart
          data={chartData}
          selectedIndex={selectedIndex}
          unit={unit}
        />
      ) : (
        <div className="h-32 animate-pulse flex items-center justify-center bg-white/30" />
      )}
    </div>
  );
};
