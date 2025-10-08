"use client";
import React, { useEffect } from "react";
import { Map } from "maplibre-gl";
import { MutableRefObject } from "react";
import { Menu, MenuButton, MenuItems } from "@headlessui/react";
import classNames from "classnames";
import LayersIcon from "@mui/icons-material/Layers";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { MapButtonStyle } from "@/map/map-button";
import { useLayerVisibilityStore } from "@/store/layer-visibility-store";

interface LayerControlProps {
  map: MutableRefObject<Map | null>;
  mapLoaded: boolean;
}

export const LayerControl: React.FC<LayerControlProps> = ({
  map,
  mapLoaded,
}) => {
  const { layerGroups, toggleLayerGroup, layersAdded } =
    useLayerVisibilityStore();

  // Sync store state with map visibility when map loads or layer visibility changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !layersAdded) return;

    layerGroups.forEach((group) => {
      group.layerIds.forEach((layerId) => {
        if (map.current?.getLayer(layerId)) {
          map.current.setLayoutProperty(
            layerId,
            "visibility",
            group.visible ? "visible" : "none",
          );
        }
      });
    });
  }, [map, mapLoaded, layerGroups, layersAdded]);

  const handleToggle = (groupId: string) => {
    if (!map.current || !mapLoaded) return;
    toggleLayerGroup(groupId);
  };
  return (
    <Menu>
      <MenuButton
        title="Toggle Layers"
        className={classNames(
          MapButtonStyle,
          "pointer-events-auto focus:outline-none",
        )}
      >
        <LayersIcon fontSize="small" />
      </MenuButton>

      <MenuItems
        anchor="bottom start"
        transition
        className="bg-cb-white border-cb-lightGray pointer-events-auto z-10 flex origin-bottom-left flex-col items-center rounded-lg border-[0.5px] p-4 font-light text-black shadow-lg duration-100 ease-out [--anchor-gap:theme(spacing.1)] focus:outline-none data-[closed]:-translate-x-1 data-[closed]:translate-y-1 data-[closed]:opacity-0"
      >
        <div className="flex flex-col items-center space-y-2">
          {layerGroups.map((group) => (
            <div key={group.id} className="flex w-full flex-col">
              <div className="flex w-full items-start gap-2">
                {/* Image with visibility toggle */}
                <button
                  className="group flex w-full flex-col items-center"
                  onClick={() => handleToggle(group.id)}
                >
                  <div
                    className={classNames(
                      "outline-cb-blue relative h-16 w-full cursor-pointer overflow-hidden rounded",
                      group.visible ? "outline" : "outline-hidden",
                    )}
                    style={{
                      backgroundImage: `url("/${group.id}.jpg")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {/* Overlay that lightens on hover */}
                    <div
                      className={classNames(
                        "bg-cb-blue absolute inset-0 opacity-0 transition-opacity group-hover:opacity-30",
                      )}
                    ></div>

                    {/* Icon on top of overlay */}
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                      {!group.visible ? (
                        <VisibilityOffOutlinedIcon
                          className="invisible text-gray-700 group-hover:visible group-hover:text-gray-900"
                          fontSize="small"
                        />
                      ) : (
                        <VisibilityOutlinedIcon
                          className="invisible text-gray-700 group-hover:visible group-hover:text-gray-900"
                          fontSize="small"
                        />
                      )}
                    </div>
                  </div>

                  {/* Label below the image */}
                  <span
                    className={classNames(
                      "group-hover:bg-cb-blue/20 mt-1 rounded-full px-2 text-xs uppercase text-gray-700 transition duration-100 ease-out",
                      group.id === "bike" ? "tracking-wider" : "tracking-wide",
                      group.visible
                        ? "bg-cb-blue/30 group-hover:bg-cb-blue/30"
                        : "",
                    )}
                  >
                    {group.name}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </MenuItems>
    </Menu>
  );
};
