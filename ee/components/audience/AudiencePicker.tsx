"use client";
import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AudienceType, AudienceValue } from "@ee/types/audience";
import SegmentSelect from "./SegmentSelect";
import RecipientListInput from "./RecipientListInput";

export interface AudiencePickerProps {
  projectId: string;
  value: AudienceValue;
  onChange: (value: AudienceValue) => void;
}

const TABS: { type: AudienceType; label: string }[] = [
  { type: "segment", label: "Segment" },
  { type: "identifiers", label: "My user ids" },
  { type: "visitors", label: "Devices" },
];

const listClass =
  "h-auto w-full justify-start gap-4 rounded-none border-b border-sidebar-border bg-transparent p-0 sm:gap-6";

// Overrides ui/tabs' pill look with an underline, in both themes.
const triggerClass =
  "-mb-px h-auto flex-none gap-2 rounded-none border-0 border-b-2 border-transparent px-0 pb-3 pt-1 text-muted-foreground shadow-none transition-colors hover:text-foreground dark:text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-primary";

function sameAudience(a: AudienceValue, b: AudienceValue): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "segment") return a.segmentId === b.segmentId;
  return (
    a.recipients.length === b.recipients.length &&
    a.recipients.every((recipient, i) => recipient === b.recipients[i])
  );
}

// Seeded once from the initial value; the composer mounts this only once its draft has loaded.
export default function AudiencePicker({
  projectId,
  value,
  onChange,
}: AudiencePickerProps) {
  const [activeTab, setActiveTab] = useState<AudienceType>(value.type);
  const [segmentDraft, setSegmentDraft] = useState<string | undefined>(
    value.type === "segment" ? value.segmentId : undefined
  );
  const [identifiersDraft, setIdentifiersDraft] = useState<string[]>(
    value.type === "identifiers" ? value.recipients : []
  );
  const [visitorsDraft, setVisitorsDraft] = useState<string[]>(
    value.type === "visitors" ? value.recipients : []
  );

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const derived: AudienceValue =
    activeTab === "segment"
      ? { type: "segment", segmentId: segmentDraft, recipients: [] }
      : {
          type: activeTab,
          recipients:
            activeTab === "identifiers" ? identifiersDraft : visitorsDraft,
        };
  // Seeded once from the first render's derived value, so mount itself never emits.
  const lastEmittedRef = useRef(derived);

  // Derived from the current activeTab so a late flush from an inactive tab can't clobber it.
  useEffect(() => {
    if (sameAudience(derived, lastEmittedRef.current)) return;
    lastEmittedRef.current = derived;
    onChangeRef.current(derived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, segmentDraft, identifiersDraft, visitorsDraft]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(next) => setActiveTab(next as AudienceType)}
      className="gap-4"
    >
      <TabsList aria-label="Audience type" className={listClass}>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.type} value={tab.type} className={triggerClass}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="segment">
        <SegmentSelect
          projectId={projectId}
          value={segmentDraft}
          onChange={setSegmentDraft}
        />
      </TabsContent>

      <TabsContent value="identifiers">
        <RecipientListInput
          projectId={projectId}
          mode="identifiers"
          recipients={identifiersDraft}
          onChange={setIdentifiersDraft}
        />
      </TabsContent>

      <TabsContent value="visitors">
        <RecipientListInput
          projectId={projectId}
          mode="visitors"
          recipients={visitorsDraft}
          onChange={setVisitorsDraft}
        />
      </TabsContent>
    </Tabs>
  );
}
