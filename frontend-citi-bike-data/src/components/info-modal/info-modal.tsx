"use client";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { useState, ReactNode } from "react";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

interface InfoModalProps {
  /**
   * The content to display in the modal
   */
  children: ReactNode;
  /**
   * Optional CSS class for the info icon
   */
  iconClassName?: string;
  /**
   * Optional CSS class for the modal panel
   */
  modalClassName?: string;
  /**
   * Optional aria-label for the info button
   */
  ariaLabel?: string;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  children,
  iconClassName = "h-5 w-5",
  modalClassName = "w-full max-w-2xl",
  ariaLabel = "Open information",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
  };
  const handleClose = () => setIsOpen(false);

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-full p-1 transition hover:bg-gray-100 active:scale-95"
        aria-label={ariaLabel}
      >
        <InfoOutlinedIcon className={iconClassName} />
      </button>

      <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <DialogPanel
            className={`relative max-h-[90svh] overflow-y-auto rounded-lg bg-white font-light drop-shadow-2xl ${modalClassName}`}
          >
            <button
              onClick={handleClose}
              className="absolute right-2 top-2 rounded-full p-2 transition hover:bg-cb-blue/10 sm:right-4 sm:top-4"
              aria-label="Close modal"
            >
              <CloseRoundedIcon className="h-6 w-6 text-gray-600" />
            </button>

            <div className="p-6 sm:p-8">{children}</div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
};
