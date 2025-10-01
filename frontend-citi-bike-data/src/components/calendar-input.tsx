import React from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import { MapButtonStyle } from "@/map/map-button";

export const CalendarInput: React.FC = () => {
  return (
    <Popover>
      <PopoverButton className={MapButtonStyle}>
        <CalendarMonthIcon fontSize="small" />
      </PopoverButton>
    </Popover>
  );
};
