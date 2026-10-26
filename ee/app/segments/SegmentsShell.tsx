"use client";
import { useState, type ReactNode } from "react";
import AppHeader from "@/components/layout/app-header";
import { useProjectSelection } from "@/context/useProjectSelection";
import { IS_ENTERPRISE } from "@/lib/edition";
import { TEST } from "@/constants/OptionsConstants";
import { BodySkeleton } from "@/components/common/PageSkeleton";

export interface SegmentsContext {
  projectId: string;
  instanceId: string;
  setTitle: (title: string) => void;
}

interface Props {
  title: string;
  children: (ctx: SegmentsContext) => ReactNode;
}

// Page shell shared by the list, detail and builder: edition gate, project derivation, remount on switch.
export default function SegmentsShell({ title, children }: Props) {
  const { selectedInstance, projectType } = useProjectSelection();
  const [titleOverride, setTitle] = useState<string | null>(null);
  // selectedProject lags a switch by one effect; derive from the instance and environment instead.
  const project =
    projectType === TEST
      ? selectedInstance?.test
      : selectedInstance?.production;
  let body: ReactNode;
  if (!IS_ENTERPRISE)
    body = (
      <p className="text-sm text-muted-foreground">
        Segments are unavailable in this edition.
      </p>
    );
  // No instance only while projects load; users without one get the create-project dialog.
  else if (!selectedInstance || !project) body = <BodySkeleton />;
  else
    body = (
      <div key={`${selectedInstance.id}:${projectType}:${project.id}`}>
        {children({
          projectId: project.id,
          instanceId: selectedInstance.id,
          setTitle,
        })}
      </div>
    );
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader titleOverride={titleOverride ?? title} />
      <div className="flex-1 overflow-auto p-4 sm:p-6">{body}</div>
    </div>
  );
}
