import { useMapConfigStore } from "@/store/store";
import dayjs, { Dayjs } from "dayjs";
import React from "react";

const getMonthDisplayText = (date: string) => {
  const dateObj = dayjs(date);
  const month = dateObj.format("MMM YYYY");
  return month.toUpperCase();
};

export const DateDisplay: React.FC = () => {
  const { selectedMonth, setSelectedMonth } = useMapConfigStore();
  const month = getMonthDisplayText(selectedMonth);
  const monthObj = dayjs(selectedMonth);
  console.log(selectedMonth)
  const setMonth = (date: Dayjs) => {
    setSelectedMonth(date.format("YYYY-MM-DD"));
  };

  return (
    <div className="z-10 text-3xl font-bold text-black">
      <p>{month}</p>
      <button
        onClick={() => {
          setMonth(monthObj.subtract(1, "month"));
        }}
      >
        {"<"}
      </button>
      <button
        onClick={() => {
          setMonth(monthObj.add(1, "month"));
        }}
      >
        {">"}
      </button>
    </div>
  );
};
