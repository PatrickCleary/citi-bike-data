"use client";
import React, { useEffect } from "react";
import { Map } from "maplibre-gl";
import { MutableRefObject } from "react";
import { Menu, MenuButton, MenuItems } from "@headlessui/react";
import classNames from "classnames";
import LayersIcon from "@mui/icons-material/Layers";
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
        className="pointer-events-auto z-10 flex origin-bottom-left flex-col items-center rounded-lg border-[0.5px] border-cb-lightGray bg-cb-white p-4 font-light text-black shadow-lg duration-100 ease-out [--anchor-gap:theme(spacing.1)] focus:outline-none data-[closed]:-translate-x-1 data-[closed]:translate-y-1 data-[closed]:opacity-0"
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
                      "relative h-16 w-full cursor-pointer overflow-hidden rounded outline-cb-green",
                      group.visible ? "outline" : "outline-hidden",
                    )}
                    style={{
                      backgroundImage: `url("/${group.id}.jpg")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  ></div>

                  {/* Label below the image */}
                  <span
                    className={classNames(
                      "mt-1 rounded-full px-2 text-xs uppercase text-gray-700 transition duration-100 ease-out group-hover:bg-cb-green/20",
                      group.id === "bike" ? "tracking-wider" : "tracking-wide",
                      group.visible
                        ? "bg-cb-green/30 group-hover:bg-cb-green/30"
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
