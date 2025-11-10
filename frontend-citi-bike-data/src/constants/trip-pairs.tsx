import { LngLatBoundsLike } from "maplibre-gl";

interface MapConfig {
  name: string;
  originCells: string[];
  destinationCells: string[];
  bounds: LngLatBoundsLike | null;
  date: string | null;
}

const BedfordBikeLane: MapConfig = {
  name: "Bedford Avenue Bike Lane",
  originCells: [
    "892a100dbd3ffff",
    "892a100d86fffff",
    "892a100d86bffff",
    "892a100dbd7ffff",
  ],
  destinationCells: [
    "892a100d84bffff",
    "892a100da87ffff",
    "892a100da97ffff",
    "892a100d85bffff",
    "892a100d843ffff",
  ],
  bounds: [
    [-74.02523, 40.65417],
    [-73.87941, 40.70993],
  ],
  // date: "2025-10-01",
};

const QueensboroBridge: MapConfig = {
  name: "Queensboro Bridge",
  originCells: [
    "892a100d427ffff",
    "892a100d423ffff",
    "892a100d42fffff",
    "892a100d42bffff",
    "892a100d43bffff",
    "892a100d433ffff",
    "892a100d437ffff",
    "892a100d5cbffff",
    "892a100d5dbffff",
    "892a100d4afffff",
  ],
  destinationCells: [
    "892a100d6b3ffff",
    "892a100d44bffff",
    "892a100d6b7ffff",
    "892a100d6a3ffff",
    "892a100d6bbffff",
    "892a100d6abffff",
    "892a100d6afffff",
    "892a100d45bffff",
    "892a100d697ffff",
    "892a100d687ffff",
    "892a100d693ffff",
    "892a100d683ffff",
    "892a100d68fffff",
    "892a100d617ffff",
    "892a100d607ffff",
    "892a100d633ffff",
  ],
  bounds: [
    [-73.98569, 40.71859],
    [-73.90212, 40.78276],
  ],
  // date: "2025-05-01",
};

export const PRESETS: { [key: string]: MapConfig } = {
  bedford_bike_lane: BedfordBikeLane,
  queensboro_bridge: QueensboroBridge,
};
