import { Public_Sans } from "next/font/google";
import type { ReactNode } from "react";

/* The console's one face. A plain government grotesk with tabular figures:
   it carries titles, labels, money and body alike, and it is not the public
   site's type, because the console is a white-label tool. */
const publicSans = Public_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-admin",
  display: "swap",
});

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={publicSans.variable}>{children}</div>;
}
