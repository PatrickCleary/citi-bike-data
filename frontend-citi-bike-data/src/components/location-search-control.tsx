"use client";
import { MapButton } from "@/map/map-button";
import { useLocationSearchStore } from "@/store/location-search-store";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
export const LocationSearchControl: React.FC = () => {
  const { setIsOpen, selectedLocation, clearLocation } =
    useLocationSearchStore();

  return (
    <div className="pointer-events-auto flex w-fit flex-row gap-2">
      <MapButton onClick={() => setIsOpen(true)} title="Search for a location">
        <SearchRoundedIcon fontSize="small" />
      </MapButton>
      {selectedLocation && (
        <MapButton onClick={clearLocation} title="Clear location">
          <CloseRoundedIcon fontSize="small" />
        </MapButton>
      )}
    </div>
  );
};
