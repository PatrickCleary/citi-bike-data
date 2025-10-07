import React from "react";
import Icon from "./icon.svg";

const IconLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <img src={Icon.src} alt="Hex icon" {...(props as any)} />;
};

export default IconLogo;
