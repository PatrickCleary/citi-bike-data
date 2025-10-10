import type { Metadata } from "next";
import { Outfit } from "next/font/google";

import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "CitiBike Data",
  description: "A web app to visualize CitiBike data",
};
const outfit = Outfit({
  subsets: ["latin"],
});

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
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=bike_dock&display=swap"
        />
      </head>
      <body className={outfit.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
