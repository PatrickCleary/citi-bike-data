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
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  baselineData,
  selectedDate,
  title,
}) => {
  const chartRef = useRef<ChartJS<"line">>(null);

  const chartData = useMemo(() => {
    const datasets = [];

    // Add baseline dataset first (so it renders behind), scaled to match the range of the main data
    if (baselineData && baselineData.length > 0) {
      const mainValues = data.map((d) => d.total_count);
      const baselineValues = baselineData.map((d) => d.total_count);

      // Calculate min/max for both datasets
      const mainMin = Math.min(...mainValues);
      const mainMax = Math.max(...mainValues);
      const baselineMin = Math.min(...baselineValues);
      const baselineMax = Math.max(...baselineValues);

      // Scale baseline to match the range of main data
      const scaledBaselineValues = baselineValues.map((value) => {
        const normalizedValue =
          (value - baselineMin) / (baselineMax - baselineMin);
        return mainMin + normalizedValue * (mainMax - mainMin);
      });

      datasets.push({
        data: scaledBaselineValues,
        borderColor: "rgba(156, 163, 175, 0.3)",
        backgroundColor: "rgba(156, 163, 175, 0.05)",
        borderWidth: 1,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHoverBackgroundColor: "rgba(156, 163, 175, 0.5)",
        pointHoverBorderColor: "white",
        pointHoverBorderWidth: 1,
      });
    }

    // Add main dataset
    datasets.push({
      data: data.map((d) => d.total_count),
      borderColor: "rgba(59, 130, 246, 0.8)",
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: "rgba(59, 130, 246, 1)",
      pointHoverBorderColor: "white",
      pointHoverBorderWidth: 2,
    });

    return {
      labels: data.map((d) => dayjs(d.date_month).format("MMM YYYY")),
      datasets,
    };
  }, [data, baselineData]);

  // Custom plugin to draw vertical line at selected date
  const verticalLinePlugin = useMemo(
    () => ({
      id: "verticalLine",
      afterDatasetsDraw(chart: ChartJS<"line">) {
        if (!selectedDate) return;

        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales.x) return;

        const { top, bottom } = chartArea;
        const selectedIndex = data.findIndex(
          (d) => d.date_month === selectedDate,
        );

        if (selectedIndex === -1) return;

        const xPosition = scales.x.getPixelForValue(selectedIndex);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xPosition, top);
        ctx.lineTo(xPosition, bottom);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.restore();
      },
    }),
    [selectedDate, data],
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      // layout:''
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
              // Skip baseline dataset (index 0 when baseline exists)
              if (
                context.datasetIndex === 0 &&
                baselineData &&
                baselineData.length > 0
              ) {
                return "";
              }
              return `${context.parsed.y?.toLocaleString() ?? 0} trips`;
            },
          },
          filter: (tooltipItem) => {
            // Only show tooltip for the main dataset (not baseline)
            return !(
              tooltipItem.datasetIndex === 0 &&
              baselineData &&
              baselineData.length > 0
            );
          },
        },
      },
      scales: {
        x: {
          display: false,
        },
        y: {
          display: false,
          min: 0,
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
    }),
    [],
  );

  const firstDate = data[0]?.date_month;
  const lastDate = data[data.length - 1]?.date_month;

  return (
    <div className="relative flex w-full flex-col">
      {title && (
        <h3 className="font-outfit md:hidden mb-2 text-sm font-light text-gray-500">
          {title}
        </h3>
      )}
      <div className="h-12 w-full">
        <Line
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
