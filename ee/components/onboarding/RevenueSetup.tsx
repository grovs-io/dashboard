"use client";

import { useState } from "react";
import { config } from "@/lib/config";
import { ApiError } from "@/lib/ApiError";
import { showGenericError, showSuccessNotification } from "@/lib/Notifications";
import { downloadGoogleSetupScript } from "@/lib/googleSetupScript";
import { useSetAndroidWebhookKeyMutation } from "@/hooks/mutations/useInstanceMutations";
import { useGoogleConfigScriptQuery } from "@/hooks/queries/useInstanceQueries";
import {
  CopyField,
  ErrorText,
  OutlineButton,
  PrimaryButton,
  Spinner,
} from "@/components/onboarding/primitives";
import {
  DropFile,
  SaveStatus,
} from "@/components/onboarding/steps/connect/fileFields";
import type { Platform } from "@/components/onboarding/setupRules";
import type { SetupData } from "@/components/onboarding/useSetupData";
import type { Instance } from "@/types";

const Status = ({ received }: { received: boolean }) => (
  <div className="mt-3 flex items-center gap-[9px] border-t border-chart-users/20 pt-3 text-[13px] text-muted-foreground">
    {received ? (
      "Purchases are coming in"
    ) : (
      <>
        <Spinner />
        Waiting for the first purchase notification
      </>
    )}
  </div>
);

const GooglePlay = ({
  instance,
  data,
}: {
  instance: Instance;
  data: SetupData;
}) => {
  const cfg = data.platforms.android.config?.configuration;
  const save = useSetAndroidWebhookKeyMutation(instance.id);
  const { data: script } = useGoogleConfigScriptQuery(instance.id);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      await save.mutateAsync(form);
      setFile(null);
      setError(null);
      showSuccessNotification("Google Play key saved");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422)
        setError((err.data as { error?: string })?.error ?? "Invalid file");
      else showGenericError();
    }
  };

  return (
    <>
      <ol className="mb-3.5 list-decimal pl-[18px] leading-[1.75]">
        <li>
          Run the setup script. It creates the Pub/Sub topic, the push
          subscription and a service account key.
        </li>
        <li>
          In <b>Play Console</b>, open <b>Monetization setup</b> →{" "}
          <b>Real-time developer notifications</b> and enter the topic name the
          script printed.
        </li>
        <li>
          Upload the <code>play-api-key.json</code> it saved.
        </li>
      </ol>
      <OutlineButton
        className="mb-3"
        disabled={!script}
        onClick={() => script && downloadGoogleSetupScript(script)}
      >
        Download setup script
      </OutlineButton>
      <DropFile
        accept=".json"
        placeholder="play-api-key.json"
        file={file}
        onFile={(f) => {
          setFile(f);
          setError(null);
        }}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <SaveStatus
        saved={!!cfg?.server_api_key?.file}
        savedText={`Uploaded ${cfg?.server_api_key?.file ?? ""}`}
        pendingText="No key uploaded yet"
        action={
          <PrimaryButton
            className="h-[30px] px-3 text-[13px]"
            disabled={!file || save.isPending}
            onClick={submit}
          >
            Save key
          </PrimaryButton>
        }
      />
    </>
  );
};

/** Revenue part of the guided setup: store notification URLs per platform. */
const RevenueSetup = ({
  platform,
  instance,
  data,
}: {
  platform: Platform;
  instance: Instance;
  data: SetupData;
}) => {
  if (platform === "android")
    return <GooglePlay instance={instance} data={data} />;
  const base = `${config.apiUrl}/api/v1/iap/apple`;
  return (
    <>
      <ol className="mb-3.5 list-decimal pl-[18px] leading-[1.75]">
        <li>
          Open <b>App Store Connect → your app → App Information</b>.
        </li>
        <li>
          Under <b>App Store Server Notifications</b>, choose <b>Version 2</b>.
        </li>
        <li>Paste each URL into its field.</li>
      </ol>
      <CopyField
        label="Production server URL"
        value={`${base}/production/${instance.production?.hash_id ?? ""}`}
      />
      <CopyField
        label="Sandbox server URL"
        value={`${base}/test/${instance.test?.hash_id ?? ""}`}
      />
      <Status received={data.hasPurchases} />
    </>
  );
};

export default RevenueSetup;
