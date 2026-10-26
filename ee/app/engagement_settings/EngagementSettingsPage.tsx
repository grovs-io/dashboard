"use client";
import AppHeader from "@/components/layout/app-header";
import { BodySkeleton } from "@/components/common/PageSkeleton";
import { useProjectSelection } from "@/context/useProjectSelection";
import { IS_ENTERPRISE } from "@/lib/edition";
import { TEST } from "@/constants/OptionsConstants";
import { inAppErrorText, isInAppNotEnabled } from "@ee/lib/inApp";
import { useInAppSettingsQuery } from "@ee/hooks/queries/useInAppQueries";
import EngagementSettingsForm from "@ee/components/in_app/EngagementSettingsForm";

const Notice = ({ children }: { children: React.ReactNode }) => (
  <div className="px-6 pt-6">{children}</div>
);

function Body({ projectId }: { projectId: string }) {
  const settings = useInAppSettingsQuery(projectId);
  if (isInAppNotEnabled(settings.error))
    return (
      <Notice>
        <p className="text-sm text-muted-foreground">
          Engagement is not enabled for this project.
        </p>
      </Notice>
    );
  if (settings.isError)
    return (
      <Notice>
        <p role="alert" className="text-sm text-destructive">
          {inAppErrorText(settings.error, "Could not load the settings.")}
        </p>
      </Notice>
    );
  if (!settings.data)
    return (
      <Notice>
        <BodySkeleton />
      </Notice>
    );
  return (
    <EngagementSettingsForm
      key={projectId}
      projectId={projectId}
      settings={settings.data}
    />
  );
}

// Laid out like the Link Settings pages: header, then a scrolling body with a sticky save bar.
export default function EngagementSettingsPage() {
  const { selectedInstance, projectType } = useProjectSelection();
  const project =
    projectType === TEST
      ? selectedInstance?.test
      : selectedInstance?.production;
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <div className="border-b border-sidebar-border">
        <AppHeader />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {!IS_ENTERPRISE ? (
          <Notice>
            <p className="text-sm text-muted-foreground">
              Engagement settings are unavailable in this edition.
            </p>
          </Notice>
        ) : project ? (
          <Body projectId={project.id} />
        ) : (
          <Notice>
            <BodySkeleton />
          </Notice>
        )}
      </div>
    </div>
  );
}
