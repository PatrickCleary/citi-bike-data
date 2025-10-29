export const Subtext: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <span className="text-nowrap text-xs lg:text-sm font-light uppercase tabular-nums tracking-wide text-gray-500">
      {children}
    </span>
  );
};
