import { useTripCountData } from "@/map/map-config";

export const TotalDisplay: React.FC = () => {
  const query = useTripCountData();
  if (query.isLoading) {
    return null;
  }
  const totalTrips = query.data?.data.sum_all_values || 0;
  return (
    <div
      className="text-3xl font-bold text-black"
      
    >
      <p>{totalTrips.toLocaleString()}</p>
    </div>
  );
};
