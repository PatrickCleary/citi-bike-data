import ChevronLeftSharpIcon from "@mui/icons-material/ChevronLeftSharp";
import ChevronRightSharpIcon from "@mui/icons-material/ChevronRightSharp";
import { useMapConfigStore } from "@/store/store";
import dayjs, { Dayjs } from "dayjs";
import { CalendarInput, isMonthYearValid } from "./calendar-input";
import { useQuery } from "@tanstack/react-query";
import { getMaxDate } from "@/utils/api";

export const getMonthDisplayText = (date: string | undefined) => {
  if (!date) return undefined;
  const dateObj = dayjs(date);
  const month = dateObj.format("MMM YYYY");
  return month.toUpperCase();
};
const dateButtonStyle =
  "flex h-12 w-12 items-center active:scale-95 disabled:text-gray-500 disabled:bg-cb-lighterGray justify-center bg-cb-white hover:bg-white transition border-cb-lightGray text-gray-900";
export const DateControl: React.FC = () => {
  const { selectedMonth, setSelectedMonth } = useMapConfigStore();
  const monthObj = dayjs(selectedMonth);
  const setMonth = (date: Dayjs) => {
    setSelectedMonth(date.format("YYYY-MM-DD"));
  };

  const query = useQuery({
    queryKey: ["max_date"],
    queryFn: getMaxDate,
  });

  return (
    <div className="pointer-events-auto font-sans" data-tour="date-control">
      <div className="flex flex-row bg-cb-lighterGray rounded-md overflow-hidden">
        <button
          className={dateButtonStyle}
          disabled={
            !isMonthYearValid(
              query,
              monthObj.subtract(1, "year").month(),
              monthObj.subtract(1, "year").year(),
            )
          }
          onClick={() => {
            setMonth(monthObj.subtract(1, "year"));
          }}
        >
          <div className="flex flex-row">
            <ChevronLeftSharpIcon fontSize="small" />
            <ChevronLeftSharpIcon className="-ml-4" fontSize="small" />
          </div>
        </button>
        <button
          className={dateButtonStyle}
          disabled={
            !isMonthYearValid(
              query,
              monthObj.subtract(1, "month").month(),
              monthObj.subtract(1, "month").year(),
            )
          }
          onClick={() => {
            setMonth(monthObj.subtract(1, "month"));
          }}
        >
          <ChevronLeftSharpIcon fontSize="small" />
        </button>
        <CalendarInput />
        <button
          className={dateButtonStyle}
          disabled={
            !isMonthYearValid(
              query,
              monthObj.add(1, "month").month(),
              monthObj.add(1, "month").year(),
            )
          }
          onClick={() => {
            setMonth(monthObj.add(1, "month"));
          }}
        >
          <ChevronRightSharpIcon fontSize="small" />
        </button>
        <button
          className={dateButtonStyle}
          disabled={
            !isMonthYearValid(
              query,
              monthObj.add(1, "year").month(),
              monthObj.add(1, "year").year(),
            )
          }
          onClick={() => {
            setMonth(monthObj.add(1, "year"));
          }}
        >
          <div className="flex flex-row">
            <ChevronRightSharpIcon fontSize="small" />
            <ChevronRightSharpIcon className="-ml-4" fontSize="small" />
          </div>
        </button>
      </div>
    </div>
  );
};
