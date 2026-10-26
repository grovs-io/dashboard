"use client";
import { useMutation } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { inAppApi } from "@ee/api/in_app/inAppService";
import { inAppErrorText } from "@ee/lib/inApp";
import { answersCsv, answersFileName } from "@ee/lib/inAppAnswersCsv";

function download(name: string, csv: string) {
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Safari and Firefox drop a download whose address is gone before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Period = { from: string; to: string };

export default function InAppExportButton({
  projectId,
  campaign,
  period,
  count,
}: {
  projectId: string;
  campaign: { id: string; name: string };
  period: Period;
  // Answers in the period, once the report knows.
  count: number | undefined;
}) {
  // The period is the one shown when the button was clicked, however it changes meanwhile.
  const answers = useMutation({
    mutationFn: async (asked: Period) =>
      (await inAppApi.answers(projectId, campaign.id, asked)).data.answers,
    onSuccess: ({ type, rows, truncated }, asked) => {
      download(
        answersFileName(campaign.name, asked.from, asked.to),
        answersCsv(type, rows)
      );
      showSuccessNotification(
        truncated
          ? "Exported the newest 10,000 answers. Choose a shorter period for the rest."
          : `Exported ${rows.length.toLocaleString()} answer${rows.length === 1 ? "" : "s"}`
      );
    },
    onError: (e) =>
      showErrorNotification(inAppErrorText(e, "Could not export the answers.")),
  });
  return (
    <Button
      variant="outline"
      disabled={!count || answers.isPending}
      title={count === 0 ? "No answers in this period" : undefined}
      onClick={() => answers.mutate(period)}
    >
      {answers.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      Export
    </Button>
  );
}
