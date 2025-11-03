import classNames from "classnames";

interface MapButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children?: React.ReactNode;
}

export const MapButtonStyle =
  "flex h-12 w-12 items-center active:scale-95 justify-center rounded-md border-[0.5px] bg-white transition border-cb-lightGray text-gray-900 hover:bg-white/60";

export const MapButton: React.FC<MapButtonProps> = ({
  disabled,
  onClick,
  title,
  children,
}) => {
  return (
    <button
      title={title}
      disabled={disabled}
      className={classNames(
        "flex h-12 w-12 items-center justify-center rounded-md border-[0.5px] bg-white transition active:scale-95",
        disabled
          ? "border-cb-lightGray/50 bg-cb-lightGray/60 text-gray-400"
          : "border-cb-lightGray text-gray-900 hover:bg-white/60",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
