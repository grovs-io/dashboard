"use client";
import { Trash2 } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/common/FieldError";
import { STEP_HINTS, pointers, stepLabel } from "@ee/lib/journeys";
import type { BranchKey, JourneyInput, JourneyStep } from "@ee/types/journey";
import AttributePanel from "./panels/AttributePanel";
import InAppPanel from "./panels/InAppPanel";
import PushPanel from "./panels/PushPanel";
import SplitPanel from "./panels/SplitPanel";
import WaitPanel from "./panels/WaitPanel";
import { STEP_ICONS } from "./stepIcons";

// Uploads a step's image; the editor applies `patch` to the step as it is when the upload ends.
export type UploadImage = (
  step: JourneyStep,
  file: File,
  patch: (step: JourneyStep, url: string) => JourneyStep
) => Promise<string>;

export function PanelHeader({
  icon,
  title,
  hint,
  onBack,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  // Back to the overview; absent on the overview itself.
  onBack?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <>
      <Breadcrumb className="border-b border-sidebar-border px-5 py-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            {onBack ? (
              <BreadcrumbLink asChild>
                <button type="button" onClick={onBack}>
                  Overview
                </button>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>Overview</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {onBack && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-start gap-2.5 border-b border-sidebar-border px-5 py-3.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <p className="text-[13px] text-muted-foreground">{hint}</p>
        </div>
        {children}
      </div>
    </>
  );
}

// A branching step asks which path takes its place; the other paths go with it.
function DeleteStep({
  step,
  onDelete,
}: {
  step: JourneyStep;
  onDelete: (keep?: BranchKey) => void;
}) {
  const paths = pointers(step);
  if (paths.length === 1)
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Delete step"
        onClick={() => onDelete()}
      >
        <Trash2 className="size-4" />
      </Button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Delete step"
        >
          <Trash2 className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Which path takes its place? The steps on the others are removed.
        </DropdownMenuLabel>
        {paths.map((p) => (
          <DropdownMenuItem key={p.key} onSelect={() => onDelete(p.key)}>
            Keep {p.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function StepPanel({
  projectId,
  draft,
  step,
  locked,
  problems,
  onChange,
  uploadImage,
  onDelete,
  onBack,
}: {
  projectId: string;
  draft: JourneyInput;
  step: JourneyStep;
  locked: boolean;
  problems: string[];
  onChange: (step: JourneyStep) => void;
  uploadImage: UploadImage;
  onDelete: (keep?: BranchKey) => void;
  onBack?: () => void;
}) {
  const Icon = STEP_ICONS[step.type];
  return (
    <>
      <PanelHeader
        icon={<Icon className="size-4" />}
        title={stepLabel(draft, step.id)}
        hint={STEP_HINTS[step.type]}
        onBack={onBack}
      >
        {!locked && <DeleteStep step={step} onDelete={onDelete} />}
      </PanelHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {problems.map((p) => (
          <FieldError key={p} message={p} />
        ))}
        {step.type === "wait" && (
          <WaitPanel
            projectId={projectId}
            draft={draft}
            step={step}
            locked={locked}
            onChange={onChange}
          />
        )}
        {step.type === "split" && (
          <SplitPanel
            projectId={projectId}
            draft={draft}
            step={step}
            locked={locked}
            onChange={onChange}
          />
        )}
        {step.type === "push" && (
          <PushPanel
            projectId={projectId}
            step={step}
            onChange={onChange}
            uploadImage={uploadImage}
          />
        )}
        {step.type === "in_app" && (
          <InAppPanel
            projectId={projectId}
            step={step}
            locked={locked}
            onChange={onChange}
            uploadImage={uploadImage}
          />
        )}
        {step.type === "set_attribute" && (
          <AttributePanel step={step} locked={locked} onChange={onChange} />
        )}
      </div>
    </>
  );
}
