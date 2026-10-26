import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Smart Banners",
};

export default function SmartBannersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
