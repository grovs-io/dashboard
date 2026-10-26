"use client";
import { FlaskConical } from "lucide-react";
import { Choice } from "@/components/composer/fields";
import { Card } from "@ee/components/in_app/composer/LimitsSection";
import { CONTROL_GROUPS } from "@ee/lib/inAppComposer";
import { useInAppSettingsQuery } from "@ee/hooks/queries/useInAppQueries";
import Link from "next/link";

const CONTROLS = CONTROL_GROUPS.map((n) => ({
  value: String(n),
  label: n === 0 ? "No one held back" : `${n}% held back`,
}));

// The project-wide group sits on top of this one; shown here so it is never a surprise.
function ProjectControlNote({ projectId }: { projectId: string }) {
  const share = useInAppSettingsQuery(projectId).data?.control_group;
  if (share === undefined) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {share > 0
        ? `Separately, ${share}% of everyone is held back from all messages project-wide. `
        : "No one is held back project-wide. "}
      <Link
        href="/engagement_settings"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary hover:underline"
      >
        Change
      </Link>
    </p>
  );
}

// The share of the audience kept from the message; fixed once the campaign is out.
export default function ControlGroupField({
  value,
  onChange,
  locked,
  journey,
  bare,
  projectId,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  locked?: boolean;
  // Journeys hold people out of the whole journey; the lock is explained around it.
  journey?: boolean;
  // Without its card, inside a panel that already has a heading.
  bare?: boolean;
  // Shows the project-wide control group next to this one.
  projectId?: string;
}) {
  const body = (
    <>
      <Choice
        label="Control group"
        className="w-44"
        disabled={locked}
        value={String(value ?? 0)}
        options={CONTROLS}
        onChange={(next) => onChange(Number(next) === 0 ? null : Number(next))}
      />
      {value !== null && (
        <p className="text-xs text-muted-foreground">
          {journey
            ? `${value}% of the people who enter are held back. They get none of the journey's messages, so you can compare them with the people who did.`
            : `${value}% of the audience is held back as the control group. They won't see this message, so you can compare them with the people who did.`}
        </p>
      )}
      {projectId && <ProjectControlNote projectId={projectId} />}
      {locked && !journey && (
        <p className="text-xs text-muted-foreground">
          The control group was fixed at launch. To change it, end this campaign
          and launch a copy.
        </p>
      )}
    </>
  );
  return bare ? (
    <div className="min-w-0 space-y-3">{body}</div>
  ) : (
    <Card
      icon={<FlaskConical className="size-3.5" />}
      title="Control group"
      hint={
        journey
          ? "Keep some people out of the journey, so you can compare."
          : "Keep some people from seeing the message, so you can compare."
      }
    >
      {body}
    </Card>
  );
}
