"use client";
import React, { useState } from "react";
import { Map } from "maplibre-gl";
import { MutableRefObject } from "react";
import { Menu, MenuButton, MenuItems } from "@headlessui/react";
import classNames from "classnames";
import LayersIcon from "@mui/icons-material/Layers";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import {
  PATH_LINE_LAYER,
  PATH_STATION_LAYER,
  NYC_LINE_LAYER,
  NYC_STATION_LAYER,
  NJ_LIGHT_RAIL_LINE_LAYER,
  NJ_LIGHT_RAIL_STATION_LAYER,
  NJ_RAIL_LINE_LAYER,
  NJ_RAIL_STATION_LAYER,
  HEX_LAYER,
  HEX_LAYER_LINE,
  DOCK_LOCATIONS_CURRENT_LAYER,
} from "@/map/layers";
import { MapButtonStyle } from "@/map/map-button";
import { TEXT_1, TEXT_2 } from "./constants";

interface LayerGroup {
  id: string;
  name: string;
  visible: boolean;
  layerIds: string[];
}

interface LayerControlProps {
  map: MutableRefObject<Map | null>;
  mapLoaded: boolean;
}

export const LayerControl: React.FC<LayerControlProps> = ({
  map,
  mapLoaded,
}) => {
  const [layerGroups, setLayerGroups] = useState<LayerGroup[]>([
    {
      id: "transit",
      name: "Transit",
      visible: true,
      layerIds: [
        PATH_LINE_LAYER.id,
        PATH_STATION_LAYER.id,
        NYC_LINE_LAYER.id,
        NYC_STATION_LAYER.id,
        NJ_LIGHT_RAIL_LINE_LAYER.id,
        NJ_LIGHT_RAIL_STATION_LAYER.id,
        NJ_RAIL_LINE_LAYER.id,
        NJ_RAIL_STATION_LAYER.id,
      ],
    },

    {
      id: "bike",
      name: "CitiBike",
      visible: true,
      layerIds: [HEX_LAYER.id, HEX_LAYER_LINE.id],
    },
    {
      id: "docks",
      name: "Docks",
      visible: true,
      layerIds: [DOCK_LOCATIONS_CURRENT_LAYER.id],
    },
  ]);

  const toggleLayerGroup = (groupId: string) => {
    if (!map.current || !mapLoaded) return;

    setLayerGroups((prev) =>
      prev.map((group) => {
        if (group.id === groupId) {
          const newVisible = !group.visible;

          group.layerIds.forEach((layerId) => {
            if (map.current?.getLayer(layerId)) {
              map.current.setLayoutProperty(
                layerId,
                "visibility",
                newVisible ? "visible" : "none",
              );
            }
          });

          return { ...group, visible: newVisible };
        }
        return group;
      }),
    );
  };

  const moveLayerGroup = (groupId: string, direction: "up" | "down") => {
    if (!map.current || !mapLoaded) return;

    setLayerGroups((prev) => {
      const newGroups = [...prev];
      console.log(newGroups);
      const currentIndex = newGroups.findIndex((g) => g.id === groupId);

      if (direction === "up" && currentIndex > 0) {
        [newGroups[currentIndex], newGroups[currentIndex - 1]] = [
          newGroups[currentIndex - 1],
          newGroups[currentIndex],
        ];
      } else if (direction === "down" && currentIndex < newGroups.length - 1) {
        [newGroups[currentIndex], newGroups[currentIndex + 1]] = [
          newGroups[currentIndex + 1],
          newGroups[currentIndex],
        ];
      }

      reorderLayersOnMap(newGroups, direction);
      return newGroups;
    });
  };

  const reorderLayersOnMap = (
    groups: LayerGroup[],
    direction: "up" | "down",
  ) => {
    if (!map.current) return;

    groups.forEach((group) => {
      group.layerIds.forEach((layerId) => {
        if (map.current?.getLayer(layerId)) {
          try {
            map.current.moveLayer(layerId);
          } catch (error) {
            console.warn(`Could not move layer ${layerId}:`, error);
          }
        }
      });
    });
  };

  return (
    <Menu>
      <MenuButton className={classNames(MapButtonStyle, "focus:outline-none")}>
        <LayersIcon />
      </MenuButton>

      <MenuItems
        anchor="bottom start"
        transition
        className="z-10 flex origin-bottom-left flex-col rounded-lg border border-gray-300 bg-white p-4 font-thin text-black shadow-lg duration-100 ease-out [--anchor-gap:theme(spacing.1)] focus:outline-none data-[closed]:-translate-x-1 data-[closed]:translate-y-1 data-[closed]:opacity-0"
      >
        <div className="space-y-2">
          {layerGroups.map((group, index) => (
            <div key={group.id} className="flex flex-col">
              <div className="flex items-start gap-2">
                {/* Image with visibility toggle */}
                <div className="flex flex-col items-center">
                  <div
                    className={classNames(
                      "outline-cb-blue group relative h-16 w-16 cursor-pointer overflow-hidden rounded",
                      group.visible ? "outline" : "outline-hidden",
                    )}
                    style={{
                      backgroundImage: `url("/${group.id}.jpg")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                    onClick={() => toggleLayerGroup(group.id)}
                  >
                    {/* Overlay that lightens on hover */}
                    <div
                      className={classNames(
                        "absolute inset-0 bg-white opacity-0 transition-opacity group-hover:opacity-30",
                      )}
                    ></div>

                    {/* Icon on top of overlay */}
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                      {!group.visible ? (
                        <VisibilityOutlinedIcon
                          className="invisible text-gray-700 group-hover:visible group-hover:text-gray-900"
                          fontSize="small"
                        />
                      ) : (
                        <VisibilityOffOutlinedIcon
                          className="invisible text-gray-700 group-hover:visible group-hover:text-gray-900"
                          fontSize="small"
                        />
                      )}
                    </div>
                  </div>

                  {/* Label below the image */}
                  <span
                    className={classNames(
                      "mt-1 text-xs uppercase text-gray-700",
                      group.id === "transit"
                        ? "tracking-wide"
                        : "tracking-wider",
                    )}
                  >
                    {group.name}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </MenuItems>
    </Menu>
  );
};
