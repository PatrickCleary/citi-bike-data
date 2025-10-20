import { useMapConfigStore } from "@/store/store";
import { formatter } from "@/utils/utils";
import React from "react";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";

export const Legend: React.FC = () => {
  const { scale, displayType } = useMapConfigStore();

  // Define gradients based on display type
  const absoluteGradient = `linear-gradient(to top,
    #440154, #482878, #3e4989, #31688e,
    #26828e, #35b779, #6ece58, #fde725)`;

  const comparisonGradient = `linear-gradient(to top,
    #543005, #8c510a, #bf812d, #dfc27d,
    #d8d8d8, #80cdc1, #35978f, #01665e, #003c30)`;

  return (
    <div className="flex h-24 flex-row font-sans tabular-nums">
      <div className="tabalur-nums flex w-4 rounded-l-md border border-[0.5px] border-cb-white/30 font-sans font-light tracking-wider text-cb-white drop-shadow-md backdrop-blur-sm">
        <div
          className="flex h-full w-full flex-col items-center justify-between rounded-l-md tabular-nums"
          style={{
            background:
              displayType === "comparison"
                ? comparisonGradient
                : absoluteGradient,
          }}
        ></div>
      </div>
      <div className="flex h-full flex-col justify-between font-medium">
        {displayType === "comparison" ? (
          <>
            <span className="border-l-none w-fit rounded-md text-cb-increase rounded-l-none border-[0.5px] border-cb-white/30 bg-cb-white/30 px-1 drop-shadow-md backdrop-blur-sm">
              <TrendingUpRoundedIcon fontSize="small" />
            </span>
            <span className="border-l-none w-fit rounded-md text-cb-decrease rounded-l-none border-[0.5px] border-cb-white/30 bg-cb-white/30 px-1 drop-shadow-md backdrop-blur-sm">
              <TrendingDownRoundedIcon fontSize="small" />
            </span>
          </>
        ) : (
          <>
            <span className="border-l-none w-fit rounded-md rounded-l-none border-[0.5px] border-cb-white/30 bg-cb-white/30 px-1 text-gray-700 drop-shadow-md backdrop-blur-sm">
              {formatter.format(scale[1])}
            </span>
            <span className="border-l-none w-fit rounded-md rounded-l-none border-[0.5px] border-cb-white/30 bg-cb-white/30 px-1 text-gray-700 drop-shadow-md backdrop-blur-sm">
              {formatter.format(scale[0])}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
