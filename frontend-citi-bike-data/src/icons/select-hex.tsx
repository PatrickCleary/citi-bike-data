import React from "react";
import PointHex from "./point_hex.svg";

const SelectHexIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return <img src={PointHex.src} alt="Hex icon" {...(props as any)} />;
};

export default SelectHexIcon;
