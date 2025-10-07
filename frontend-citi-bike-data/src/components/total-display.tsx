import { useTripCountData } from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";

import { spanClassName } from "@/map/popup";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import { AnalysisType } from "@/utils/api";

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
  const { analysisType, departureCells } = useMapConfigStore();
  const query = useTripCountData();
  const totalTrips = query.data?.data.sum_all_values || 0;

  return (
    <div className="flex w-full cursor-default flex-col flex-col-reverse items-center rounded-md bg-white/30 px-4 py-2 font-sans font-bold tracking-wide text-black drop-shadow-lg backdrop-blur-md md:w-48 md:flex-col md:items-end">
      <p className="flex w-full justify-center gap-[2px] rounded-sm font-light uppercase tracking-wider md:justify-start">
        {getDisplayText(analysisType, departureCells)}
        {departureCells.length > 0 && (
          <span className={spanClassName}>
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
            <span className="text-xl tabular-nums">
              {totalTrips.toLocaleString()}
            </span>
          </p>
        )}
      </div>
    </div>
  );
};
