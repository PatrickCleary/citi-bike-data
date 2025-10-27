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

    // Add baseline dataset first (so it renders behind), scaled by mean values
    if (baselineData && baselineData.length > 0) {
      const mainValues = data.map((d) => d.total_count);
      const baselineValues = baselineData.map((d) => d.total_count);

      // Calculate mean for both datasets
      const mainMean =
        mainValues.reduce((sum, val) => sum + val, 0) / mainValues.length;
      const baselineMean =
        baselineValues.reduce((sum, val) => sum + val, 0) /
        baselineValues.length;

      // Scale baseline so that its mean matches the main data's mean
      // This preserves the zero baseline and makes it clear if traffic is above/below expected
      const scaleFactor = baselineMean > 0 ? mainMean / baselineMean : 1;
      const scaledBaselineValues = baselineValues.map(
        (value) => value * scaleFactor,
      );

      datasets.push({
        data: scaledBaselineValues,
        borderColor: "rgba(49, 104, 142, 0.3)", // Updated color
        backgroundColor: "rgba(49, 104, 142, 0.05)", // Updated color
        borderWidth: 1,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHoverBackgroundColor: "rgba(49, 104, 142, 0.5)", // Updated color
        pointHoverBorderColor: "white",
        pointHoverBorderWidth: 1,
      });
    }

    // Add main dataset
    datasets.push({
      data: data.map((d) => d.total_count),
      borderColor: "rgba(49, 104, 142, 0.8)", // Updated color
      backgroundColor: "rgba(49, 104, 142, 0.1)", // Updated color
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: "rgba(49, 104, 142, 1)", // Updated color
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
              // Skip baseline dataset (index 0 when baseline exists)
              if (
                context.datasetIndex === 0 &&
                baselineData &&
                baselineData.length > 0
              ) {
                return "";
              }
              return `${context.parsed.y?.toLocaleString() ?? 0}${unit}`;
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
