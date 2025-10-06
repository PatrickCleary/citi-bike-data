import { useMapConfigStore } from "@/store/store";
import { formatter } from "@/utils/utils";
import React from "react";

export const Legend: React.FC = () => {
  const { scale } = useMapConfigStore();
  return (
    <div className="bg-cb-white border-cb-lightGray text-cb-white text-cb-white flex w-24 rounded-full border border-[0.5px]">
      <div className="flex h-6 w-full flex-row items-center justify-between rounded-full bg-gradient-to-r from-[#58A4CC9E] via-[#84649E9E] to-[#7D0B0D9E] px-2 font-semibold tabular-nums drop-shadow-lg">
        <span>{formatter.format(scale[0])}</span>
        <span>{formatter.format(scale[1])}</span>
      </div>
    </div>
  );
};
