import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import Script from "next/script";

import "./globals.css";
import Providers from "./providers";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "CitiBike Data",
  description: "A web app to visualize CitiBike data",
  openGraph: {
    title: "CitiBike Data",
    description: "A web app to visualize CitiBike data",
    url: "https://citibike.com",
    siteName: "CitiBike Data",
    images: [
      {
        url: "https://citibikedata.com/preview.jpg",
        width: 1200,
        height: 630,
        alt: "CitiBike Data preview card",
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfit.variable}>
      <head>
        <link rel="stylesheet" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=bike_dock"
        />
      </head>
      <body className={outfit.className}>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-CN6RVMTMGV"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-CN6RVMTMGV');
          `}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
