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
