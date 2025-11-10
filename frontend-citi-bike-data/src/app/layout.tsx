import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import Script from "next/script";

import "./globals.css";
import Providers from "./providers";
import { Analytics } from "@vercel/analytics/next";

const outfit = Outfit({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Citi Bike Data",
  description: "A web app to visualize Citi Bike data",
  openGraph: {
    title: "Citi Bike Data",
    description: "A web app to visualize Citi Bike data",
    url: "https://citibike.com",
    siteName: "Citi Bike Data",
    images: [
      {
        url: "https://citibikedata.com/preview.jpg",
        width: 1200,
        height: 630,
        alt: "Citi Bike Data preview card",
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
      </head>
      <body className={outfit.className}>
        <Analytics />
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
