"use client";

import React, { useRef, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import dayjs from "dayjs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

interface SparklineProps {
  data: Array<{
    date_month: string;
    total_count: number;
  }>;
  baselineData?: Array<{
    date_month: string;
    total_count: number;
  }>;
  selectedDate?: string;

  title?: string;
  unit?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  baselineData,
  selectedDate,
  title,
  unit,
}) => {
  const chartRef = useRef<ChartJS<"line">>(null);
  const selectedDateRef = useRef(selectedDate);
  const dataRef = useRef(data);

  // Update refs when props change
  selectedDateRef.current = selectedDate;
  dataRef.current = data;

  const chartData = useMemo(() => {
    const datasets = [];
    const mainValues = data.map((d) => d.total_count);

    // Calculate mean and standard deviation
    const mainMean =
      mainValues.reduce((sum, val) => sum + val, 0) / mainValues.length;
    const mainStdDev = Math.sqrt(
      mainValues.reduce((sum, val) => sum + Math.pow(val - mainMean, 2), 0) /
        mainValues.length,
    );

    // Calculate ±2 standard deviation bounds
    const upperBound = mainMean + 1.5 * mainStdDev;
    const lowerBound = Math.max(0, mainMean - 1.5 * mainStdDev);

    // Calculate smooth trend line using moving average
    const windowSize = Math.min(6, Math.floor(mainValues.length / 3)); // 6-month moving average
    const trendLine = mainValues.map((_, index) => {
      const start = Math.max(0, index - Math.floor(windowSize / 2));
      const end = Math.min(mainValues.length, index + Math.ceil(windowSize / 2));
      const window = mainValues.slice(start, end);
      return window.reduce((sum, val) => sum + val, 0) / window.length;
    });

    // Add upper bound
    datasets.push({
      label: "+2σ",
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
      label: "-2σ",
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

  // Custom plugin to draw vertical line at selected date
  // Using refs to access current values since plugin is only registered once
  const verticalLinePlugin = useMemo(
    () => ({
      id: "verticalLine",
      afterDatasetsDraw(chart: ChartJS<"line">) {
        const currentSelectedDate = selectedDateRef.current;
        const currentData = dataRef.current;

        if (!currentSelectedDate) return;

        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales.x) return;

        const { top, bottom } = chartArea;
        const selectedIndex = currentData.findIndex(
          (d) => d.date_month === currentSelectedDate,
        );

        if (selectedIndex === -1) return;

        const xPosition = scales.x.getPixelForValue(selectedIndex);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xPosition, top);
        ctx.lineTo(xPosition, bottom);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(49, 104, 142, 0.8)"; // Updated color
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.restore();
      },
    }),
    [], // Empty deps - plugin is created once, uses refs for current values
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          displayColors: false,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 8,
          position: "nearest",

          titleFont: {
            size: 11,
            family: "Outfit, sans-serif",
            weight: "light",
          },
          bodyFont: {
            size: 11,
          },
          callbacks: {
            title: (context) => {
              const date = new Date(context[0].label);
              return date.toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              });
            },
            label: (context) => {
              const dataset = context.dataset;

              if (dataset.label === "Current") {
                const value = context.parsed.y ?? 0;
                return `${value.toLocaleString()}${unit ?? ""}`;
              }

              if (dataset.label === "+1σ" || dataset.label === "-1σ") {
                return `${dataset.label}: ${context.parsed.y?.toLocaleString() ?? 0}${unit ?? ""}`;
              }

              if (dataset.label === "Baseline") {
                return `Baseline: ${context.parsed.y?.toLocaleString() ?? 0}${unit ?? ""}`;
              }

              return "";
            },
          },
        },
      },
      scales: {
        x: {
          display: false,
        },
        y: {
          display: false,
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
    }),
    [unit, baselineData],
  );

  const firstDate = data[0]?.date_month;
  const lastDate = data[data.length - 1]?.date_month;

  return (
    <div className="relative flex w-full flex-col">
      {title && (
        <h3 className="mb-2 font-outfit text-sm font-light text-gray-500 md:hidden">
          {title}
        </h3>
      )}
      <div className="h-32 w-full md:h-32">
        <Line
          width={"100%"}
          ref={chartRef}
          data={chartData}
          options={options}
          plugins={[verticalLinePlugin]}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs font-light uppercase tracking-wide text-gray-500">
        {firstDate && <div>{dayjs(firstDate).format("MMM YYYY")}</div>}
        {lastDate && <div>{dayjs(lastDate).format("MMM YYYY")}</div>}
      </div>
    </div>
  );
};
