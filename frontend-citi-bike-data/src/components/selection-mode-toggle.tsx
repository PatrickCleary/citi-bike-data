import React from "react";
import { useMapConfigStore } from "@/store/store";
import { Tab, TabGroup, TabList } from "@headlessui/react";
import { MapButtonStyle } from "@/map/map-button";
import classNames from "classnames";

const tabStyle = classNames(
  "uppercase tracking-wide text-xs flex flex-row gap-2 justify-center items-center transition rounded-md focus:outline-none w-24 px-2 py-1.5 text-gray-900 active:scale-95",
  "data-[selected]:bg-cb-green/30 focus:outline-none data-[focus]:bg-cb-green/20 data-[selected]:data-[focus]:bg-cb-green/30 data-[hover]:bg-cb-green/20 data-[selected]:data-[hover]:bg-cb-green/30 transition ease-out duration-100",
);

export const SelectionModeToggle: React.FC = () => {
  const { selectionMode, setSelectionMode } = useMapConfigStore();
  const selectedIndex = selectionMode === "origin" ? 0 : 1;

  return (
    <div
      className={classNames(
        MapButtonStyle,
        "pointer-events-auto hidden md:flex w-fit p-1",
      )}
    >
      <TabGroup
        selectedIndex={selectedIndex}
        onChange={(index) =>
          setSelectionMode(index === 0 ? "origin" : "destination")
        }
      >
        <TabList className="flex flex-row gap-1 text-sm text-gray-900">
          <Tab key="origin" className={tabStyle}>
            Origin
          </Tab>
          <Tab key="destination" className={tabStyle}>
            Destination
          </Tab>
        </TabList>
      </TabGroup>
    </div>
  );
};
