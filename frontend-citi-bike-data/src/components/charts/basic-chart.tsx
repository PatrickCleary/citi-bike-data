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
import type { ChartData, ChartOptions } from "chart.js";

import { formatter } from "@/utils/utils";
import { ChartLineData } from "./chart-types";
import dayjs from "dayjs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

interface BasicChartProps {
  data: ChartLineData | undefined;
  selectedIndex: number;
  unit?: string;
}

// Get the total number of data points from the chart data
const getDataLength = (data: ChartLineData | undefined): number => {
  if (!data) return 0;
  return data.labels?.length ?? 0;
};
export const BasicChart: React.FC<BasicChartProps> = ({
  data,
  selectedIndex,
  unit,
}) => {
  const chartRef = useRef<ChartJS<"line">>(null);

  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  // Custom plugin to draw vertical line at selected date
  const verticalLinePlugin = useMemo(
    () => ({
      id: "verticalLine",
      afterDatasetsDraw(chart: ChartJS<"line">) {
        const { ctx, chartArea, scales } = chart;

        if (!selectedIndexRef.current || !chartArea || !scales.x) return;

        if (selectedIndexRef.current === -1) return;

        const xPosition = scales.x.getPixelForValue(selectedIndexRef.current);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xPosition, chartArea.top);
        ctx.lineTo(xPosition, chartArea.bottom);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(49, 104, 142, 0.8)";
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.restore();
      },
    }),
    [],
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        tooltip: {
          enabled: true,
          displayColors: false,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 8,
          position: "nearest",

          titleFont: {
            size: 11,
            family: "Outfit, sans-serif",
          },
          bodyFont: {
            size: 11,
            family: "Outfit, sans-serif",
          },
          callbacks: {
            title: (context) => {
              return context[0].label;
            },
            label: (context) => {
              const dataset = context.dataset;
              const label = dataset.label;

              // Show value for "Current" dataset
              if (label === "Current") {
                const value = context.parsed.y ?? 0;
                return `${value.toLocaleString()}${unit ?? ""}`;
              }

              // Show value for rolling average datasets (e.g., "3-month avg")
              if (label && label.includes("-month avg")) {
                const value = context.parsed.y ?? 0;
                return `${value.toLocaleString()}${unit ?? ""}`;
              }

              return "";
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          grid: {
            display: false,
          },
          afterBuildTicks: (axis) => {
            const dataLength = getDataLength(data);
            if (dataLength > 0) {
              // Force ticks to include first and last data points
              axis.ticks = [
                { value: 0, label: axis.getLabelForValue(0) },
                {
                  value: dataLength - 1,
                  label: axis.getLabelForValue(dataLength - 1),
                },
              ];
            }
          },
          ticks: {
            font: {
              size: 10,
              family: "Outfit, sans-serif",
            },
            color: "rgba(107, 114, 128, 1)",
            maxRotation: 0,
            minRotation: 0,
          },
        },
        y: {
          ticks: {
            callback: function (value) {
              if (typeof value !== "number") return value;
              return formatter.format(value);
            },
            font: {
              size: 10,
              family: "Outfit, sans-serif",
            },
          },
          title: {
            display: true,

            font: {
              size: 14,
              family: "Outfit, sans-serif",
              weight: "bold",
            },
          },
          grid: {
            // display: false,
          },
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
    }),
    [unit, data],
  );

  return (
    <div className="h-32 w-full">
      <Line
        width={"100%"}
        ref={chartRef}
        data={
          data ?? ({ datasets: [], labels: [" ", " "] } as ChartData<"line">)
        }
        options={options}
        plugins={[verticalLinePlugin]}
      />
    </div>
  );
};
