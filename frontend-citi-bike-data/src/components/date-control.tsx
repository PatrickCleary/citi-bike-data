import ChevronLeftSharpIcon from "@mui/icons-material/ChevronLeftSharp";
import ChevronRightSharpIcon from "@mui/icons-material/ChevronRightSharp";
import { MapButton } from "@/map/map-button";
import { useMapConfigStore } from "@/store/store";
import dayjs, { Dayjs } from "dayjs";
import { CalendarInput, isMonthYearValid } from "./calendar-input";
import { useQuery } from "@tanstack/react-query";
import { getMaxDate } from "@/utils/api";

export const getMonthDisplayText = (date: string | undefined) => {
  if (!date) return "";
  const dateObj = dayjs(date);
  const month = dateObj.format("MMM YYYY");
  return month.toUpperCase();
};
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
    <div className="pointer-events-auto font-sans">
      <div className="flex flex-row gap-1">
        <MapButton
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
        </MapButton>
        <MapButton
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
        </MapButton>
        <CalendarInput />
        <MapButton
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
        </MapButton>
        <MapButton
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
        </MapButton>
      </div>
    </div>
  );
};
