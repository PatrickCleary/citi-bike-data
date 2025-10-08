import classNames from "classnames";

interface MapButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const MapButtonStyle =
  "flex h-12 w-12 items-center justify-center rounded-md border-[0.5px] bg-white/30 drop-shadow-md backdrop-blur-md transition border-cb-lightGray text-gray-900 hover:bg-white/60";

export const MapButton: React.FC<MapButtonProps> = ({
  disabled,
  onClick,
  children,
}) => {
  return (
    <button
      disabled={disabled}
      className={classNames(
        "flex h-12 w-12 items-center justify-center rounded-md border-[0.5px] bg-white/30 drop-shadow-md backdrop-blur-md transition",
        disabled
          ? "bg-cb-lightGray/60 border-cb-lightGray/50 text-gray-400"
          : "border-cb-lightGray text-gray-900 hover:bg-white/60",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
