"use client";
import { useState, type ReactNode } from "react";
import AppHeader from "@/components/layout/app-header";
import { useProjectSelection } from "@/context/useProjectSelection";
import { IS_ENTERPRISE } from "@/lib/edition";
import { TEST } from "@/constants/OptionsConstants";
import { BodySkeleton } from "@/components/common/PageSkeleton";

export interface PushContext {
  projectId: string;
  instanceId: string;
  // Names the page in the breadcrumb, such as the campaign being looked at.
  setTitle: (title: string) => void;
}

interface Props {
  title: string;
  // What the edition notice names; the in-app pages share this shell.
  noun?: string;
  children: (ctx: PushContext) => ReactNode;
}

// Mirrors SegmentsShell: edition gate, project derivation, remount on project switch.
export default function PushShell({
  title,
  noun = "push campaigns",
  children,
}: Props) {
  const { selectedInstance, projectType } = useProjectSelection();
  const [named, setTitle] = useState<string | null>(null);
  const project =
    projectType === TEST
      ? selectedInstance?.test
      : selectedInstance?.production;
  let body: ReactNode;
  if (!IS_ENTERPRISE)
    body = (
      <p className="text-sm text-muted-foreground">
        {noun.charAt(0).toUpperCase() + noun.slice(1)} are unavailable in this
        edition.
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
      <AppHeader titleOverride={named ?? title} />
      <div className="flex-1 overflow-auto p-4 sm:p-6">{body}</div>
    </div>
  );
}
