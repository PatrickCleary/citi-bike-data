import classNames from "classnames";

interface MapButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const MapButtonStyle =
  "flex h-12 w-12 items-center justify-center rounded-md border-[0.5px] bg-white/30 drop-shadow-lg backdrop-blur-md transition border-gray-900 text-gray-900 hover:bg-white/60";

export const MapButton: React.FC<MapButtonProps> = ({
  disabled,
  onClick,
  children,
}) => {
  return (
    <button
      disabled={disabled}
      className={classNames(
        "flex h-12 w-12 items-center justify-center rounded-md border-[0.5px] bg-white/30 drop-shadow-lg backdrop-blur-md transition",
        disabled
          ? "bg-cb-lightGray/60 border-gray-500 text-gray-400"
          : "border-gray-900 text-gray-900 hover:bg-white/60",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
