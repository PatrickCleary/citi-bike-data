import { useMapConfigStore } from "@/store/store";
import { formatter } from "@/utils/utils";
import React from "react";

export const Legend: React.FC = () => {
  const { scale } = useMapConfigStore();
  return (
    <div className="flex h-24 flex-row font-sans tabular-nums">
      <div className="text-cb-white tabalur-nums border-cb-white/30 flex w-4 rounded-l-md border border-[0.5px] font-sans font-light tracking-wider drop-shadow-md backdrop-blur-sm">
        <div
          className="flex h-full w-full flex-col items-center justify-between rounded-l-md tabular-nums"
          style={{
            background: `linear-gradient(to top, 
              #440154, #482878, #3e4989, #31688e, 
              #26828e, #35b779, #6ece58, #fde725)`,
          }}
        ></div>
      </div>
      <div className="flex h-full flex-col justify-between font-medium">
        <span className="bg-cb-white/30 border-cb-white/30 border-l-none w-fit rounded-md rounded-l-none border-[0.5px] px-1 text-gray-700 drop-shadow-md backdrop-blur-sm">
          {formatter.format(scale[1])}
        </span>
        <span className="bg-cb-white/30 border-cb-white/30 border-l-none w-fit rounded-md rounded-l-none border-[0.5px] px-1 text-gray-700 drop-shadow-md backdrop-blur-sm">
          {formatter.format(scale[0])}
        </span>
      </div>
    </div>
  );
};
