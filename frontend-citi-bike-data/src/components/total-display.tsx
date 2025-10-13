import { useTripCountData } from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";

import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import { AnalysisType } from "@/utils/api";
import dayjs from "dayjs";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

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

interface AnimatedDigitProps {
  digit: string;
  index: number;
  animationKey: number;
}

const AnimatedDigit: React.FC<AnimatedDigitProps> = ({
  digit,
  index,
  animationKey,
}) => {
  return (
    <span
      key={`${animationKey}-${index}`}
      className={classNames(
        "inline-block",
        "animate-[slideDown_0.3s_ease-out_forwards] opacity-0",
      )}
      style={{
        animationDelay: `${index * 30}ms`,
      }}
    >
      {digit}
    </span>
  );
};

interface AnimatedNumberProps {
  value: number;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value }) => {
  const [animationKey, setAnimationKey] = useState(0);
  const previousValueRef = useRef(value);

  useEffect(() => {
    setAnimationKey((prev) => prev + 1);
    previousValueRef.current = value;
  }, [value]);

  const formattedNumber = value.toLocaleString();
  const digits = formattedNumber.split("");

  return (
    <span className="text-xl tabular-nums tracking-wider text-gray-900">
      {digits.map((digit, index) => (
        <AnimatedDigit
          key={`${animationKey}-${index}`}
          digit={digit}
          index={index}
          animationKey={animationKey}
        />
      ))}
    </span>
  );
};

export const TotalDisplay: React.FC = () => {
  const { analysisType, departureCells, selectedMonth } = useMapConfigStore();
  const dateObj = dayjs(selectedMonth);
  const startDate = dateObj.format("MMMM YYYY");
  const query = useTripCountData();
  const totalTrips = query.data?.data.sum_all_values || 0;

  return (
    <div className="w-52 flex w-full cursor-default flex-col items-center rounded-md border-[0.5px] border-cb-white/40 bg-white/30 px-4 py-2 font-sans font-bold tracking-wide text-black drop-shadow-md backdrop-blur-md md:flex-col">
      <p className="flex w-full justify-center gap-[2px] rounded-sm font-light uppercase tracking-wider text-gray-600">
        {getDisplayText(analysisType, departureCells)}
        {departureCells.length > 0 && (
          <span className={classNames("flex items-center text-gray-900")}>
            <span>selection</span>
            <HexagonOutlinedIcon fontSize="small" className="ml-1" />
          </span>
        )}
      </p>
      <div className="flex w-full flex-row justify-center gap-1 text-left">
        {query.isLoading ? (
          <span className="animate-pulse text-xl tabular-nums tracking-wider text-gray-900 blur-sm">
            12,345
          </span>
        ) : (
          <p>
            <AnimatedNumber value={totalTrips} />
          </p>
        )}
      </div>
      <h1 className="cursor-default text-left text-xs font-light uppercase tracking-wider text-gray-900">
        {startDate}
      </h1>
    </div>
  );
};
