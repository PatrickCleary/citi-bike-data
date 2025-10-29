import dayjs from "dayjs";
import { ChartDataMonthly } from "./chart-types";

interface DataStatistics {
  mean: number;
  stdDev: number;
}
export const addBoundsDatasets = (
    datasets: any[],
    dataLength: number,
    stdDeviationNum: number,
    statistics: DataStatistics,
) => {
    // Calculate ± standard deviation bounds
    const upperBound = statistics.mean + stdDeviationNum * statistics.stdDev;
    const lowerBound = Math.max(
        0,
        statistics.mean - stdDeviationNum * statistics.stdDev,
    );

    // Create arrays for upper and lower bounds
    const upperBoundData = new Array(dataLength).fill(upperBound);
    const lowerBoundData = new Array(dataLength).fill(lowerBound);

    // Add upper bound
    datasets.push({
        label: "Upper Bound",
        data: upperBoundData,
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
        data: lowerBoundData,
        borderColor: "rgba(156, 163, 175, 0.4)",
        backgroundColor: "rgba(156, 163, 175, 0.15)",
        borderWidth: 1,
        borderDash: [3, 3],
        fill: false,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
    });
};

export const addRollingAvgDataset = (
  datasets: any[],
  data: number[],
  windowSize: number,
) => {
  if (!data) return null;



  // Calculate smooth trend line using moving average
  const trendLine = data.map((_, index) => {
    const start = Math.max(0, index - Math.floor(windowSize / 2));
    const end = Math.min(data.length, index + Math.ceil(windowSize / 2));
    const window = data.slice(start, end);
    return window.reduce((sum, val) => sum + val, 0) / window.length;
  });

  // Add trend line
  datasets.push({
    label: `${windowSize}-month avg`,
    data: trendLine,
    borderColor: "rgba(207, 114, 128, 0.8)",
    backgroundColor: "rgba(207, 114, 128, 0.1)",
    borderWidth: 2,
    fill: false,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 4,
    pointBackgroundColor: "rgba(207, 114, 128, 1)",
    pointBorderColor: "white",
    pointBorderWidth: 2,
    pointHoverBackgroundColor: "rgba(207, 114, 128, 1)",
    pointHoverBorderColor: "white",
    pointHoverBorderWidth: 2,
  });
};

export const addZScoreBaselineDataset = (
  datasets: any[], 
  baselineData: ChartDataMonthly,
  statistics: DataStatistics,
  rollingAverage: boolean,
) => {


  // Calculate mean and standard deviation
    const baselineValues = baselineData.map((d) => d.total_count);

    // Calculate mean and standard deviation for baseline
    const baselineMean =
      baselineValues.reduce((sum, val) => sum + val, 0) / baselineValues.length;

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
      return statistics.mean + zScore * statistics.stdDev;
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
  
};

export const addMainDataset = (
    datasets: any[],
    data: number[],
    ) => {
    datasets.push({
        label: "Current",
        data: data,
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
    }

export const getLabels = (data: ChartDataMonthly) => {
  return data.map((d) =>dayjs(d.date_month).format("MMM YYYY").toLocaleUpperCase(),
);
};


export const calculateStats = (data: number[]) => {


  // Calculate mean and standard deviation
  const mean =
    data.reduce((sum, val) => sum + val, 0) / data.length;
  const stdDev = Math.sqrt(
    data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      data.length,
  );

  return {
    mean,
    stdDev,
  };
};


export const addBaseData = (data: ChartDataMonthly ) => {
