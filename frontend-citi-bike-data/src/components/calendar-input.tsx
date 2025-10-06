import React, { useEffect } from "react";
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

import { MapButtonStyle } from "@/map/map-button";
import { useQuery } from "@tanstack/react-query";
import { getMaxDate } from "@/utils/api";
import dayjs from "dayjs";
import { useMapConfigStore } from "@/store/store";

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

const YEARS = Array.from({ length: 2025 - 2013 + 1 }, (_, i) => 2013 + i);

export const CalendarInput: React.FC = () => {
  const { selectedMonth, setSelectedMonth } = useMapConfigStore();
  const selectedMonthDateObj = dayjs(selectedMonth);

  const [selectedMonthLocal, setSelectedMonthLocal] = React.useState(
    selectedMonthDateObj.month(),
  );
  const [selectedYear, setSelectedYear] = React.useState(
    selectedMonthDateObj.year(),
  );

  const query = useQuery({
    queryKey: ["max_date"],
    queryFn: getMaxDate,
  });
  const maxDate = dayjs(query.data).startOf("month");

  const isMonthYearAfterMax = (month: number, year: number) => {
    if (!query.data) return false;
    const testDate = dayjs().year(year).month(month).startOf("month");
    return !testDate.isBefore(maxDate) && !testDate.isSame(maxDate);
  };
  const error = isMonthYearAfterMax(selectedMonthLocal, selectedYear);
  useEffect(() => {
    if (!error)
      setSelectedMonth(
        dayjs()
          .year(selectedYear)
          .month(selectedMonthLocal)
          .date(1)
          .format("YYYY-MM-DD"),
      );
  }, [selectedMonthLocal, selectedYear]);

  return (
    <Popover>
      <PopoverButton className={MapButtonStyle}>
        <CalendarMonthIcon fontSize="small" />
      </PopoverButton>
      <PopoverPanel
        transition
        anchor="bottom"
        className="z-10 transition duration-200 ease-in-out [--anchor-gap:theme(spacing.1)] data-[closed]:translate-y-1 data-[closed]:opacity-0"
      >
        <div className="bg-cb-white border-cb-lightGray rounded-lg border-[0.5px] p-3 text-gray-900">
          <div className="flex w-full gap-2">
            <Listbox
              value={selectedMonthLocal}
              onChange={setSelectedMonthLocal}
            >
              <ListboxButton className="border-cb-lightGray/50 w-32 rounded-md border bg-white/5 px-3 py-2 text-left text-center text-gray-900 focus:outline-none">
                {MONTHS[selectedMonthLocal]}
              </ListboxButton>F
              <ListboxOptions
                anchor="top"
                className="bg-cb-white border-cb-lightGray z-20 mt-2 max-h-60 w-[var(--button-width)] origin-top-left overflow-auto rounded-lg border border-[0.5px] border-white/10 text-gray-900 [--anchor-gap:theme(spacing.1)] [--anchor-gap:theme(spacing.3)]"
              >
                {MONTHS.map((month, index) => {
                  const isAfterMax = isMonthYearAfterMax(index, selectedYear);
                  return (
                    <ListboxOption
                      key={month}
                      value={index}
                      className={`data-[focus]:bg-cb-lightGray/10 data-[selected]:bg-cb-lightGray/20 data-[selected]:data-[hover]:bg-cb-lightGray/20 cursor-pointer px-3 py-2 ${isAfterMax ? "text-cb-lightGray" : ""}`}
                    >
                      {month}
                    </ListboxOption>
                  );
                })}
              </ListboxOptions>
            </Listbox>
            <Listbox value={selectedYear} onChange={setSelectedYear}>
              <ListboxButton className="border-cb-lightGray/50 w-24 rounded-md border bg-white/5 px-3 py-2 text-left text-center text-gray-900 focus:outline-none">
                {" "}
                {selectedYear}
              </ListboxButton>
              <ListboxOptions
                anchor="top"
                className="bg-cb-white border-cb-lightGray z-20 mt-2 max-h-60 w-[var(--button-width)] origin-top-left overflow-auto rounded-lg border border-[0.5px] border-white/10 text-gray-900 [--anchor-gap:theme(spacing.1)] [--anchor-gap:theme(spacing.3)]"
              >
                {YEARS.map((year) => {
                  const isAfterMax = isMonthYearAfterMax(
                    selectedMonthLocal,
                    year,
                  );
                  return (
                    <ListboxOption
                      key={year}
                      value={year}
                      className={`data-[focus]:bg-cb-lightGray/20 cursor-pointer px-3 py-2 ${isAfterMax ? "text-cb-lightGray" : ""}`}
                    >
                      {year}
                    </ListboxOption>
                  );
                })}
              </ListboxOptions>
            </Listbox>
          </div>
          {/* <div className="mt-1 h-5 text-center">
            {error && (
              <p className="text-sm font-light text-red-600">
                No data available for this month
              </p>
            )}
          </div> */}
        </div>
      </PopoverPanel>
    </Popover>
  );
};
