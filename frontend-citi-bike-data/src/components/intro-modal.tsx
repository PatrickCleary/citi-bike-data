"use client";
import { useIntroModalStore } from "@/store/intro-modal-store";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import Image from "next/image";
import IconLogo from "@/icons/icon";

const WalkthroughCarousel: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const totalSlides = 5;

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  return (
    <div className="space-y-3">
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
                  src={`/walkthrough/desktop_${i}.jpg`}
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
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md transition hover:bg-white active:scale-95"
          aria-label="Previous slide"
        >
          <ChevronLeftRoundedIcon className="h-6 w-6 text-gray-700" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md transition hover:bg-white active:scale-95"
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
                i === currentSlide ? "w-8 bg-cb-blue" : "bg-gray-300"
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
          className="relative max-h-[90svh] w-full max-w-4xl max-w-lg overflow-y-auto rounded-lg bg-white font-light drop-shadow-2xl"
          // style={{
          //   backgroundImage: "url(/backdrop.jpg)",
          //   backgroundSize: "cover",
          // }}
        >
          <button
            onClick={handleClose}
            className="absolute right-2 top-2 rounded-full p-2 transition hover:bg-cb-blue/10 sm:right-4 sm:top-4"
            aria-label="Close modal"
          >
            <CloseRoundedIcon className="h-6 w-6 text-gray-600" />
          </button>

          <div className="space-y-5 px-6 py-8 sm:p-8 sm:px-8">
            {/* Title and Subtitle */}
            <div className="space-y-2 text-center">
              <h2 className="flex flex-row items-center justify-center gap-2 text-2xl font-light tracking-wide text-cb-blue">
                <IconLogo width={32} />
                Citi Bike Data
              </h2>
              <h3 className="text-sm font-light italic text-cb-blue/80">
                Visualizing Bike Share Journeys in the City
              </h3>
            </div>

            {/* Explanation */}
            <div className="rounded-lg bg-cb-white/50 p-4">
              <p className="text-sm font-light leading-relaxed text-gray-700">
                This interactive map lets you visualize where riders depart from
                and where they travel to, revealing the city&apos;s cycling
                patterns over time.
              </p>
            </div>

            {/* Walkthrough Carousel */}
            <WalkthroughCarousel />

            {/* FAQ Dropdown */}
            {/* <FAQDropdown /> */}
            <button
              onClick={handleClose}
              className="group flex w-full flex-row items-center justify-center gap-2 rounded-lg bg-cb-blue py-4 text-cb-white transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:brightness-90 active:scale-95"
            >
              {"Let's go!"}
            </button>

            {/* Contact and Copyright */}
            <div className="flex w-full flex-col items-center justify-center space-x-1 border-t border-gray-200 pt-4">
              <span>
                <a
                  className="text-xs text-cb-blue hover:underline"
                  href="https://docs.google.com/forms/d/e/1FAIpQLSf239Ud_Xc2EduQoVdn4VaI8OYj0hl3KcxGDaYWe8WkbPb6gQ/viewform?usp=dialog"
                >
                  Feedback
                </a>
                <span className="text-xs text-cb-blue"> | </span>
                <a
                  className="text-xs text-cb-blue hover:underline"
                  href="https://patrickcleary.com"
                >
                  Contact
                </a>{" "}
                <span className="text-xs text-cb-blue"> | </span>
                <a
                  className="text-xs text-cb-blue hover:underline"
                  href="https://github.com/PatrickCleary/citi-bike-data"
                >
                  GitHub
                </a>
              </span>
              <p className="text-xs text-gray-500">
                &copy; {new Date().getFullYear()} Patrick Cleary. All rights
                reserved.
              </p>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
