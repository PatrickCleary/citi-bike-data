import { MapButtonStyle } from "@/map/map-button";
import { useMapConfigStore, useUpdateScaleMax } from "@/store/store";
import {
  Input,
  Menu,
  MenuButton,
  MenuItems,
  Switch,
  Tab,
  TabGroup,
  TabList,
} from "@headlessui/react";
import TuneIcon from "@mui/icons-material/Tune";
import classNames from "classnames";
import React, { MutableRefObject, useRef } from "react";

export const buttonHoverStyle =
  "data-[selected]:bg-cb-blue/30 focus:outline-none data-[focus]:bg-cb-blue/20  data-[selected]:data-[focus]:bg-cb-blue/30 data-[hover]:bg-cb-blue/20  data-[selected]:data-[hover]:bg-cb-blue/30  transition ease-out duration-100";

const tabStyle = classNames(
  "uppercase tracking-wide text-xs flex flex-row gap-2 justify-center items-center  transition rounded-full focus:outline-none w-32 px-2 py-1 text-gray-900 active:scale-95",
  buttonHoverStyle,
);

const absoluteGradient = `linear-gradient(to right,
  #440154, #482878, #3e4989, #31688e,
  #26828e, #35b779, #6ece58, #fde725)`;

const comparisonGradient = `linear-gradient(to right,
  #543005, #8c510a, #bf812d, #dfc27d,
  #d8d8d8, #80cdc1, #35978f, #01665e, #003c30)`;

export const DisplaySettings: React.FC = () => {
  const {
    scaleType,
    setScaleType,
    scale,
    setScale,
    displayType,
    setDisplayType,
    normalizeComparison,
    setNormalizeComparison,
  } = useMapConfigStore();
  useUpdateScaleMax();

  const selectedDisplayTypeIndex = displayType === "absolute" ? 0 : 1;
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
        data-tour="display-settings"
        className={classNames(
          MapButtonStyle,
          "pointer-events-auto focus:outline-none",
        )}
      >
        <TuneIcon fontSize="small" />
      </MenuButton>

      <MenuItems
        unmount={false}
        anchor="top start"
        transition
        className="pointer-events-auto z-10 flex origin-bottom-left flex-col gap-2 rounded-lg border-[0.5px] border-cb-lightGray bg-cb-white p-6 font-light text-black shadow-lg duration-100 ease-out [--anchor-gap:theme(spacing.1)] focus:outline-none data-[closed]:-translate-x-1 data-[closed]:translate-y-1 data-[closed]:opacity-0"
      >
        <div className="flex w-full flex-row gap-2">
          <p className="cursor-default text-xs uppercase tracking-wide text-gray-400">
            Mode
          </p>
        </div>
        <TabGroup
          selectedIndex={selectedDisplayTypeIndex}
          onChange={() =>
            setDisplayType(
              displayType === "absolute" ? "comparison" : "absolute",
            )
          }
        >
          <TabList className={"flex flex-row gap-2 text-sm text-gray-900"}>
            <Tab
              key={"absolute"}
              className="group relative flex w-32 flex-row items-center justify-center gap-2 overflow-hidden rounded-full px-2 py-1 text-xs uppercase tracking-wide text-gray-700 transition focus:outline-none active:scale-95"
            >
              <div
                className="absolute inset-0 opacity-0 transition-opacity group-data-[hover]:opacity-20 group-data-[selected]:group-data-[hover]:opacity-30 group-data-[selected]:opacity-30"
                style={{ background: absoluteGradient }}
              />
              <span className="relative z-10">absolute</span>
            </Tab>
            <Tab
              key={"comparison"}
              className="group relative flex w-32 flex-row items-center justify-center gap-2 overflow-hidden rounded-full px-2 py-1 text-xs uppercase tracking-wide text-gray-700 transition focus:outline-none active:scale-95"
            >
              <div
                className="absolute inset-0 opacity-0 transition-opacity group-data-[hover]:opacity-20 group-data-[selected]:group-data-[hover]:opacity-30 group-data-[selected]:opacity-30"
                style={{ background: comparisonGradient }}
              />
              <span className="relative z-10 tracking-wide">comparison</span>
            </Tab>
          </TabList>
        </TabGroup>

        {displayType === "comparison" && (
          <>
            <div className="flex flex-col gap-2 pl-4 pt-2">
              <div className="flex flex-row items-center justify-between gap-4">
                <div className="flex flex-col">
                  <p className="cursor-default text-xs font-light uppercase tracking-wide text-gray-500">
                    Normalize values
                  </p>
                  <p className="cursor-default text-xs text-gray-400">
                    Account for ridership changes
                  </p>
                </div>
                <Switch
                  checked={normalizeComparison}
                  onChange={setNormalizeComparison}
                  className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-300 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cb-green focus-visible:ring-offset-2 data-[checked]:bg-cb-blue"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out group-data-[checked]:translate-x-5"
                  />
                </Switch>
              </div>
            </div>
            <p className="max-w-sm text-sm text-gray-500 bg-gray-200 px-2 rounded-md py-1">
              Comparison mode shows the change in traffic between the currently
              selected month and the same month of the past year. Normalization
              adjusts the value so that overall ridership changes are accounted
              for.
            </p>
          </>
        )}

        {displayType === "absolute" && (
          <>
            <p className="cursor-default text-xs uppercase tracking-wide text-gray-400">
              Scale
            </p>
            <div className="flex w-full flex-col">
              <TabGroup
                selectedIndex={selectedIndexScale}
                onChange={(index) =>
                  setScaleType(index === 0 ? "dynamic" : "custom")
                }
              >
                <TabList
                  className={"flex flex-row gap-2 text-sm text-gray-900"}
                >
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
                    className="border-bg-white w-16 rounded-full border-[0.5px] bg-cb-white/50 text-center text-sm font-medium tabular-nums focus:outline-none"
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
                    className="border-bg-white w-16 rounded-full border-[0.5px] bg-cb-white/50 text-center text-sm font-medium focus:outline-none"
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
          </>
        )}
      </MenuItems>
    </Menu>
  );
};
