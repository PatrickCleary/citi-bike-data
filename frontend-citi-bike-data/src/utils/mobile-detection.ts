export const isMobileDevice = (): boolean => {
  if (typeof window === "undefined") return false;

  // Check for touch capability and screen size
  const hasTouchScreen =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0;

  const isSmallScreen = window.innerWidth < 768; // md breakpoint in Tailwind

  return hasTouchScreen && isSmallScreen;
};
