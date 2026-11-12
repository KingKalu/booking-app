import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clinic appointments",
  description: "View and book clinic appointment slots.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
