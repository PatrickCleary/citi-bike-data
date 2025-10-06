import React from "react";
import PointHex from "./point_hex.svg";

const SelectHexIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <img src={PointHex.src} alt="Hex icon" {...(props as any)} />;
};

export default SelectHexIcon;
