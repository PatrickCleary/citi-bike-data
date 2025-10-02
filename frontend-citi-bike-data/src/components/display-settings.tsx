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
import TuneIcon from "@mui/icons-material/Tune";
import classNames from "classnames";
import React, { MutableRefObject, useRef } from "react";

const tabStyle =
  "data-[selected]:bg-cb-lightGray data-[hover]:bg-cb-lightGray/50  data-[selected]:data-[hover]:bg-cb-lightGray transition font-light rounded-full focus:outline-none w-32 px-2 py-1 text-gray-900";
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
    <div className="absolute bottom-16 left-4 z-10 text-right">
      <Menu>
        <MenuButton className={MapButtonStyle}>
          <TuneIcon />
        </MenuButton>
        <MenuItems
          anchor="top start"
          transition
          className="flex origin-bottom-left flex-col rounded-lg border border-gray-300 bg-white p-4 font-thin text-black shadow-lg [--anchor-gap:theme(spacing.1)] focus:outline-none"
        >
          <p className="mb-2 text-xs">Aggregation</p>
          <TabGroup
            selectedIndex={selectedIndexAnalysis}
            onChange={() => swapAnalysisType()}
          >
            <TabList
              className={"ml-2 flex flex-row gap-2 text-sm text-gray-900"}
            >
              <Tab key={"arrivals"} className={tabStyle}>
                Arrivals
              </Tab>
              <Tab key={"departures"} className={tabStyle}>
                Departures
              </Tab>
            </TabList>
          </TabGroup>
          <hr className="border-cb-white my-2 border-[0.5px]" />

          <p className="text-xs">Scale</p>
          <div className="flex w-full flex-col pl-2">
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
              <div className="mt-2 flex h-8 w-full flex-row items-center justify-between rounded-full bg-gradient-to-r from-[#1a2a6c] via-[#b21f1f] to-[#fdbb2d] px-2 font-semibold tabular-nums text-gray-900">
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
                  className="bg-cb-white/50 border-bg-white w-16 rounded-full border-[0.5px] text-center text-sm tabular-nums focus:outline-none"
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
                  className="bg-cb-white/50 border-bg-white w-16 rounded-full border-[0.5px] text-center text-sm focus:outline-none"
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
                showError ? "visible" : "invisible",
                "flex w-full text-center text-xs italic text-red-500",
              )}
            >
              Scale maximum must be greater than minimum
            </p>
          </div>
        </MenuItems>
      </Menu>
    </div>
  );
};
