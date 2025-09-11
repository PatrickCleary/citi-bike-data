import { useMapConfigStore } from "@/store/store";
import dayjs from "dayjs";
import React from "react";

const getMonthDisplayText = (date: string) => {
  const dateObj = dayjs(date);
  const month = dateObj.format("MMM YYYY");
  return month.toUpperCase();
};

export const DateDisplay: React.FC = () => {
  const { selectedMonth } = useMapConfigStore();
  const month = getMonthDisplayText(selectedMonth);

  return (
    <div className="fixed z-10 text-3xl font-bold right-4 bottom-4 text-black">
      <p>{month}</p>
    </div>
  );
};
