"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IS_SELF_HOSTED } from "@/lib/edition";

const DOMAIN_SHAPE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export interface ParsedDomain {
  value: string;
  status: "ok" | "invalid" | "duplicate";
}

export function parseDomains(text: string, existing: string[]): ParsedDomain[] {
  const seen = new Set<string>();
  const out: ParsedDomain[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const value = raw
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({
      value,
      status: !DOMAIN_SHAPE.test(value)
        ? "invalid"
        : existing.includes(value)
          ? "duplicate"
          : "ok",
    });
  }
  return out;
}

export default function AddDomainDialog({
  open,
  onOpenChange,
  existing,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: string[];
  onAdd: (domains: string[]) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setText("");
      setSubmitting(false);
    }
  }, [open]);

  const parsed = useMemo(() => parseDomains(text, existing), [text, existing]);
  const ready = parsed.filter((d) => d.status === "ok").map((d) => d.value);
  const hasInvalid = parsed.some((d) => d.status === "invalid");

  const handleAdd = async () => {
    if (ready.length === 0) return;
    setSubmitting(true);
    try {
      await onAdd(ready);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add email domains</DialogTitle>
          <DialogDescription>
            People whose email ends in one of these domains can sign in through
            your identity provider. Subdomains are separate:{" "}
            <span className="font-mono">mail.example.com</span> is not covered
            by <span className="font-mono">example.com</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sso-add-domains">Domains</Label>
            <Textarea
              id="sso-add-domains"
              autoFocus
              rows={3}
              placeholder={"example.com\nsubsidiary.example"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  ready.length > 0 &&
                  !hasInvalid
                ) {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
            />
            <span className="text-xs text-muted-foreground">
              One per line, or separated by commas. Press Enter to add.
            </span>
          </div>
          {parsed.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {parsed.map((d) => (
                <Badge
                  key={d.value}
                  variant={
                    d.status === "ok"
                      ? "secondary"
                      : d.status === "duplicate"
                        ? "outline"
                        : "destructive"
                  }
                  className="font-mono"
                >
                  {d.value}
                  {d.status === "duplicate" && (
                    <span className="ml-1 font-sans">already added</span>
                  )}
                  {d.status === "invalid" && (
                    <span className="ml-1 font-sans">not a domain</span>
                  )}
                </Badge>
              ))}
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {IS_SELF_HOSTED
              ? "On this deployment domains are trusted as soon as they are added."
              : "Each new domain shows a TXT record to add at your DNS provider; it starts working once you press Verify."}
          </span>
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={ready.length === 0 || hasInvalid || submitting}
            className="gap-1.5"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {ready.length > 1 ? `Add ${ready.length} domains` : "Add domain"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
