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
  useIntroModalStore.setState({
    hasVisited,
    isOpen: !hasVisited // Open modal on first visit
  });
}
