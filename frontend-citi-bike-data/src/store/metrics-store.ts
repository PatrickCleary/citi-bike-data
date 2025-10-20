import { create } from "zustand";

export type MetricType = "total" | "comparison" | "sparkline";

interface MetricsStore {
  visibleMetrics: MetricType[];
  selectedMobileMetric: MetricType;
  addMetric: (metric: MetricType) => void;
  removeMetric: (metric: MetricType) => void;
  setSelectedMobileMetric: (metric: MetricType) => void;
  toggleMetric: (metric: MetricType) => void;
}

export const useMetricsStore = create<MetricsStore>((set) => ({
  visibleMetrics: ["total", "comparison", "sparkline"], // Default to showing only total trips
  selectedMobileMetric: "total",

  addMetric: (metric) =>
    set((state) => {
      if (!state.visibleMetrics.includes(metric)) {
        return { visibleMetrics: [...state.visibleMetrics, metric] };
      }
      return state;
    }),

  removeMetric: (metric) =>
    set((state) => ({
      visibleMetrics: state.visibleMetrics.filter((m) => m !== metric),
    })),

  setSelectedMobileMetric: (metric) =>
    set({ selectedMobileMetric: metric }),

  toggleMetric: (metric) =>
    set((state) => {
      if (state.visibleMetrics.includes(metric)) {
        // Don't allow removing the last metric
        if (state.visibleMetrics.length === 1) return state;
        return { visibleMetrics: state.visibleMetrics.filter((m) => m !== metric) };
      } else {
        return { visibleMetrics: [...state.visibleMetrics, metric] };
      }
    }),
}));
