import React, { useRef, useEffect } from "react";
import classNames from "classnames";
import { AnimatedNumber } from "./animated-digits";

interface LoadingNumberProps {
  /** The current value to display */
  value: string | number;
  /** Whether the data is currently loading */
  isLoading: boolean;
  /** Optional className to apply to the number */
  className?: string;
  /** Optional className to apply specifically during the loading/blur state */
  loadingClassName?: string;
}

/**
 * A component that shows a blurred previous value while loading,
 * then animates to the new value using AnimatedNumber.
 *
 * @example
 * ```tsx
 * <LoadingNumber
 *   value={totalTrips}
 *   isLoading={query.isLoading}
 *   className="text-lg font-semibold"
 * />
 * ```
 */
export const LoadingNumber: React.FC<LoadingNumberProps> = ({
  value,
  isLoading,
  className,
  loadingClassName,
}) => {
  const previousValueRef = useRef(value);

  // Update the previous value only when we're not loading and have a new value
  useEffect(() => {
    if (!isLoading) {
      previousValueRef.current = value;
    }
  }, [isLoading, value]);

  if (isLoading) {
    // Show the blurred previous value while loading
    const displayValue = previousValueRef.current;
    return (
      <span
        className={classNames(
          "animate-pulse tabular-nums blur-sm",
          className,
          loadingClassName,
        )}
      >
        {typeof displayValue === "number"
          ? displayValue.toLocaleString()
          : displayValue}
      </span>
    );
  }

  // Show the animated new value when loaded
  return <AnimatedNumber value={value} className={className} />;
};
