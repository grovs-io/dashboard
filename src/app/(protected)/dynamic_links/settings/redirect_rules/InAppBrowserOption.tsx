import { MousePointerClick, ArrowRight } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import OptionCard from "./OptionCard";
import type { RedirectRulesFormValues } from "@/schemas/redirect";

const InAppBrowserOption = ({ platform }: { platform: "ios" | "android" }) => {
  const { watch, setValue } = useFormContext<RedirectRulesFormValues>();
  const value = watch(`${platform}.inAppBrowserPage`);
  const select = (next: boolean) =>
    setValue(`${platform}.inAppBrowserPage`, next, { shouldDirty: true });

  return (
    <>
      <Separator />
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Social app browsers</label>
        <div className="grid grid-cols-2 gap-3">
          <OptionCard
            selected={value === true}
            onClick={() => select(true)}
            icon={MousePointerClick}
            title="Open-in-app page"
            description="Instagram, Facebook, TikTok and similar apps often can't open your app directly. Show a one-tap page there."
          />
          <OptionCard
            selected={value === false}
            onClick={() => select(false)}
            icon={ArrowRight}
            title="Redirect as usual"
            description="Treat them like any other browser."
          />
        </div>
      </div>
    </>
  );
};

export default InAppBrowserOption;
