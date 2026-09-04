import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics Events",
};

export default function AnalyticsEventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
