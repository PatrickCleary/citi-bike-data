import { create } from "zustand";

interface IntroModalStore {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  hasVisited: boolean;
  markAsVisited: () => void;
}

export const useIntroModalStore = create<IntroModalStore>((set) => ({
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  hasVisited: false,
  markAsVisited: () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("citibike-data-visited", "true");
      set({ hasVisited: true, isOpen: false });
    }
  },
}));

// Initialize the hasVisited state from localStorage
if (typeof window !== "undefined") {
  const hasVisited = localStorage.getItem("citibike-data-visited") === "true";
  const hasUrlParams = window.location.search.length > 0;
  useIntroModalStore.setState({
    hasVisited,
    isOpen: !hasVisited && !hasUrlParams, // Open modal on first visit, but not if URL params are present
  });
}
