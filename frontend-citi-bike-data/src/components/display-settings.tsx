import { MapButtonStyle } from "@/map/map-button";
import { useMapConfigStore, useUpdateScaleMax } from "@/store/store";
import {
  Input,
  Menu,
  MenuButton,
  MenuItems,
  Tab,
  TabGroup,
  TabList,
} from "@headlessui/react";
import PedalBikeRounded from "@mui/icons-material/PedalBikeRounded";
import TuneIcon from "@mui/icons-material/Tune";
import classNames from "classnames";
import React, { MutableRefObject, useRef } from "react";

export const buttonHoverStyle =
  "data-[selected]:bg-cb-blue/30 focus:outline-none data-[focus]:bg-cb-blue/20  data-[selected]:data-[focus]:bg-cb-blue/30 data-[hover]:bg-cb-blue/20  data-[selected]:data-[hover]:bg-cb-blue/30  transition ease-out duration-100";

const tabStyle = classNames(
  "uppercase tracking-wide text-xs flex flex-row gap-2 justify-center items-center  transition rounded-full focus:outline-none w-32 px-2 py-1 text-gray-900",
  buttonHoverStyle,
);
export const DisplaySettings: React.FC = () => {
  const {
    swapAnalysisType,
    analysisType,
    scaleType,
    setScaleType,
    scale,
    setScale,
  } = useMapConfigStore();
  useUpdateScaleMax();
  const selectedIndexAnalysis = analysisType === "arrivals" ? 0 : 1;
  const selectedIndexScale = scaleType === "dynamic" ? 0 : 1;

  const inputRef1 = useRef<HTMLInputElement | null>(null);
  const inputRef2 = useRef<HTMLInputElement | null>(null);

  const selectText = (ref: MutableRefObject<HTMLInputElement | null>) => {
    if (ref.current) ref.current.select();
  };
  const showError = scale[0] >= scale[1];

  return (
    <Menu>
      <MenuButton
        title="Display Settings"
        className={classNames(
          MapButtonStyle,
          "pointer-events-auto focus:outline-none",
        )}
      >
        <TuneIcon fontSize="small" />
      </MenuButton>
      <MenuItems
        anchor="top start"
        transition
        className="border-cb-lightGray bg-cb-white pointer-events-auto z-10 flex origin-bottom-left flex-col rounded-lg border-[0.5px] p-6 font-light text-black shadow-lg duration-100 ease-out [--anchor-gap:theme(spacing.1)] focus:outline-none data-[closed]:-translate-x-1 data-[closed]:translate-y-1 data-[closed]:opacity-0"
      >
        <TabGroup
          selectedIndex={selectedIndexAnalysis}
          onChange={() => swapAnalysisType()}
        >
          <TabList className={"flex flex-row gap-2 text-sm text-gray-900"}>
            <Tab key={"arrivals"} className={tabStyle}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "1.25rem" }}
              >
                bike_dock
              </span>
              Drop-offs
            </Tab>
            <Tab key={"departures"} className={tabStyle}>
              <PedalBikeRounded fontSize="small" />
              Pickups
            </Tab>
          </TabList>
        </TabGroup>
        <hr className="bg-cb-lightGray my-2" />

        <p className="mb-2 cursor-default text-xs uppercase tracking-wide text-gray-400">
          Scale
        </p>
        <div className="flex w-full flex-col">
          <TabGroup
            selectedIndex={selectedIndexScale}
            onChange={(index) =>
              setScaleType(index === 0 ? "dynamic" : "custom")
            }
          >
            <TabList className={"flex flex-row gap-2 text-sm text-gray-900"}>
              <Tab key={"dynamic"} className={tabStyle}>
                Dynamic
              </Tab>
              <Tab key={"custom"} className={tabStyle}>
                Custom
              </Tab>
            </TabList>
          </TabGroup>
          {scaleType === "custom" && (
            <div
              className="mt-2 flex h-8 w-full flex-row items-center justify-between rounded-full bg-gradient-to-r px-2 font-semibold tabular-nums text-gray-900"
              style={{
                background: `linear-gradient(to right, 
                  #440154, #482878, #3e4989, #31688e, 
                  #26828e, #35b779, #6ece58, #fde725)`,
              }}
            >
              <Input
                value={scale[0]}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setScale([value, scale[1]]);
                }}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(
                    /[^0-9]/g,
                    "",
                  );
                }}
                className="bg-cb-white/50 border-bg-white w-16 rounded-full border-[0.5px] text-center text-sm font-medium tabular-nums focus:outline-none"
                inputMode="numeric"
                pattern="[0-9]*"
                ref={inputRef1}
                onClick={() => selectText(inputRef1)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    const increment = e.shiftKey ? 10 : 1;
                    setScale([scale[0] + increment, scale[1]]);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const decrement = e.shiftKey ? 10 : 1;
                    setScale([scale[0] - decrement, scale[1]]);
                  }
                }}
              />
              <Input
                value={scale[1]}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setScale([scale[0], value]);
                }}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(
                    /[^0-9]/g,
                    "",
                  );
                }}
                className="bg-cb-white/50 border-bg-white w-16 rounded-full border-[0.5px] text-center text-sm font-medium focus:outline-none"
                inputMode="numeric"
                pattern="[0-9]*"
                ref={inputRef2}
                onClick={() => selectText(inputRef2)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    const increment = e.shiftKey ? 10 : 1;
                    setScale([scale[0], scale[1] + increment]);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const decrement = e.shiftKey ? 10 : 1;
                    setScale([scale[0], scale[1] - decrement]);
                  }
                }}
              />
            </div>
          )}
          <p
            className={classNames(
              showError ? "flex" : "hidden",
              "flex w-full cursor-default text-wrap text-center text-sm text-red-500",
            )}
          >
            Scale max must be greater than scale min
          </p>
        </div>
      </MenuItems>
    </Menu>
  );
};
