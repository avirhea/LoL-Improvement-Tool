import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoL Draft Assistant",
  description: "A practical League of Legends draft recommendation prototype."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
