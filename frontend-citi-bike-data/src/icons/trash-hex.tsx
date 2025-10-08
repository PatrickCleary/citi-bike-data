import React from "react";
import TrashHex from "./trash_hex.svg";

const TrashHexIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <img src={TrashHex.src} alt="Hex icon" {...(props as any)} />;
};

export default TrashHexIcon;
