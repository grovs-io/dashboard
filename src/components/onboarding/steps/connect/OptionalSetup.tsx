"use client";

import { useState, type ReactNode } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { IS_ENTERPRISE } from "@/lib/edition";
import { ApiError } from "@/lib/ApiError";
import { showGenericError, showSuccessNotification } from "@/lib/Notifications";
import {
  useSetAndroidPushConfigMutation,
  useSetIosPushConfigMutation,
} from "@/hooks/mutations/useInstanceMutations";
import RevenueSetup from "@ee/components/onboarding/RevenueSetup";
import type { Instance } from "@/types";
import {
  ErrorText,
  FieldLabel,
  OutlineButton,
  PrimaryButton,
  SetupInput,
} from "../../primitives";
import type { Platform } from "../../setupRules";
import type { SetupData } from "../../useSetupData";
import { DropFile, SaveStatus } from "./fileFields";

export type OptionalKey = "push" | "revenue";

const errorMessage = (err: unknown) =>
  err instanceof ApiError && err.status === 422
    ? ((err.data as { error?: string })?.error ?? "That file isn't valid")
    : null;

const IosPush = ({
  instance,
  data,
}: {
  instance: Instance;
  data: SetupData;
}) => {
  const cfg = data.platforms.ios.config?.configuration;
  const save = useSetIosPushConfigMutation(instance.id);
  const [file, setFile] = useState<File | null>(null);
  const [keyId, setKeyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const uploaded = cfg?.push_configuration?.certificate;

  const submit = async () => {
    if (!file || !keyId.trim()) return;
    const form = new FormData();
    form.append("push_certificate_password", keyId.trim());
    form.append("push_certificate", file);
    try {
      await save.mutateAsync(form);
      setFile(null);
      setKeyId("");
      setError(null);
      showSuccessNotification("Push key saved");
    } catch (err) {
      const message = errorMessage(err);
      if (message) setError(message);
      else showGenericError();
    }
  };

  if (!data.platforms.ios.registered) {
    return <p>Add your app&apos;s IDs in part 1 first.</p>;
  }
  return (
    <>
      <ol className="mb-3.5 list-decimal pl-[18px] leading-[1.75]">
        <li>
          In your Apple Developer account, create an <b>APNs key</b> and
          download the <b>.p8</b> file.
        </li>
        <li>Upload it here with its Key ID.</li>
      </ol>
      <DropFile
        accept=".p8"
        placeholder="AuthKey_XXXXXXXXXX.p8"
        file={file}
        onFile={(f) => {
          setFile(f);
          setError(null);
        }}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="onb-apns-key">Key ID</FieldLabel>
          <SetupInput
            id="onb-apns-key"
            tone="plain"
            value={keyId}
            onChange={(v) => setKeyId(v.toUpperCase())}
            placeholder="7Q4K2M9ZPA"
            valid={keyId.trim().length === 10}
          />
        </div>
        <div>
          <FieldLabel htmlFor="onb-apns-team">Team ID</FieldLabel>
          <SetupInput
            id="onb-apns-team"
            tone="plain"
            value={cfg?.app_prefix ?? ""}
            onChange={() => {}}
            readOnly
            inputClassName="text-muted-foreground"
          />
        </div>
      </div>
      <SaveStatus
        saved={!!uploaded}
        savedText={`Uploaded ${uploaded ?? ""}`}
        pendingText="Not uploaded yet"
        action={
          <PrimaryButton
            className="h-[30px] px-3 text-[13px]"
            disabled={!file || !keyId.trim() || save.isPending}
            onClick={submit}
          >
            Save key
          </PrimaryButton>
        }
      />
    </>
  );
};

const AndroidPush = ({
  instance,
  data,
}: {
  instance: Instance;
  data: SetupData;
}) => {
  const cfg = data.platforms.android.config?.configuration;
  const save = useSetAndroidPushConfigMutation(instance.id);
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState(
    cfg?.push_configuration?.firebase_project_id ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const uploaded = cfg?.push_configuration?.certificate;

  const submit = async () => {
    if (!file || !projectId.trim()) return;
    const form = new FormData();
    form.append("firebase_project_id", projectId.trim());
    form.append("push_certificate", file);
    try {
      await save.mutateAsync(form);
      setFile(null);
      setError(null);
      showSuccessNotification("Firebase key saved");
    } catch (err) {
      const message = errorMessage(err);
      if (message) setError(message);
      else showGenericError();
    }
  };

  if (!data.platforms.android.registered) {
    return <p>Add your app&apos;s IDs in part 1 first.</p>;
  }
  return (
    <>
      <ol className="mb-3.5 list-decimal pl-[18px] leading-[1.75]">
        <li>
          In <b>Firebase → Project settings → Service accounts</b>, choose{" "}
          <b>Generate new private key</b>.
        </li>
        <li>Upload the JSON file here with your Firebase project ID.</li>
      </ol>
      <DropFile
        accept=".json"
        placeholder="service-account.json"
        file={file}
        onFile={(f) => {
          setFile(f);
          setError(null);
        }}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <div className="mt-3">
        <FieldLabel htmlFor="onb-firebase">Firebase project ID</FieldLabel>
        <SetupInput
          id="onb-firebase"
          tone="plain"
          value={projectId}
          onChange={setProjectId}
          placeholder="your-app-1234"
          valid={projectId.trim().length > 0}
        />
      </div>
      <SaveStatus
        saved={!!uploaded}
        savedText={`Uploaded ${uploaded ?? ""}`}
        pendingText="Not uploaded yet"
        action={
          <PrimaryButton
            className="h-[30px] px-3 text-[13px]"
            disabled={!file || !projectId.trim() || save.isPending}
            onClick={submit}
          >
            Save key
          </PrimaryButton>
        }
      />
    </>
  );
};

const Row = ({
  open,
  onToggle,
  icon,
  title,
  description,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "border-t border-foreground/[0.11] first:border-t-0",
      open && "bg-chart-users/[0.05] dark:bg-chart-users/[0.07]"
    )}
  >
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 px-4 py-[13px]">
      <span
        className={cn(
          "grid size-7 place-items-center rounded-[7px] bg-foreground/[0.05] text-[12.5px] font-semibold text-foreground/75 [&_svg]:size-3.5",
          open && "bg-chart-users text-white"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <b className="block text-sm font-semibold">{title}</b>
        <span className="mt-px block text-[12.5px] text-muted-foreground">
          {description}
        </span>
      </span>
      <OutlineButton
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          open &&
            "border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground dark:border-transparent dark:bg-transparent dark:hover:bg-transparent"
        )}
      >
        {open ? "Hide" : "Set up"}
      </OutlineButton>
    </div>
    {open && (
      <div className="px-4 pb-4 text-[13.5px] leading-[1.6] text-foreground/75 sm:pl-14 [&_b]:font-medium [&_b]:text-foreground">
        {children}
      </div>
    )}
  </div>
);

/** Push and revenue, each optional and saved through the platform's existing endpoints. */
export const OptionalSetup = ({
  platform,
  instance,
  data,
  open,
  onToggle,
}: {
  platform: Platform;
  instance: Instance;
  data: SetupData;
  open: OptionalKey | null;
  onToggle: (key: OptionalKey) => void;
}) => {
  if (platform === "web") return null;
  const ios = platform === "ios";
  return (
    <>
      <div className="mt-[26px] flex max-w-[620px] items-center gap-2 text-xs font-medium text-muted-foreground after:h-px after:flex-1 after:bg-border">
        Optional · add now or later
      </div>
      <div className="mt-2.5 max-w-[620px] overflow-hidden rounded-[11px] border border-foreground/[0.11]">
        <Row
          open={open === "push"}
          onToggle={() => onToggle("push")}
          icon={<Bell />}
          title="Push notifications"
          description={`Send push campaigns to ${ios ? "iOS" : "Android"} users`}
        >
          {ios ? (
            <IosPush instance={instance} data={data} />
          ) : (
            <AndroidPush instance={instance} data={data} />
          )}
        </Row>
        {IS_ENTERPRISE && (
          <Row
            open={open === "revenue"}
            onToggle={() => onToggle("revenue")}
            icon="$"
            title="Revenue"
            description={
              ios
                ? "Track App Store purchases and subscriptions"
                : "Track Google Play purchases and subscriptions"
            }
          >
            <RevenueSetup platform={platform} instance={instance} data={data} />
          </Row>
        )}
      </div>
    </>
  );
};
