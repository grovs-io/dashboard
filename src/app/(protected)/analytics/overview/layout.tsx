import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics Overview",
};

export default function AnalyticsOverviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
