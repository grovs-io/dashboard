"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/layout/app-header";
import AuditLogExplorer from "@/components/audit/AuditLogExplorer";
import AuditExportTokensButton from "@/components/audit/AuditExportTokensButton";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useAuditLogAccess } from "@/hooks/queries/useAuditQueries";

const AuditLogsPage = () => {
  const router = useRouter();
  const { selectedInstance } = useProjectSelection();
  const { allowed, isResolving } = useAuditLogAccess(selectedInstance?.id);

  useEffect(() => {
    if (!isResolving && selectedInstance && !allowed) {
      router.replace("/settings");
    }
  }, [allowed, isResolving, selectedInstance, router]);

  return (
    <main className="flex flex-col relative overflow-hidden h-dvh">
      <AppHeader
        titleOverride="Audit Logs"
        hideEnvSelect
        rightContent={
          allowed && selectedInstance?.id ? (
            <AuditExportTokensButton instanceId={selectedInstance.id} />
          ) : undefined
        }
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="@container/main flex flex-1 flex-col overflow-hidden">
          {allowed && selectedInstance?.id && (
            <AuditLogExplorer instanceId={selectedInstance.id} />
          )}
        </div>
      </div>
    </main>
  );
};

export default AuditLogsPage;
