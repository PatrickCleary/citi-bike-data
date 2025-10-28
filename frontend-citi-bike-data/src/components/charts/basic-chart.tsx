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
import type { ChartData, ChartOptions, Point } from "chart.js";
import { StatisticalOptions } from "./basic-chart-wrapper";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

interface BasicChartProps {
  data: ChartData<"line", (number | Point | null)[], unknown>;
  statisticalOptions: StatisticalOptions;
  selectedIndex: number;

  title?: string;
  unit?: string;
}

export const CHART_OPTIONS: StatisticalOptions = {
  stdDeviationNum: 1.5,
  smoothingWindowSize: 6,
};

export const BasicChart: React.FC<BasicChartProps> = ({
  data,
  statisticalOptions = CHART_OPTIONS,
  selectedIndex,
  unit,
}) => {
  const chartRef = useRef<ChartJS<"line">>(null);
  const dataRef = useRef(data);
  const chartOptionsFinal = { ...CHART_OPTIONS, ...statisticalOptions };

  // Update refs when props change
  dataRef.current = data;
  // Custom plugin to draw vertical line at selected date
  const verticalLinePlugin = useMemo(
    () => ({
      id: "verticalLine",
      afterDatasetsDraw(chart: ChartJS<"line">) {
        const { ctx, chartArea, scales } = chart;

        if (selectedIndex === -1 || !chartArea || !scales.x) return;

        const xPosition = scales.x.getPixelForValue(selectedIndex);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xPosition, chartArea.top);
        ctx.lineTo(xPosition, chartArea.bottom);
        ctx.lineWidth = 2;
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
    [unit],
  );

  return (
    <div className="h-32 w-full">
      <Line
        width={"100%"}
        ref={chartRef}
        data={data}
        options={options}
        plugins={[verticalLinePlugin]}
      />
    </div>
  );
};
