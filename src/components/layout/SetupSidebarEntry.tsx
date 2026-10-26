"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useDismissGetStartedMutation } from "@/hooks/mutations/useInstanceMutations";
import { showGenericError } from "@/lib/Notifications";
import { useSetupData } from "@/components/onboarding/useSetupData";
import {
  SETUP_STEPS,
  completedSteps,
  isSetupComplete,
  setupHref,
} from "@/components/onboarding/setupRules";

// Ring that fills one quarter per finished step.
const ProgressRing = ({ done, total }: { done: number; total: number }) => {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 18 18"
      className="size-[18px] shrink-0 -rotate-90"
      aria-hidden
    >
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        strokeWidth="2"
        className="stroke-foreground/15"
      />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - done / total)}
        className="stroke-valid-green"
      />
    </svg>
  );
};

/** "Finish setup" under the project switcher, until the setup is done or dismissed. */
export function SetupSidebarEntry() {
  const router = useRouter();
  const { selectedInstance, setSelectedInstance } = useProjectSelection();
  // A dismissed setup needs no queries.
  const data = useSetupData(
    selectedInstance?.get_started_dismissed ? null : (selectedInstance ?? null)
  );
  const dismiss = useDismissGetStartedMutation();

  if (!selectedInstance || selectedInstance.get_started_dismissed) return null;
  if (data.loading || isSetupComplete(data.signals)) return null;

  const steps = completedSteps(data.signals);
  const done = Object.values(steps).filter(Boolean).length;
  const next = SETUP_STEPS.find((step) => !steps[step.key]);

  const open = () => router.push(setupHref(selectedInstance.id));

  const hide = async () => {
    try {
      const response = await dismiss.mutateAsync({ id: selectedInstance.id });
      setSelectedInstance(response.data.instance);
    } catch {
      showGenericError();
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          onClick={open}
          tooltip="Finish setup"
          className="gap-2.5 border border-sidebar-border bg-background shadow-xs hover:bg-sidebar-accent"
        >
          <ProgressRing done={done} total={SETUP_STEPS.length} />
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-[13px] font-medium">
              Finish setup
            </span>
            {next && (
              <span className="truncate text-xs text-muted-foreground">
                Next: {next.label}
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums group-hover/menu-item:opacity-0">
            {done}/{SETUP_STEPS.length}
          </span>
        </SidebarMenuButton>
        <SidebarMenuAction
          showOnHover
          onClick={hide}
          aria-label="Hide setup"
          className="right-2.5 text-muted-foreground peer-data-[size=lg]/menu-button:top-3.5"
        >
          <X />
        </SidebarMenuAction>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
