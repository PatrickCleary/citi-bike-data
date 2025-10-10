"use client";
import { useIntroModalStore } from "@/store/intro-modal-store";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { useState, useEffect } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import Image from "next/image";
import IconLogo from "@/icons/icon";
import { isMobileDevice } from "@/utils/mobile-detection";

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

const WalkthroughCarousel: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const imagePrefix = isMobile ? "mobile" : "desktop";
  const totalSlides = 5;

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-normal text-gray-900">
        How to Use the App
      </h3>
      <div className="relative mx-auto max-w-lg">
        {/* Carousel Container */}
        <div className="relative overflow-hidden rounded-lg">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {Array.from({ length: totalSlides }, (_, i) => (
              <div key={i} className="w-full flex-shrink-0">
                <Image
                  src={`/walkthrough/${imagePrefix}_${i}.jpg`}
                  alt={`Walkthrough step ${i + 1}`}
                  width={600}
                  height={450}
                  className="w-full rounded-lg"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Buttons */}
        <button
          onClick={prevSlide}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-lg transition hover:bg-white"
          aria-label="Previous slide"
        >
          <ChevronLeftRoundedIcon className="h-6 w-6 text-gray-700" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-lg transition hover:bg-white"
          aria-label="Next slide"
        >
          <ChevronRightRoundedIcon className="h-6 w-6 text-gray-700" />
        </button>

        {/* Slide Indicators */}
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: totalSlides }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-2 w-2 rounded-full transition ${
                i === currentSlide ? "bg-cb-blue w-8" : "bg-gray-300"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
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
          className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white font-light drop-shadow-2xl"
          // style={{
          //   backgroundImage: "url(/backdrop.jpg)",
          //   backgroundSize: "cover",
          // }}
        >
          <button
            onClick={handleClose}
            className="hover:bg-cb-blue/10 fixed right-4 top-4 rounded-full p-2 transition"
            aria-label="Close modal"
          >
            <CloseRoundedIcon className="h-6 w-6 text-gray-600" />
          </button>

          <div className="space-y-5 p-6 sm:p-8">
            {/* Title and Subtitle */}
            <div className="space-y-1 text-center">
              <h1 className="text-cb-blue flex flex-col items-center justify-center gap-2 text-2xl font-light tracking-wide sm:flex-row">
                <IconLogo width={32} />
                CitiBike Data
              </h1>
              <h2 className="text-cb-blue/80 text-sm font-light italic">
                From Here to There: Mapping CitiBike Journeys
              </h2>
            </div>

            {/* Explanation */}
            <div className="bg-cb-white/50 rounded-lg p-4">
              <p className="text-sm font-light leading-relaxed text-gray-700">
                Explore millions of CitiBike trips across New York City. This
                interactive map lets you visualize where riders depart from and
                where they travel to, revealing the city&apos;s cycling patterns
                over time.
              </p>
            </div>

            {/* Walkthrough Carousel */}
            <WalkthroughCarousel />

            {/* FAQ Dropdown */}
            {/* <FAQDropdown /> */}

            {/* Contact and Copyright */}
            <div className="space-y-3 border-t border-gray-200 pt-4">
              {/* <div className="flex justify-center">
                <a
                  href="mailto:contact@citibikedata.com"
                  className="bg-cb-blue hover:bg-cb-blue/90 inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-normal text-white transition"
                >
                  <EmailRoundedIcon className="h-4 w-4" />
                  Contact Us
                </a>
              </div> */}
              <p className="text-center text-xs text-gray-500">
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
