import type { Metadata } from "next";
import { Schibsted_Grotesk, Tinos } from "next/font/google";
import "./globals.css";

const grotesk = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const tinos = Tinos({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-doc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Redline",
  description:
    "Redline ranks the clauses in a client's agreement that could cost you and quotes the exact sentence each one comes from.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${tinos.variable}`}>
      <body>{children}</body>
    </html>
  );
}
