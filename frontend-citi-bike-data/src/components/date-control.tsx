import ChevronLeftSharpIcon from "@mui/icons-material/ChevronLeftSharp";
import ChevronRightSharpIcon from "@mui/icons-material/ChevronRightSharp";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { MapButton } from "@/map/map-button";
import { useMapConfigStore } from "@/store/store";
import dayjs, { Dayjs } from "dayjs";
import { CalendarInput } from "./calendar-input";

export const getMonthDisplayText = (date: string) => {
  const dateObj = dayjs(date);
  const month = dateObj.format("MMM YYYY");
  return month.toUpperCase();
};
export const DateControl: React.FC = () => {
  const { selectedMonth, setSelectedMonth } = useMapConfigStore();
  const month = getMonthDisplayText(selectedMonth);
  const monthObj = dayjs(selectedMonth);
  const setMonth = (date: Dayjs) => {
    setSelectedMonth(date.format("YYYY-MM-DD"));
  };
  return (
    <div className="flex flex-col items-center">
      <p className="text-xl font-bold text-gray-900">{month}</p>
      <div className="flex flex-row gap-1">
        <MapButton
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
          onClick={() => {
            setMonth(monthObj.subtract(1, "month"));
          }}
        >
          <ChevronLeftSharpIcon fontSize="small" />
        </MapButton>
        <CalendarInput />
        <MapButton
          onClick={() => {
            setMonth(monthObj.add(1, "month"));
          }}
        >
          <ChevronRightSharpIcon fontSize="small" />
        </MapButton>
        <MapButton
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
