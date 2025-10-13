"use client";
import { MapButton } from "@/map/map-button";
import { useLocationSearchStore } from "@/store/location-search-store";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

export const LocationSearchControl: React.FC = () => {
  const { setIsOpen } = useLocationSearchStore();

  return (
    <div className="pointer-events-auto flex w-fit flex-row gap-2">
      <MapButton onClick={() => setIsOpen(true)} title="Search for a location">
        <SearchRoundedIcon fontSize="small" />
      </MapButton>
    </div>
  );
};
