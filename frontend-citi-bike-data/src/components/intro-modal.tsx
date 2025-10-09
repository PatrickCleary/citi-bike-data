"use client";
import { useIntroModalStore } from "@/store/intro-modal-store";
import { useMapConfigStore } from "@/store/store";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import Icon from "@mui/material/Icon";
import IconLogo from "@/icons/icon";

interface ExampleAnalysis {
  title: string;
  description: string;
  departureCells: string[];
  month: string;
}

const EXAMPLE_ANALYSES: ExampleAnalysis[] = [
  {
    title: "Manhattan Commute",
    description: "Morning commute patterns from Midtown",
    departureCells: ["89c2595969fffff", "89c2595968fffff"],
    month: "2024-09",
  },
  {
    title: "Brooklyn Bridge Area",
    description: "Popular tourist and commuter routes",
    departureCells: ["89c25951edfffff", "89c25951ecfffff"],
    month: "2024-08",
  },
  {
    title: "Central Park Loop",
    description: "Recreational rides around Central Park",
    departureCells: ["89c2595b4dfffff", "89c2595b4cfffff"],
    month: "2024-07",
  },
  {
    title: "Lower Manhattan",
    description: "Financial district commute patterns",
    departureCells: ["89c25951e5fffff", "89c25951e4fffff"],
    month: "2024-06",
  },
];

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "What data is shown on this map?",
    answer:
      "This map visualizes CitiBike trip data from New York City, showing departure and arrival patterns across different locations and time periods.",
  },
  {
    question: "How do I use the map?",
    answer:
      "Click on hexagonal cells to select departure locations, then view where riders traveled to or from. Use the date selector to explore different time periods, and toggle between arrivals and departures.",
  },
  {
    question: "What are the hexagons?",
    answer:
      "The map uses H3 hexagons to aggregate trip data into geographic cells. This provides a consistent way to visualize trip patterns across the city.",
  },
  {
    question: "How recent is the data?",
    answer:
      "The data is updated monthly with the latest available CitiBike trip information from NYC Open Data.",
  },
];

const FAQDropdown: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-normal text-gray-900">
        Frequently Asked Questions
      </h3>
      <div className="space-y-2">
        {FAQ_ITEMS.map((item, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-md border border-gray-200"
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left transition hover:bg-gray-100"
            >
              <span className="font-light text-gray-900">{item.question}</span>
              <ExpandMoreRoundedIcon
                className={`h-5 w-5 text-gray-500 transition-transform ${
                  openIndex === index ? "rotate-180" : ""
                }`}
              />
            </button>
            {openIndex === index && (
              <div className="bg-white px-4 py-3">
                <p className="font-light text-gray-600">{item.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ExampleAnalysisGrid: React.FC = () => {
  const { setDepartureCells, setSelectedMonth } = useMapConfigStore();
  const { setIsOpen } = useIntroModalStore();

  const handleSelectExample = (example: ExampleAnalysis) => {
    setDepartureCells(example.departureCells);
    setSelectedMonth(example.month);
    setIsOpen(false);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-normal text-gray-900">Try These Examples</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EXAMPLE_ANALYSES.map((example, index) => (
          <button
            key={index}
            onClick={() => handleSelectExample(example)}
            className="hover:border-cb-blue focus:border-cb-blue focus:ring-cb-blue/30 group rounded-lg border-2 border-gray-200 bg-white p-4 text-left transition focus:outline-none focus:ring-2"
          >
            <h4 className="text-cb-blue mb-1 font-normal group-hover:underline">
              {example.title}
            </h4>
            <p className="text-sm font-light text-gray-600">
              {example.description}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {new Date(example.month + "-01").toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export const IntroModal: React.FC = () => {
  const { isOpen, setIsOpen, markAsVisited } = useIntroModalStore();

  const handleClose = () => {
    markAsVisited();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel
          className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg font-light drop-shadow-2xl"
          style={{
            backgroundImage: "url(/backdrop.jpg)",
            backgroundSize: "cover",
          }}
        >
          <button
            onClick={handleClose}
            className="hover:bg-cb-blue/10 absolute right-4 top-4 rounded-full p-2 transition"
            aria-label="Close modal"
          >
            <CloseRoundedIcon className="h-6 w-6 text-gray-600" />
          </button>

          <div className="space-y-6 p-8">
            {/* Title and Subtitle */}
            <div className="space-y-2 text-center">
              <h1 className="text-cb-blue text-4xl font-light tracking-wide">
                <IconLogo width={48} />
                CitiBike Data
              </h1>
              <h2 className="text-cb-blue/80 text-xl font-light italic">
                From Here to There: Mapping NYC&apos;s CitiBike Journeys
              </h2>
            </div>

            {/* Explanation Placeholder */}
            <div className="bg-cb-white/50 rounded-lg p-6">
              <p className="font-light leading-relaxed text-gray-700">
                Explore millions of CitiBike trips across New York City. This
                interactive map lets you visualize where riders depart from and
                where they travel to, revealing the city&apos;s cycling patterns
                over time. Click on any hexagonal cell to begin your analysis,
                or try one of the example analyses below to get started.
              </p>
            </div>

            {/* Example Analyses Grid */}
            <ExampleAnalysisGrid />

            {/* FAQ Dropdown */}
            <FAQDropdown />

            {/* Contact and Copyright */}
            <div className="space-y-4 border-t border-gray-200 pt-6">
              <div className="flex justify-center">
                <a
                  href="mailto:contact@citibikedata.com"
                  className="bg-cb-blue hover:bg-cb-blue/90 inline-flex items-center gap-2 rounded-md px-6 py-2.5 font-normal text-white transition"
                >
                  <EmailRoundedIcon className="h-5 w-5" />
                  Contact Us
                </a>
              </div>
              <p className="text-center text-sm text-gray-500">
                &copy; {new Date().getFullYear()} CitiBike Data. All rights
                reserved.
              </p>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
