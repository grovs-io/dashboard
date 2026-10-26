"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { ChevronRight, XIcon } from "lucide-react";
import { Button } from "../ui/button";
import { config } from "@/lib/config";

const FEATURES = [
  "No metering of users, apps or events",
  "OIDC SSO and SCIM provisioning",
  "Audit log with SIEM export",
  "Versioned releases with a patch SLA",
  "Security pack, BAA and DPA",
  "Deployment help from our engineers",
];

const ROWS = [
  {
    key: "Our cloud",
    title: "Shared or dedicated",
    body: "We run it for you. A dedicated instance keeps your data apart and is required for health data.",
  },
  {
    key: "Self-hosted",
    title: "Your infrastructure",
    body: "Run grovs in your own cloud or data center. Your data never leaves it, and our staff have no access.",
  },
  {
    key: "Pricing",
    title: "One flat price a year",
    body: "Agreed up front, per deployment. It doesn't change as your user count grows.",
  },
];

const Check = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden
    className="mt-1 flex-none"
  >
    <path
      d="M3 8.4l3.2 3.2L13 4.8"
      stroke="#1F6FE5"
      strokeWidth="2.2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const EnterpriseDialog = ({
  open,
  onOpenChange,
  handleUpgrade,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handleUpgrade: () => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="grid w-[min(980px,calc(100vw-32px))] max-w-none sm:max-w-none max-h-[calc(100vh-2rem)] grid-cols-1 gap-0 overflow-y-auto rounded-none border-0 p-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
      >
        <DialogClose className="absolute right-3.5 top-3.5 z-10 grid size-8 place-items-center text-muted-foreground transition-colors hover:bg-[#F2F2F1] hover:text-foreground dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2A86FF]">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        {/* Left: soft blue surface */}
        <div className="grain-light flex min-w-0 flex-col p-10 text-[#0B2A57] [background-image:linear-gradient(160deg,#C7DBFA_0%,#DCE8FB_100%)]">
          <span className="inline-flex h-7 items-center self-start bg-[#1F6FE5] px-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white">
            Enterprise
          </span>
          <p className="mt-[26px] text-[40px] font-medium leading-none tracking-[-0.03em]">
            Custom
          </p>
          <p className="mt-3 max-w-[340px] text-[14.5px] leading-[1.55] text-[#3B5579]">
            A flat yearly licence. Unlimited users, apps and events, and named
            engineers.
          </p>
          <div className="mt-[30px] border-t border-[rgba(11,42,87,0.15)] pt-[26px]">
            <p className="mb-4 text-[14px] font-medium text-[#3B5579]">
              Everything in Scale, plus
            </p>
            <ul>
              {FEATURES.map((f) => (
                <li
                  key={f}
                  className="mb-2.5 flex gap-2.5 text-[15px] leading-[1.5]"
                >
                  <Check />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto flex items-center gap-[18px] pt-[34px]">
            <Button
              className="h-10 rounded-none bg-[#1F6FE5] px-4 has-[>svg]:px-4 text-[14px] font-medium text-white shadow-none transition-[background-color,transform,box-shadow] duration-200 ease-out hover:bg-[#1A63D2] active:scale-[0.97] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2A86FF]"
              onClick={handleUpgrade}
            >
              Talk to sales
              <ChevronRight />
            </Button>
            <a
              href={`${config.pricingUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-medium text-[#0B2A57] hover:underline underline-offset-4"
            >
              Compare plans
              <ChevronRight className="size-4" />
            </a>
          </div>
        </div>

        {/* Right: details */}
        <div className="flex flex-col py-10 pl-10 pr-14 text-foreground">
          <DialogTitle className="max-w-[420px] text-[24px] font-medium leading-[1.2] tracking-[-0.02em] text-balance">
            One licence,{" "}
            <span className="text-[#1F6FE5]">in our cloud or yours.</span>
          </DialogTitle>
          <DialogDescription className="mt-3.5 max-w-[440px] text-[16px] leading-[1.6] text-muted-foreground">
            For apps over 1M monthly active users, teams handling health data,
            and companies that need grovs inside their own infrastructure.
          </DialogDescription>
          <div className="mt-[30px] border-t border-[#E7E5E2] dark:border-border">
            {ROWS.map((r) => (
              <div
                key={r.key}
                className="grid grid-cols-[132px_1fr] gap-5 border-b border-[#E7E5E2] py-5 dark:border-border"
              >
                <span className="pt-[3px] text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {r.key}
                </span>
                <div>
                  <h3 className="text-[17px] font-medium tracking-[-0.01em]">
                    {r.title}
                  </h3>
                  <p className="mt-1.5 text-[14.5px] leading-[1.55] text-muted-foreground">
                    {r.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-auto pt-[26px] text-[13.5px] leading-[1.55] text-muted-foreground">
            Not sure which you need?{" "}
            <a
              href={`${config.salesUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              Talk to an engineer
            </a>{" "}
            about your setup.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnterpriseDialog;
