import { useMapConfigStore } from "@/store/store";
import { formatter } from "@/utils/utils";
import React from "react";

export const Legend: React.FC = () => {
  const { scale } = useMapConfigStore();
  return (
    <div className="flex h-24 flex-row-reverse gap-1 font-sans tabular-nums">
      <div className="flex h-full flex-col justify-between py-1 font-medium">
        <span className="drop-shadow-cb-mini bg-cb-white/30 w-fit rounded-full px-2 text-[#7D0B0D] backdrop-blur-sm">
          {formatter.format(scale[1])}
        </span>
        <span className="drop-shadow-cb-mini bg-cb-white/30 w-fit rounded-full px-2 text-[#396c87] backdrop-blur-sm">
          {formatter.format(scale[0])}
        </span>
      </div>
      <div className="text-cb-white tabalur-nums border-cb-white/30 flex w-4 rounded-full border border-[0.5px] font-sans font-light tracking-wider backdrop-blur-sm">
        <div className="drop-shadow-cb-mini flex h-full w-full flex-col items-center justify-between rounded-full bg-gradient-to-t from-[#58A4CCa0] via-[#84649Ea0] to-[#7D0B0Da0] tabular-nums">
          {/* <span>{formatter.format(scale[1])}</span>
        <span>{formatter.format(scale[0])}</span> */}
        </div>
      </div>
    </div>
  );
};
