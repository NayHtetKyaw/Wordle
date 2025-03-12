import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@mantine/core/styles.css";

import { MantineProvider, createTheme } from "@mantine/core";
// import { Notifications } from "@mantine/notifications";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WORDLE",
  description: "WORDLE game with flask and next",
};

const theme = createTheme({
  colors: {
    "dark-blue": [
      "#f1f4f8",
      "#e3e5ea",
      "#c2cad6",
      "#9eacc2",
      "#8093b2",
      "#6d83a8",
      "#637ca4",
      "#526a90",
      "#475e82",
      "#3a5174",
    ],
  },
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MantineProvider theme={theme} defaultColorScheme="dark">
          {/* <Notifications position="bottom-right" /> */}
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
