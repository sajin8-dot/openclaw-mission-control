import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenCLAW Mission Control",
  description: "Agent memory dashboard for OpenCLAW",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
