import { useMapConfigStore } from "@/store/store";
import { formatter } from "@/utils/utils";
import React from "react";

export const Legend: React.FC = () => {
  const { scale } = useMapConfigStore();
  return (
    <div className=" flex h-24 flex-row font-sans tabular-nums">
      <div className="text-cb-white tabalur-nums border-cb-white/30 flex w-4 rounded-l-md border border-[0.5px] font-sans font-light tracking-wider drop-shadow-md backdrop-blur-sm">
        <div className="flex h-full w-full flex-col items-center justify-between rounded-l-md  bg-gradient-to-t from-[#58A4CCa0] via-[#84649Ea0] to-[#7D0B0Da0] tabular-nums"></div>
      </div>
      <div className="flex h-full flex-col justify-between font-medium">
        <span className="bg-cb-white/30 w-fit rounded-md border-cb-white/30  border-[0.5px] border-l-none rounded-l-none px-1 text-[#7D0B0D] drop-shadow-md backdrop-blur-sm">
          {formatter.format(scale[1])}
        </span>
        <span className="bg-cb-white/30 border-cb-white/30 w-fit rounded-md rounded-l-none border-[0.5px] border-l-none px-1 text-[#396c87] drop-shadow-md backdrop-blur-sm">
          {formatter.format(scale[0])}
        </span>
      </div>
    </div>
  );
};
