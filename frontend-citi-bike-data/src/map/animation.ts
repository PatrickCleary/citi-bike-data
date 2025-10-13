import { Map } from "maplibre-gl";
import { useMapConfigStore } from "@/store/store";
import { MutableRefObject } from "react";
import { HEX_SOURCE_LAYER_ID, DEFAULT_HEX_OPACITY } from "./layers";
import { HEX_SOURCE_ID } from "./sources";

// Helper function to animate cells appearing by trip count (low to high)
export const animateCellsByTripCount = (
  map: MutableRefObject<Map | null>,
  tripCounts: Record<string, number>,
) => {
  if (!map.current) return;

  // Get the scale from the store
  const scale = useMapConfigStore.getState().scale;

  // Wait for next frame to ensure layer is fully rendered
  requestAnimationFrame(() => {
    // Sort cells by trip count with randomness
    const sortedCells = Object.keys(tripCounts)
      .map((cellId) => {
        const tripCount = tripCounts[cellId] || 0;
        // Add random offset for variation (±20% of trip count)
        const randomOffset = (Math.random() - 0.5) * tripCount * 0.4;
        const sortValue = tripCount + randomOffset;
        return { cellId, sortValue, tripCount };
      })
      .sort((a, b) => b.sortValue - a.sortValue) // Sort by trip count ascending (low to high)
      .map(({ cellId, tripCount }) => ({ cellId, tripCount }));

    // Animation parameters
    const cellAnimDuration = 600; // Duration for each cell animation in ms
    const totalDuration = 800; // Total stagger duration in ms

    // Initially set all cells to transparent neutral color
    sortedCells.forEach(({ cellId }) => {
      map.current?.setFeatureState(
        {
          source: HEX_SOURCE_ID,
          sourceLayer: HEX_SOURCE_LAYER_ID,
          id: cellId,
        },
        {
          opacity: 0,
          color: "#808080", // neutral gray
          glowWidth: 0,
          glowColor: "#ffffff00",
        },
      );
    });

    // Animate each cell with staggered timing
    const initialDelay = 100; // Small delay to ensure layer is ready
    sortedCells.forEach(({ cellId, tripCount }, index) => {
      // Stagger start time based on index
      const progress = index / Math.max(1, sortedCells.length - 1);
      const delay = initialDelay + progress * totalDuration;

      setTimeout(() => {
        const finalColor = getColorForTripCount(tripCount, scale);
        const startTime = performance.now();

        const animate = (currentTime: DOMHighResTimeStamp) => {
          const elapsed = currentTime - startTime;
          const animProgress = Math.min(elapsed / cellAnimDuration, 1);

          // Apply Material Design easing
          const easedProgress = materialEaseOut(animProgress);

          // Animate opacity from 0 to DEFAULT_HEX_OPACITY
          const currentOpacity = easedProgress * DEFAULT_HEX_OPACITY;

          // Interpolate color from neutral gray to final color
          const grayRgb = [128, 128, 128];
          const finalRgb = finalColor.match(/\d+/g)?.map(Number) || grayRgb;
          const r = Math.round(
            grayRgb[0] + (finalRgb[0] - grayRgb[0]) * easedProgress,
          );
          const g = Math.round(
            grayRgb[1] + (finalRgb[1] - grayRgb[1]) * easedProgress,
          );
          const b = Math.round(
            grayRgb[2] + (finalRgb[2] - grayRgb[2]) * easedProgress,
          );
          const currentColor = `rgb(${r}, ${g}, ${b})`;

          map.current?.setFeatureState(
            {
              source: HEX_SOURCE_ID,
              sourceLayer: HEX_SOURCE_LAYER_ID,
              id: cellId,
            },
            {
              opacity: currentOpacity,
              color: currentColor,
              glowWidth: 0,
              glowColor: "#ffffff00",
            },
          );

          // When animation completes, trigger subtle pulse/glow
          if (animProgress >= 1) {
            triggerPulseEffect(map, cellId, finalColor);
          } else {
            requestAnimationFrame(animate);
          }
        };

        requestAnimationFrame(animate);
      }, delay);
    });
  });
};

