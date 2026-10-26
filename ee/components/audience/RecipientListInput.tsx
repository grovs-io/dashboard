"use client";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/common/file-upload";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import {
  MAX_RECIPIENTS,
  parseRecipients,
  parseRecipientsCsv,
} from "@ee/lib/audience";
import AddFromVisitorsDialog, {
  type AddFromVisitorsResult,
} from "./AddFromVisitorsDialog";

const PARSE_DEBOUNCE_MS = 300;

export interface RecipientListInputProps {
  projectId: string;
  mode: "identifiers" | "visitors";
  recipients: string[];
  onChange: (recipients: string[]) => void;
}

export default function RecipientListInput({
  projectId,
  mode,
  recipients,
  onChange,
}: RecipientListInputProps) {
  const [text, setText] = useState(() => recipients.join("\n"));
  const [dropped, setDropped] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Kept current every render so a deferred flush (debounce fire, or unmount) never goes stale.
  const latestRef = useRef({ text, onChange });
  latestRef.current = { text, onChange };
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The seeded text is not an edit, so it is never emitted.
  const emittedText = useRef(text);

  const flush = () => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    const { text: pendingText, onChange: notify } = latestRef.current;
    emittedText.current = pendingText;
    const parsed = parseRecipients(pendingText);
    setDropped(parsed.dropped);
    notify(parsed.recipients);
  };

  useEffect(() => {
    if (text === emittedText.current) return;
    timerRef.current = setTimeout(flush, PARSE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text]);

  // A tab switch unmounts this input; flush any pending parse so the edit isn't lost.
  useEffect(() => () => flush(), []);

  const appendLines = (values: string[]) => {
    if (values.length === 0) return;
    setText((current) => [current, ...values].filter(Boolean).join("\n"));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.currentTarget.files?.[0] ?? null;
    setFile(selected);
    if (!selected) return;
    try {
      const parsed = await parseRecipientsCsv(selected);
      appendLines(parsed.recipients);
    } catch {
      showErrorNotification("Could not read that CSV file");
    } finally {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddFromVisitors = (result: AddFromVisitorsResult) => {
    appendLines(result.added);
    const noun = mode === "identifiers" ? "identifier" : "device";
    const plural = (count: number) => (count === 1 ? "" : "s");
    showSuccessNotification(
      result.skipped > 0
        ? `Added ${result.added.length} ${noun}${plural(result.added.length)}, skipped ${result.skipped} without a user id.`
        : `Added ${result.added.length} ${noun}${plural(result.added.length)}.`
    );
    setDialogOpen(false);
  };

  const label = mode === "identifiers" ? "User ids" : "Device ids";

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        aria-label={`${label}, one per line or comma-separated`}
        rows={8}
        className="min-h-[160px] resize-y bg-background font-mono text-[13px]"
        placeholder={
          mode === "identifiers"
            ? "one user id per line or comma-separated\nuser_123\nuser_456"
            : "one device id per line or comma-separated"
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <FileUpload
          fileInputRef={fileInputRef}
          selectedFile={file}
          onChange={(e) => void handleFileChange(e)}
          accept=".csv"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setDialogOpen(true)}
        >
          Add from visitors
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {recipients.length.toLocaleString()} of{" "}
          {MAX_RECIPIENTS.toLocaleString()}
        </span>
        {dropped > 0 && (
          <span role="status">
            {dropped.toLocaleString()} duplicate or over-the-cap{" "}
            {dropped === 1 ? "entry was" : "entries were"} dropped.
          </span>
        )}
      </div>
      <AddFromVisitorsDialog
        projectId={projectId}
        mode={mode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={handleAddFromVisitors}
      />
    </div>
  );
}
