"use client";
import { ChevronDown } from "lucide-react";
import AdsPlatformSelect from "@/components/common/ads-platform";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ANDROID, IOS } from "@/constants/OptionsConstants";
import type {
  SmartBannerFilters,
  SmartBannerStatusFilter,
} from "@/lib/smartBanners";

const STATUSES: { label: string; value: SmartBannerStatusFilter }[] = [
  { label: "All", value: "" },
  { label: "Live", value: "live" },
  { label: "Paused", value: "paused" },
  { label: "Drafts", value: "draft" },
  { label: "Archived", value: "archived" },
];

const PLATFORMS = [
  { label: "iOS", value: IOS },
  { label: "Android", value: ANDROID },
  { label: "All", value: "", filterType: "platforms" },
];

// The search and filters of the Links toolbar.
export default function SmartBannersToolbar({
  filters,
  onChange,
}: {
  filters: SmartBannerFilters;
  onChange: (next: SmartBannerFilters) => void;
}) {
  const set = (patch: Partial<SmartBannerFilters>) =>
    onChange({ ...filters, ...patch });
  const status = STATUSES.find((s) => s.value === filters.status);
  return (
    <div className="flex min-w-[200px] flex-1 flex-wrap gap-2">
      <Input
        className="w-full min-w-[150px] max-w-[250px]"
        placeholder="Search banner"
        aria-label="Search banners"
        value={filters.term}
        onChange={(e) => set({ term: e.currentTarget.value })}
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="cursor-pointer whitespace-nowrap"
            aria-label={`Status: ${status?.label ?? "All"}`}
          >
            {filters.status ? status?.label : "Status"}
            <ChevronDown className="ml-1 size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] space-y-2 p-2">
          <div>
            <label className="text-sm text-muted-foreground">Status</label>
          </div>
          {STATUSES.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={filters.status === option.value}
                onCheckedChange={() => set({ status: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
      <AdsPlatformSelect
        platformAdsOptions={PLATFORMS}
        selectedAdsPlatform={filters.platform}
        setSelectedAdsPlatforms={(v) =>
          set({ platform: v as SmartBannerFilters["platform"] })
        }
        selectListTitle="Platforms"
      />
    </div>
  );
}
