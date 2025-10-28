import { useMemo } from "react";
import { BasicChart } from "./basic-chart";
import { useChartWindow, useMapConfigStore } from "@/store/store";
import dayjs from "dayjs";

export interface StatisticalOptions {
  stdDeviationNum: number;
  smoothingWindowSize: number;
}

export const CHART_OPTIONS: StatisticalOptions = {
  stdDeviationNum: 1.5,
  smoothingWindowSize: 6,
};
interface BasicChartWrapperProps {
  data:
    | Array<{
        date_month: string;
        total_count: number;
      }>
    | undefined;
  dataLoading?: boolean;
  baselineData?:
    | Array<{
        date_month: string;
        total_count: number;
      }>
    | undefined;

  title?: string;
  unit?: string;
  chartOptions?: Partial<StatisticalOptions>;
}

export const BasicChartWrapper: React.FC<BasicChartWrapperProps> = ({
  data,
  baselineData,
  dataLoading,
  title,
  chartOptions = CHART_OPTIONS,
}) => {
  const { selectedMonth } = useMapConfigStore();
  const { windowStart, windowEnd } = useChartWindow();

  const chartOptionsFinal: StatisticalOptions = {
    ...CHART_OPTIONS,
    ...chartOptions,
  };

  const selectedIndex = data?.findIndex((d) => d.date_month === selectedMonth);
  const chartData = useMemo(() => {
    const datasets = [];
    if (!data) {
      return null;
    }
    const mainValues = data?.map((d) => d.total_count);

    // Calculate mean and standard deviation
    const mainMean =
      mainValues.reduce((sum, val) => sum + val, 0) / mainValues.length;
    const mainStdDev = Math.sqrt(
      mainValues.reduce((sum, val) => sum + Math.pow(val - mainMean, 2), 0) /
        mainValues.length,
    );

    // Calculate ± standard deviation bounds
    const upperBound =
      mainMean + chartOptionsFinal.stdDeviationNum * mainStdDev;
    const lowerBound = Math.max(
      0,
      mainMean - chartOptionsFinal.stdDeviationNum * mainStdDev,
    );

    // Calculate smooth trend line using moving average
    const windowSize = Math.min(
      chartOptionsFinal.smoothingWindowSize,
      Math.floor(mainValues.length / 3),
    ); // 6-month moving average
    const trendLine = mainValues.map((_, index) => {
      const start = Math.max(0, index - Math.floor(windowSize / 2));
      const end = Math.min(
        mainValues.length,
        index + Math.ceil(windowSize / 2),
      );
      const window = mainValues.slice(start, end);
      return window.reduce((sum, val) => sum + val, 0) / window.length;
    });

    // Add upper bound
    datasets.push({
      label: "Upper Bound",
      data: data.map(() => upperBound),
      borderColor: "rgba(156, 163, 175, 0.4)",
      backgroundColor: "transparent",
      borderWidth: 1,
      borderDash: [3, 3],
      fill: "+1",
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
    });

    // Add lower bound
    datasets.push({
      label: "Lower Bound",
      data: data.map(() => lowerBound),
      borderColor: "rgba(156, 163, 175, 0.4)",
      backgroundColor: "rgba(156, 163, 175, 0.15)",
      borderWidth: 1,
      borderDash: [3, 3],
      fill: false,
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
    });

    // Add trend line
    datasets.push({
      label: "Trend",
      data: trendLine,
      borderColor: "rgba(207, 114, 128, 0.4)",
      backgroundColor: "transparent",
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 0,
    });

    if (baselineData && baselineData.length > 0) {
      const baselineValues = baselineData.map((d) => d.total_count);

      // Calculate mean and standard deviation for baseline
      const baselineMean =
        baselineValues.reduce((sum, val) => sum + val, 0) /
        baselineValues.length;

      const baselineStdDev = Math.sqrt(
        baselineValues.reduce(
          (sum, val) => sum + Math.pow(val - baselineMean, 2),
          0,
        ) / baselineValues.length,
      );

      // Convert both to z-scores, then rescale back to main data's scale
      const zScoredBaseline = baselineValues.map((value) => {
        const zScore =
          baselineStdDev > 0 ? (value - baselineMean) / baselineStdDev : 0;
        return mainMean + zScore * mainStdDev;
      });

      datasets.push({
        label: "Baseline",
        data: zScoredBaseline,
        borderColor: "rgba(49, 104, 142, 0.3)",
        backgroundColor: "rgba(49, 104, 142, 0.05)",
        borderWidth: 1,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHoverBackgroundColor: "rgba(49, 104, 142, 0.5)",
        pointHoverBorderColor: "white",
        pointHoverBorderWidth: 1,
      });
    }

    // Add main dataset
    datasets.push({
      label: "Current",
      data: mainValues,
      borderColor: "rgba(49, 104, 142, 0.8)",
      backgroundColor: "rgba(49, 104, 142, 0.1)",
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: "rgba(49, 104, 142, 1)",
      pointBorderColor: "white",
      pointBorderWidth: 2,
      pointHoverBackgroundColor: "rgba(49, 104, 142, 1)",
      pointHoverBorderColor: "white",
      pointHoverBorderWidth: 2,
    });

    return {
      labels: data.map((d) => dayjs(d.date_month).format("MMM YYYY")),
      datasets,
    };
  }, [data, baselineData]);

  return (
    <div className="relative flex w-full flex-col">
      {title && (
        <h3 className="mb-2 font-outfit text-sm font-light text-gray-500 md:hidden">
          {title}
        </h3>
      )}
      {chartData ? (
        <BasicChart
          data={chartData}
          statisticalOptions={chartOptionsFinal}
          selectedIndex={selectedIndex ?? -1}
        />
      ) : (
        <div className="flex h-32 animate-pulse items-center justify-center bg-black" />
      )}

      <div className="mt-1 flex justify-between text-xs font-light uppercase tracking-wide text-gray-500">
        {windowStart && <div>{dayjs(windowStart).format("MMM YYYY")}</div>}
        {windowEnd && <div>{dayjs(windowEnd).format("MMM YYYY")}</div>}
      </div>
    </div>
  );
};
