import { useMapConfigStore } from "@/store/store";
import { TabGroup, TabList, Tab } from "@headlessui/react";
import classNames from "classnames";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

export const ChartWindowTabs: React.FC = () => {
  const { chartWindow, setChartWindow } = useMapConfigStore();
  const chartTabs: {
    [key: number]: { durationObj: duration.Duration; label: string };
  } = {
    0: { durationObj: dayjs.duration(6, "months"), label: "1 year" },
    1: { durationObj: dayjs.duration(12, "months"), label: "2 years" },
    2: { durationObj: dayjs.duration(24, "months"), label: "4 years" },
  };

  // Determine which tab is active based on chartWindow
  const getActiveTab = () => {
    const months = chartWindow.asMonths();
    if (months === 6) return 0;
    if (months === 12) return 1;
    if (months === 24) return 2;
    return 1; // default to 2 years
  };

  const handleTabChange = (index: number) => {
    const tabObj = chartTabs[index];
    setChartWindow(tabObj.durationObj);
  };

  return (
    <StyledTabs
      tabs={Object.values(chartTabs).map((tab) => tab.label)}
      onChange={handleTabChange}
      selectedIndex={getActiveTab()}
      className="lg:w-20"
    />
  );
};

export const StyledTabs: React.FC<{
  tabs: Array<string>;
  onChange?: (index: number) => void;
  selectedIndex?: number;
  className?: string;
}> = ({ tabs, onChange, selectedIndex, className }) => {
  return (
    <TabGroup selectedIndex={selectedIndex} onChange={onChange}>
      <TabList className="flex flex-row gap-1 rounded-full">
        {tabs.map((tab, index) => (
          <Tab
            key={index}
            className="group flex h-10 w-fit items-center justify-center focus:outline-none lg:h-fit text-sm font-light"
          >
            <div
              className={classNames(
                "h-fit items-center justify-center text-nowrap rounded-full px-2 text-cb-blue lg:px-3",
                // Selected and hover states
                "group-focus:bg-cb-blue/40 group-data-[hover]:bg-cb-blue/10 group-data-[selected]:bg-cb-blue/30 group-data-[selected]:group-data-[hover]:bg-cb-blue/30",
                "active:scale-95",
                className,
              )}
            >
              {tab}
            </div>
          </Tab>
        ))}
      </TabList>
    </TabGroup>
  );
};
