import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = { title: "In-app message" };
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
