import React from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { UseQueryResult } from "@tanstack/react-query";

import dayjs from "dayjs";
import { useMapConfigStore } from "@/store/store";
import classNames from "classnames";
import { buttonHoverStyle } from "./display-settings";
import { getMonthDisplayText } from "./date-control";
import { useMaxDate } from "@/map/map-config";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MIN_DATE = dayjs("2013-06-01");
export const isMonthYearValid = (
  query: UseQueryResult<string>,
  month: number,
  year: number,
) => {
  if (!query.data) return false;
  const maxDate = dayjs(query.data).startOf("month");
  const testDate = dayjs().year(year).month(month).startOf("month");

  return (
    (testDate.isBefore(maxDate) && testDate.isAfter(MIN_DATE)) ||
    testDate.isSame(maxDate) ||
    testDate.isSame(MIN_DATE)
  );
};

const YEARS = Array.from({ length: 2025 - 2013 + 1 }, (_, i) => 2013 + i);

export const CalendarInput: React.FC = () => {
  const { selectedMonth, setSelectedMonth } = useMapConfigStore();

  const selectedDateObj = dayjs(selectedMonth);
  const query = useMaxDate();

  const error = !isMonthYearValid(
    query,
    selectedDateObj.month(),
    selectedDateObj.year(),
  );
  const updateMonth = (month: number) => {
    const newDate = selectedDateObj.month(month);
    setSelectedMonth(newDate.format("YYYY-MM-DD"));
  };
  const updateYear = (year: number) => {
    const newDate = selectedDateObj.year(year);
    setSelectedMonth(newDate.format("YYYY-MM-DD"));
  };

  return (
    <Popover>
      <PopoverButton
        title="Select Month"
        className={
          "flex h-12 w-24 flex-col items-center justify-center rounded-md border-[0.5px] border-cb-lightGray bg-cb-white hover:bg-white px-2 tabular-nums tracking-wide text-gray-900 drop-shadow-md backdrop-blur-md transition active:scale-95"
        }
      >
        <CalendarMonthIcon fontSize="small" />
        {getMonthDisplayText(selectedMonth)}
      </PopoverButton>
      <PopoverPanel
        transition
        anchor="bottom"
        className="z-10 drop-shadow-md transition duration-200 ease-in-out [--anchor-gap:theme(spacing.1)] data-[closed]:translate-y-1 data-[closed]:opacity-0"
      >
        <div className="rounded-lg border-[0.5px] border-cb-lightGray bg-cb-white p-3 text-gray-900">
          <div className="flex w-full gap-2">
            <Listbox value={selectedDateObj.month()} onChange={updateMonth}>
              <ListboxButton className="w-32 rounded-md border-[0.5px] border-cb-lightGray bg-cb-lightGray/10 px-3 py-2 text-left text-center font-light tracking-wide text-gray-700 focus:outline-none data-[focus]:bg-cb-white data-[hover]:bg-cb-white data-[focus]:text-gray-900">
                {MONTHS[selectedDateObj.month()]}
              </ListboxButton>
              <ListboxOptions
                anchor="top"
                className="z-20 mt-2 max-h-60 w-[var(--button-width)] origin-top-left overflow-auto rounded-lg border border-[0.5px] border-cb-lightGray border-white/10 bg-cb-white text-gray-900 drop-shadow-md [--anchor-gap:theme(spacing.1)] [--anchor-gap:theme(spacing.3)]"
              >
                {MONTHS.map((month, index) => {
                  const isValid = isMonthYearValid(
                    query,
                    index,
                    selectedDateObj.year(),
                  );
                  return (
                    <ListboxOption
                      key={month}
                      value={index}
                      className={classNames(
                        buttonHoverStyle,
                        `cursor-pointer px-3 py-2 text-sm font-light tracking-wide ${isValid ? "" : "text-cb-lightGray"}`,
                      )}
                    >
                      {month}
                    </ListboxOption>
                  );
                })}
              </ListboxOptions>
            </Listbox>
            <Listbox value={selectedDateObj.year()} onChange={updateYear}>
              <ListboxButton className="w-32 rounded-md border-[0.5px] border-cb-lightGray bg-cb-lightGray/10 px-3 py-2 text-left text-center font-light tracking-wide text-gray-700 focus:outline-none data-[focus]:bg-cb-white data-[hover]:bg-cb-white data-[focus]:text-gray-900">
                {selectedDateObj.year()}
              </ListboxButton>
              <ListboxOptions
                anchor="top"
                className="z-20 mt-2 max-h-60 w-[var(--button-width)] origin-top-left overflow-auto rounded-lg border border-[0.5px] border-cb-lightGray border-white/10 bg-cb-white text-gray-900 drop-shadow-md [--anchor-gap:theme(spacing.1)] [--anchor-gap:theme(spacing.3)]"
              >
                {YEARS.map((year) => {
                  const isValid = isMonthYearValid(
                    query,
                    selectedDateObj.month(),
                    year,
                  );
                  return (
                    <ListboxOption
                      key={year}
                      value={year}
                      className={classNames(
                        buttonHoverStyle,
                        `cursor-pointer px-3 py-2 text-sm font-light tabular-nums tracking-wide ${isValid ? "" : "text-cb-lightGray"}`,
                      )}
                    >
                      {year}
                    </ListboxOption>
                  );
                })}
              </ListboxOptions>
            </Listbox>
          </div>
          {error && (
            <div className="mt-1 h-5 text-center">
              <p className="text-sm font-light text-red-500">
                No data available for this month
              </p>
            </div>
          )}
        </div>
      </PopoverPanel>
    </Popover>
  );
};
