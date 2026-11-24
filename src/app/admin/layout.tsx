import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

/* The console's faces: Geist for text and Geist Mono for figures (money,
   numbers, IDs). This is the taste skill's pairing for data tools, and it is
   not the public site's type, because the console is a white-label tool. */
const geist = Geist({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-admin",
  display: "swap",
});

const geistMono = Geist_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-admin-mono",
  display: "swap",
});

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${geist.variable} ${geistMono.variable}`}>{children}</div>
  );
}
