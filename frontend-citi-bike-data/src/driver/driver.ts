import { driver, DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MutableRefObject } from "react";

/**
 * Fly to a specific location and optionally highlight it
 * @param map - MapLibre map instance
 * @param lng - Longitude
 * @param lat - Latitude
 * @param zoom - Zoom level (default 13)
 */
export const flyToLocation = (
  map: MapLibreMap | null,
  lng: number,
  lat: number,
  zoom: number = 13,
) => {
  if (!map) return;

  map.flyTo({
    center: [lng, lat],
    zoom: zoom,
    duration: 2000,
    essential: true,
  });
};
/**
 * Interactive onboarding tour that guides users through the key features
 * Prompts users to interact rather than automating everything
 * @param map - MapLibre map instance
 */
export const startInteractiveTour = (
  map: MutableRefObject<MapLibreMap | null>,
) => {
  const mapObj = map.current;
  if (!mapObj) return;

  let tourInstance: ReturnType<typeof driver> | null = null;

  const steps: DriveStep[] = [
    {
      element: ".maplibregl-canvas",
      popover: {
        title: "Welcome to Citi Bike Data!",
        description:
          "This interactive map shows bike share journey patterns across NYC. Let's explore the key features together.",
        side: "over",
        align: "center",
      },
    },
    {
      element: ".maplibregl-canvas",
      popover: {
        title: "Explore Trip Data",
        description:
          "We're zooming to Lower Manhattan. Click on any colored hexagon to see trip data for that area.",
        side: "top",
        align: "center",
        showButtons: [],
      },
      onHighlightStarted: (element) => {
        // Zoom to Lower Manhattan
        flyToLocation(mapObj, -74.006, 40.7128, 13.5);

        if (element) {
          element.addEventListener(
            "click",
            () => {
              // Delay to allow popup to render
              setTimeout(() => tourInstance?.moveNext(), 300);
            },
            { once: true },
          );
        }
      },
    },
    {
      element: ".maplibregl-popup",
      popover: {
        title: "Trip Data Popup",
        description:
          "Great! This popup shows the number of trips for this region. Click the bicycle icon to set this as the origin and see where trips go.",
        side: "bottom",
        align: "center",
        showButtons: [],
      },
      onHighlightStarted: (element) => {
        if (element) {
          // Listen for clicks on the origin/destination buttons
          element.addEventListener(
            "click",
            () => {
              // Zoom back out and advance to next step
              mapObj.flyTo({
                zoom: 13,
                duration: 1500,
              });
              setTimeout(() => tourInstance?.moveNext(), 500);
            },
            { once: true },
          );
        }
      },
    },
    {
      element: ".maplibregl-canvas",
      popover: {
        title: "Updated Map View",
        description:
          "Great! Now we can see trip patterns originating from that area. ",
        side: "bottom",
        align: "center",
        disableButtons: ["previous"],
      },
    },

    {
      element: "[data-tour='legend']",
      popover: {
        title: "Color Legend",
        description:
          "The legend shows what the colors mean. Brighter colors indicate more bike trips in that area.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "[data-tour='layer-control']",
      popover: {
        title: "Layer Controls",
        description:
          "Toggle different map layers like bike lanes and transit stations on or off.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "[data-tour='display-settings']",
      popover: {
        title: "Display Settings",
        description:
          "Switch between absolute trip counts and comparison mode to see how ridership has changed over time.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "[data-tour='date-control']",
      popover: {
        title: "Date Controls",
        description:
          "Navigate through different months and years to see how bike usage patterns change over time.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "[data-tour='stats-bar']",
      popover: {
        title: "Aggregated Statistics",
        description:
          "The bottom bar shows aggregated statistics for the selected region and time period, including total trips and other key metrics.",
        side: "top",
        align: "center",
      },
    },
  ];

  tourInstance = driver({
    showProgress: true,
    steps,
    popoverClass: "driver-popover-tour",
  });

  tourInstance.drive();
  return tourInstance;
};
