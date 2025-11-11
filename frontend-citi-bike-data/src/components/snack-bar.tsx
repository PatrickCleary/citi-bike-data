"use client";

import React, { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import EventEmitter from "eventemitter3";

export interface SnackBarMessage {
  id: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  duration?: number;
}

const snackBarEmitter = new EventEmitter();
const SNACKBAR_EVENT = "message";

export const showSnackBar = (
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  duration: number = 3000,
) => {
  snackBarEmitter.emit(SNACKBAR_EVENT, {
    id: Math.random().toString(36).substring(2, 9),
    message,
    type,
    duration,
  });
};

export const SnackBar: React.FC = () => {
  const [currentMessage, setCurrentMessage] = useState<SnackBarMessage | null>(
    null,
  );
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const removeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleSnackBarEvent = (newMessage: SnackBarMessage) => {
      // Clear any existing timers
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);

      // Hide current message first
      setVisible(false);

      // Small delay to let the hide animation complete, then show new message
      setTimeout(() => {
        setCurrentMessage(newMessage);
        // Use another timeout to ensure state updates before showing
        setTimeout(() => {
          setVisible(true);

          const duration = newMessage.duration || 3000;
          hideTimerRef.current = setTimeout(() => {
            setVisible(false);
            removeTimerRef.current = setTimeout(() => {
              setCurrentMessage(null);
            }, 300);
          }, duration);
        }, 10);
      }, 50);
    };

    snackBarEmitter.on(SNACKBAR_EVENT, handleSnackBarEvent);
    return () => {
      snackBarEmitter.off(SNACKBAR_EVENT, handleSnackBarEvent);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };
  }, []);

  const typeStyles = {
    info: "bg-gray-700 text-gray-100",
    success: "bg-green-600 text-white",
    warning: "bg-yellow-500 text-gray-900",
    error: "bg-red-600 text-white",
  };

  if (!currentMessage) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] flex justify-center p-4 md:hidden">
      <div
        key={currentMessage.id}
        className={classNames(
          "pointer-events-auto rounded-lg px-6 py-3 shadow-lg transition-all duration-300 ease-out",
          typeStyles[currentMessage.type || "info"],
          visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
        )}
      >
        <p className="text-sm font-medium">{currentMessage.message}</p>
      </div>
    </div>
  );
};
