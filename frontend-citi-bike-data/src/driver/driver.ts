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
      element: "#map-container",
      popover: {
        title: "Welcome to Citi Bike Data!",
        description:
          "This interactive map shows Citi Bike trips across NYC. The map is divided into hexagonal cells.",
        side: "over",
        align: "center",
      },
    },
    {
      element: "#map-container",
      disableActiveInteraction: false,
      popover: {
        title: "Explore Trip Data",

        description:
          "Each cell shows trips arriving to any dock inside that area. Try clicking on a cell.",
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
          'Great! This popup shows the trips arriving to the cell. Try clicking the bicycle icon to add this cell as an "origin".',
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
      element: "#map-container",
      popover: {
        title: "Updated Map View",

        description:
          'By setting an "origin" the map updates to show trips leaving from any dock in that region. You can set multiple origin and destination cells to filter the data further.',
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
          "The legend shows what the colors mean. Brighter colors indicate more bike trips in that area. The legend is dynamic, so the brightest yellow is always the area with the most trips.",
        side: "right",
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
      element:
        window.innerWidth >= 1024
          ? "[data-tour='stats-bar'].lg\\:flex"
          : "[data-tour='stats-bar'].lg\\:hidden",
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
