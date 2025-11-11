"use client";
import {
  useLocationSearchStore,
  LocationResult,
} from "@/store/location-search-store";
import { searchLocation } from "@/utils/geocoding";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

export const LocationSearchModal: React.FC = () => {
  const { isOpen, setIsOpen, setSelectedLocation } = useLocationSearchStore();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["location-search", searchQuery],
    queryFn: () => searchLocation(searchQuery),
    enabled: searchQuery.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleSelectLocation = useCallback(
    (location: LocationResult) => {
      setSelectedLocation(location);
      setSearchQuery("");
    },
    [setSelectedLocation],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
  }, [setIsOpen]);

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm " />
      <div className="fixed inset-0 flex w-screen items-start justify-center p-4 pt-20">
        <DialogPanel className="w-full max-w-2xl rounded-lg bg-white font-light drop-shadow-2xl">
          <div className="border-b border-gray-200 p-4">
            <div className="relative">
              <SearchRoundedIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a location..."
                className="focus:ring-cb-blue w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isLoading && (
              <div className="p-4 text-center text-gray-500">Searching...</div>
            )}
            {!isLoading && results.length === 0 && searchQuery.trim() && (
              <div className="p-4 text-center text-gray-500">
                No results found
              </div>
            )}
            {!isLoading && results.length === 0 && !searchQuery.trim() && (
              <div className="p-4 text-center text-gray-400">
                Start typing to search for a location
              </div>
            )}
            {results.map((result, index) => (
              <button
                key={index}
                onClick={() => handleSelectLocation(result)}
                className="hover:bg-cb-blue/30 focus:bg-cb-blue/20 w-full border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 focus:outline-none"
              >
                <div className="font-light text-gray-900">{result.name}</div>
                <div className="text-sm text-gray-500">{result.label}</div>
              </button>
            ))}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
