import { useTripCountData } from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import { getMonthDisplayText } from "./date-control";

const getDisplayText = (trips, analysisType, departureCells) => {
  if (!departureCells || departureCells.length === 0) {
    return "Total trips";
  }
  if (departureCells.length >= 1) {
    return `${analysisType === "departures" ? "Arrivals to" : "Departures from"} selection`;
  }
};

export const TotalDisplay: React.FC = () => {
  const {
    analysisType,
    departureCells,
    swapAnalysisType,
    setDepartureCells,
    selectedMonth,
  } = useMapConfigStore();
  const query = useTripCountData();
  if (query.isLoading) {
    return null;
  }
  const totalTrips = query.data?.data.sum_all_values || 0;

  return (
    <div className="border-color-white/50 rounded-md border border-gray-300 bg-white/30 px-4 py-2 text-end font-bold text-black backdrop-blur-md">
      <button onClick={() => swapAnalysisType()}>{"< - > "}</button>
      <button onClick={() => setDepartureCells([])}>clear</button>

      <p>
        <span className="font-mono text-xl">{totalTrips.toLocaleString()}</span>
      </p>
      <p>{getDisplayText(totalTrips, analysisType, departureCells)}</p>
    </div>
  );
};
