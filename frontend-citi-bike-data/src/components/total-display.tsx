import { useTripCountData } from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";

import { spanClassName } from "@/map/popup";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import { AnalysisType } from "@/utils/api";
import dayjs from "dayjs";
import classNames from "classnames";

const getDisplayText = (
  analysisType: AnalysisType,
  departureCells: string[],
) => {
  if (!departureCells || departureCells.length === 0) {
    return "Total trips";
  }
  if (departureCells.length >= 1) {
    return `${analysisType === "departures" ? "trips to" : "trips from"}`;
  }
};

export const TotalDisplay: React.FC = () => {
  const { analysisType, departureCells, selectedMonth } = useMapConfigStore();
  const dateObj = dayjs(selectedMonth);
  const startDate = dateObj.format("MMMM YYYY");
  const query = useTripCountData();
  const totalTrips = query.data?.data.sum_all_values || 0;

  return (
    <div className="border-cb-white/40 flex w-full cursor-default flex-col items-center rounded-md border-[0.5px] bg-white/30 px-4 py-2 font-sans font-bold tracking-wide text-black drop-shadow-md backdrop-blur-md md:w-48 md:flex-col md:items-start">
      <p className="flex w-full justify-center gap-[2px] rounded-sm font-light uppercase tracking-wider text-gray-500 md:justify-start">
        {getDisplayText(analysisType, departureCells)}
        {departureCells.length > 0 && (
          <span
            className={classNames(spanClassName, "font-semibold text-gray-900")}
          >
            <span>area</span>
            <HexagonOutlinedIcon fontSize="small" />
          </span>
        )}
      </p>
      <div className="flex w-full flex-row justify-center gap-1 text-left md:justify-start">
        {query.isLoading ? (
          <span className="animate-pulse text-xl blur-sm">0</span>
        ) : (
          <p>
            <span className="text-xl tabular-nums tracking-wider text-gray-900">
              {totalTrips.toLocaleString()}
            </span>
          </p>
        )}
      </div>
      <h1 className="cursor-default text-left text-xs font-light uppercase tracking-wider text-gray-900">
        {startDate}
      </h1>
    </div>
  );
};
