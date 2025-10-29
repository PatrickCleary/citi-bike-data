import { ChartData, Point } from "chart.js";

export type ChartDataMonthly = Array<{
  date_month: string;
  total_count: number;
}>;

export type ChartLineData = ChartData<
  "line",
  (number | Point | null)[],
  unknown
>;
