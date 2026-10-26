"use client";
import type { ReactNode } from "react";
import { ListChecks, Plus, Star, Trash2 } from "lucide-react";
import { FieldError } from "@/components/common/FieldError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HIGH_QUESTION,
  LOW_QUESTION,
  MAX_OPTIONS,
  MIN_OPTIONS,
  highStars,
  lowStars,
  newOptionId,
  type DraftQuestion,
} from "@ee/lib/inAppComposer";
import type { InAppQuestionType } from "@ee/types/inApp";
import { Choice, Field } from "@/components/composer/fields";
import LockedNotice from "./LockedNotice";
import OptionCard from "@/components/composer/OptionCard";

const KINDS = [
  {
    value: "stars" as const,
    title: "Stars",
    hint: "1 to 5",
    icon: <Star className="size-4" />,
  },
  {
    value: "choice" as const,
    title: "Choices",
    hint: "Pick one from a list",
    icon: <ListChecks className="size-4" />,
  },
];

const NOTHING = { value: "none" as const, label: "Nothing more" };
const AFTER_LOW = [
  NOTHING,
  { value: "ask" as const, label: "Ask what could be better" },
];
const AFTER_HIGH = [
  NOTHING,
  { value: "ask" as const, label: "Ask what they like" },
  { value: "review" as const, label: "Ask for a store review" },
];
const AFTER_CHOICE = [
  NOTHING,
  { value: "ask" as const, label: "Ask a follow-up question" },
];

// A label on the left and what it sets on the right.
function Row({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-2 p-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4"
    >
      <p className="text-[13px] sm:pt-2">
        {label}
        {note && <span className="text-muted-foreground"> {note}</span>}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// `name` tells the two "Question" inputs apart for a screen reader.
function Asked({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Question">
      {(id) => (
        <Input
          id={id}
          aria-label={name}
          maxLength={256}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export default function QuestionEditor({
  question,
  problem,
  launched,
  shared = false,
  onEditA,
  onChange,
}: {
  question: DraftQuestion;
  // Why the template cannot hold this question, if it cannot.
  problem: string | null;
  // The kind is fixed once a campaign has been launched.
  launched: boolean;
  // Editing a variant: the kind and the choices are A's; only the wording is its own.
  shared?: boolean;
  // Switches to variant A, where the question's type and choices are set.
  onEditA?: () => void;
  onChange: (question: DraftQuestion) => void;
}) {
  const set = (patch: Partial<DraftQuestion>) =>
    onChange({ ...question, ...patch });
  const stars = question.type === "stars";
  const { low, high } = question;
  const kindLock = shared ? (
    <LockedNotice
      title="Question set on variant A"
      detail="Its type and choices come from A; this variant only changes the wording. Change them on A."
      action={onEditA && { label: "Go to variant A", onClick: onEditA }}
    />
  ) : launched ? (
    <LockedNotice
      title="Locked after launch"
      detail="The question's type can't change once the message is live."
    />
  ) : undefined;

  const setKind = (type: InAppQuestionType) => {
    if (type === question.type) return;
    // Wording nobody touched follows the kind; what was typed stays.
    const untouched = low === LOW_QUESTION[question.type];
    set({ type, ...(untouched ? { low: LOW_QUESTION[type] } : {}) });
  };

  const afterLow = (label: string, name: string, options: typeof AFTER_LOW) => (
    <Row label={label}>
      <Choice
        label={label}
        value={low === null ? "none" : "ask"}
        options={options}
        onChange={(value) =>
          set({ low: value === "ask" ? LOW_QUESTION[question.type] : null })
        }
      />
      {low !== null && (
        <Asked
          name={name}
          value={low}
          onChange={(value) => set({ low: value })}
        />
      )}
    </Row>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-[13px] font-medium">Kind of question</p>
        <div
          role="radiogroup"
          aria-label="Kind of question"
          className="grid gap-2 sm:grid-cols-2"
        >
          {KINDS.map((kind) => (
            <OptionCard
              key={kind.value}
              selected={question.type === kind.value}
              title={kind.title}
              hint={kind.hint}
              icon={kind.icon}
              locked={kindLock}
              onSelect={() => setKind(kind.value)}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          The title and the message above are the wording of the question.
        </p>
        <FieldError message={problem ?? undefined} />
      </div>

      {question.type === "choice" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium">Choices</p>
            {!shared && question.options.length < MAX_OPTIONS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  set({
                    options: [
                      ...question.options,
                      { id: newOptionId(), text: "" },
                    ],
                  })
                }
              >
                <Plus className="size-3.5" />
                Add choice
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <div key={option.id} className="flex items-center gap-2">
                <Input
                  aria-label={`Choice ${index + 1}`}
                  placeholder={`Choice ${index + 1}`}
                  maxLength={64}
                  value={option.text}
                  onChange={(e) =>
                    set({
                      options: question.options.map((o, i) =>
                        i === index ? { ...o, text: e.target.value } : o
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove choice ${index + 1}`}
                  disabled={shared || question.options.length <= MIN_OPTIONS}
                  onClick={() =>
                    set({
                      options: question.options.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Two to five. People pick one.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[13px] font-medium">After the answer</p>
        <div className="divide-y divide-sidebar-border rounded-lg border border-sidebar-border">
          {stars
            ? afterLow(
                lowStars(question),
                `Question for ${lowStars(question)}`,
                AFTER_LOW
              )
            : afterLow(
                "After the choice",
                "Question after the choice",
                AFTER_CHOICE
              )}
          {stars && (
            <Row label={highStars(question)}>
              <Choice
                label={highStars(question)}
                value={
                  high !== null
                    ? "ask"
                    : question.reviewFrom !== null
                      ? "review"
                      : "none"
                }
                options={AFTER_HIGH}
                onChange={(value) =>
                  set({
                    high: value === "ask" ? HIGH_QUESTION : null,
                    reviewFrom: value === "review" ? question.split + 1 : null,
                  })
                }
              />
              {high !== null && (
                <Asked
                  name={`Question for ${highStars(question)}`}
                  value={high}
                  onChange={(value) => set({ high: value })}
                />
              )}
              {high === null && question.reviewFrom !== null && (
                <p className="text-xs text-muted-foreground">
                  Shows the store&apos;s own review prompt inside the app. Apple
                  and Google decide how often it appears. Not shown on the web.
                </p>
              )}
            </Row>
          )}
          <Row label="Thank-you message" note="(optional)">
            <Input
              aria-label="Thank-you message"
              maxLength={256}
              placeholder="Thank you"
              value={question.thanks}
              onChange={(e) => set({ thanks: e.target.value })}
            />
          </Row>
        </div>
      </div>
    </div>
  );
}