// Helper function to create a subtle pulse/glow effect when cell reaches final state
const triggerPulseEffect = (
  map: MutableRefObject<Map | null>,
  cellId: string,
  color: string,
) => {
  const pulseDuration = 400; // Duration of pulse effect in ms
  const startTime = performance.now();

  const animate = (currentTime: DOMHighResTimeStamp) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / pulseDuration, 1);

    // Pulse goes from 0 to max and back to 0
    const pulseProgress = Math.sin(progress * Math.PI);
    const glowWidth = pulseProgress * 3; // Max glow width of 3px
    const glowOpacity = pulseProgress * 0.6; // Max glow opacity of 60%

    // Convert color to rgba for glow
    const rgb = color.match(/\d+/g)?.map(Number) || [255, 255, 255];
    const glowColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${glowOpacity})`;

    map.current?.setFeatureState(
      {
        source: HEX_SOURCE_ID,
        sourceLayer: HEX_SOURCE_LAYER_ID,
        id: cellId,
      },
      {
        glowWidth,
        glowColor,
      },
    );

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Clear glow after pulse completes
      map.current?.setFeatureState(
        {
          source: HEX_SOURCE_ID,
          sourceLayer: HEX_SOURCE_LAYER_ID,
          id: cellId,
        },
        {
          glowWidth: 0,
          glowColor: "#ffffff00",
        },
      );
    }
  };

  requestAnimationFrame(animate);
};

// Helper to get color for a given trip count
const getColorForTripCount = (
  tripCount: number,
  scale: [number, number],
): string => {
  const logMin = Math.log(scale[0] + 1);
  const logMax = Math.log(scale[1] + 1);
  const logValue = Math.log(tripCount + 1);
  const logRange = logMax - logMin;

  // Normalize to 0-1 range
  const normalized = Math.max(0, Math.min(1, (logValue - logMin) / logRange));

  // Viridis color scale
  const colors = [
    { stop: 0.0, color: "#440154" }, // dark purple
    { stop: 0.15, color: "#482878" }, // purple
    { stop: 0.3, color: "#3e4989" }, // blue-purple
    { stop: 0.45, color: "#31688e" }, // blue
    { stop: 0.6, color: "#26828e" }, // teal
    { stop: 0.75, color: "#35b779" }, // green
    { stop: 0.9, color: "#6ece58" }, // light green
    { stop: 1.0, color: "#fde725" }, // yellow
  ];

  // Find the two colors to interpolate between
  let lowerColor = colors[0];
  let upperColor = colors[colors.length - 1];

  for (let i = 0; i < colors.length - 1; i++) {
    if (normalized >= colors[i].stop && normalized <= colors[i + 1].stop) {
      lowerColor = colors[i];
      upperColor = colors[i + 1];
      break;
    }
  }

  // Interpolate between colors
  const range = upperColor.stop - lowerColor.stop;
  const localNormalized = (normalized - lowerColor.stop) / range;

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  const [r1, g1, b1] = hexToRgb(lowerColor.color);
  const [r2, g2, b2] = hexToRgb(upperColor.color);

  const r = Math.round(r1 + (r2 - r1) * localNormalized);
  const g = Math.round(g1 + (g2 - g1) * localNormalized);
  const b = Math.round(b1 + (b2 - b1) * localNormalized);

  return `rgb(${r}, ${g}, ${b})`;
};

// Material Design cubic-bezier easing function
const materialEaseOut = (t: number): number => {
  // cubic-bezier(0.4, 0.0, 0.2, 1)
  const y1 = 0.0,
    y2 = 1.0;

  // Simplified approximation for cubic bezier

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const t2 = t * t;
  const t3 = t2 * t;

  return ay * t3 + by * t2 + cy * t;
};
