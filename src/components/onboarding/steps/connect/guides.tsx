"use client";

import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { trackEvent, EVENTS } from "@/analytics";
import { showGenericError } from "@/lib/Notifications";
import { bundleIdSchema, shaSchema } from "@/schemas/shared";
import { FILE_ORIGIN, isDomainValid } from "@/lib/domainValidation";
import {
  IOS_SPM_URL,
  appDelegateContent,
  reactNativeContent,
  sceneDelegateContent,
} from "@/lib/IosPageConstants";
import {
  androidGradleDependency,
  intentFiltersXml,
  sdkAndroidValue,
  sdkHandleDeepLinksValue,
  sdkLauncherActivityValue,
  sdkReactNativeAppValue,
} from "@/lib/AndroidPageConstants";
import { integrateWebSdkValue } from "@/lib/WebPageConstants";
import {
  useCompleteSetupStepMutation,
  useSetAndroidConfigMutation,
  useSetIosConfigMutation,
  useSetWebConfigMutation,
} from "@/hooks/mutations/useInstanceMutations";
import { useCustomDomainsQuery } from "@/hooks/queries/useConfigurationQueries";
import { useAndroidSdkReleaseQuery } from "@/hooks/queries/useAndroidSdkReleaseQuery";
import type { CustomDomain, Instance } from "@/types";
import { cn } from "@/lib/utils";
import {
  DocLink,
  ErrorText,
  FieldLabel,
  HelpDocs,
  HelpLinks,
  HelpPitfalls,
  HelpTitle,
  Hint,
  OkMark,
  PanelCaption,
  PendingMark,
  SetupInput,
  Spinner,
  TextLink,
  TextTabs,
  docsUrl,
} from "../../primitives";
import { HomeScreenPreview } from "../../previews/Phone";
import {
  PLATFORM_PARTS,
  SETUP_CATEGORY,
  timeAgo,
  type Platform,
} from "../../setupRules";
import type { SetupData } from "../../useSetupData";
import { CodePanel, CopyLine, ValueTable } from "./CodePanel";
import type { GuidePart } from "./PartList";

export interface Guide {
  parts: GuidePart[];
  /** Saves or records the part; false keeps the user on it. */
  submit: (key: string) => Promise<boolean>;
  canSubmit: (key: string) => boolean;
  saving: boolean;
}

const withKey = (code: string, instance: Instance) =>
  code.replace("_GROVS_API_KEY_", instance.api_key ?? "YOUR_API_KEY");

// Hosts that aren't failing: a pending custom or migrated domain belongs in this build too.
const extraHosts = (domains: CustomDomain[] | undefined) =>
  (domains ?? [])
    .filter((d) => d.status !== "failed" && d.status !== "suspended")
    .sort(
      (a, b) =>
        Number(b.purpose === "primary") - Number(a.purpose === "primary")
    )
    .map((d) => d.hostname);

function useWalk(instance: Instance, platform: Platform) {
  const complete = useCompleteSetupStepMutation(instance.id);
  return async (key: string) => {
    try {
      await complete.mutateAsync({
        category: SETUP_CATEGORY[platform],
        stepIdentifier: key,
      });
      return true;
    } catch {
      showGenericError();
      return false;
    }
  };
}

const Steps = ({
  children,
  start,
}: {
  children: ReactNode;
  start?: number;
}) => (
  <ol start={start} className="mb-3 list-decimal pl-[18px] leading-[1.8]">
    {children}
  </ol>
);

// --- Run ---

const RunBody = ({
  seen,
  seenAt,
  label,
  waiting,
  intro,
}: {
  seen: boolean;
  seenAt: string | null;
  label: string;
  waiting: string;
  intro: string;
}) => (
  <>
    <p className="mb-3">{intro}</p>
    {seen ? (
      <div className="flex h-10 items-center gap-2 rounded-lg border border-valid-green/35 bg-valid-green/[0.06] px-3 text-[13.5px]">
        <span className="font-medium text-valid-green">Connected</span>
        <span className="truncate text-muted-foreground">
          {label}
          {seenAt ? ` · ${timeAgo(seenAt)}` : ""}
        </span>
        <OkMark className="ml-auto" />
      </div>
    ) : (
      <div className="flex h-10 items-center gap-2.5 rounded-lg border border-chart-users/30 bg-chart-users/[0.05] px-3 text-[13.5px] text-foreground dark:bg-chart-users/[0.08]">
        <Spinner />
        {waiting}
        <span className="ml-auto hidden text-[12.5px] text-muted-foreground sm:inline">
          updates by itself
        </span>
      </div>
    )}
  </>
);

const LiveRow = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-2.5 border-t border-border py-[9px] whitespace-nowrap last:border-b">
    {children}
  </div>
);

const RunHelp = ({
  instance,
  registered,
  seen,
  seenAt,
  identifier,
  platformLabel,
}: {
  instance: Instance;
  registered: boolean;
  seen: boolean;
  seenAt: string | null;
  identifier: string;
  platformLabel: string;
}) => (
  <>
    <PanelCaption>On your phone</PanelCaption>
    <HomeScreenPreview
      projectName={instance.production?.name ?? instance.name}
      iconUrl={instance.icon_url}
      connected={seen}
    />
    <div className="mt-[18px] w-[300px] text-[13px]">
      <LiveRow>
        {registered ? <OkMark /> : <PendingMark />}
        <span className={cn(!registered && "text-muted-foreground")}>
          App registered
        </span>
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {identifier}
        </span>
      </LiveRow>
      <LiveRow>
        {seen ? <OkMark /> : <Spinner />}
        {seen ? "First open" : "Waiting for first open"}
        <span className="ml-auto text-xs text-muted-foreground">
          {seen && seenAt
            ? `${timeAgo(seenAt)} · ${platformLabel}`
            : "open the app"}
        </span>
      </LiveRow>
    </div>
  </>
);

// --- iOS ---

type IosSdk = "spm" | "pods" | "rn";
type IosInit = "app" | "scene" | "rn";

const IOS_SDK_LABEL: Record<IosSdk, string> = {
  spm: "Swift Package Manager",
  pods: "CocoaPods",
  rn: "React Native",
};

export function useIosGuide(instance: Instance, data: SetupData): Guide {
  const signals = data.platforms.ios;
  const cfg = signals.config?.configuration;
  const save = useSetIosConfigMutation(instance.id);
  const walk = useWalk(instance, "ios");
  const { data: prodDomains } = useCustomDomainsQuery(instance.production?.id);
  const { data: testDomains } = useCustomDomainsQuery(instance.test?.id);
  const [bundleId, setBundleId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [sdk, setSdk] = useState<IosSdk>("spm");
  const [init, setInit] = useState<IosInit>("app");

  // Re-seed the fields whenever the saved IDs change.
  const savedIds = `${cfg?.bundle_id ?? ""}|${cfg?.app_prefix ?? ""}`;
  const [seededIds, setSeededIds] = useState<string | null>(null);
  if (seededIds !== savedIds) {
    setSeededIds(savedIds);
    setBundleId(cfg?.bundle_id ?? "");
    setTeamId(cfg?.app_prefix ?? "");
  }

  const bundleValid = bundleIdSchema.safeParse(bundleId.trim()).success;
  const teamValid = teamId.trim().length > 2;
  const assoc = [
    instance.production?.domain,
    ...extraHosts(prodDomains),
    instance.test?.domain,
    ...extraHosts(testDomains),
  ]
    .filter(Boolean)
    .map((host) => ({
      where: "Associated Domains",
      value: `applinks:${host}`,
    }));
  const assocRows = [
    ...assoc,
    { where: "URL Schemes", value: instance.uri_scheme },
  ];
  const initCode = {
    app: { file: "AppDelegate.swift", code: appDelegateContent },
    scene: { file: "SceneDelegate.swift", code: sceneDelegateContent },
    rn: { file: "AppDelegate.swift", code: reactNativeContent },
  }[init];

  const parts: GuidePart[] = [
    {
      key: "register_app",
      title: "Your app's IDs",
      summary: cfg?.bundle_id,
      done: signals.registered,
      body: (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="onb-bundle">Bundle ID</FieldLabel>
            <SetupInput
              id="onb-bundle"
              value={bundleId}
              onChange={setBundleId}
              placeholder="com.company.app"
              valid={bundleValid}
              invalid={bundleId.length > 0 && !bundleValid}
            />
          </div>
          <div>
            <FieldLabel htmlFor="onb-team">Team ID</FieldLabel>
            <SetupInput
              id="onb-team"
              value={teamId}
              onChange={(v) => setTeamId(v.toUpperCase())}
              placeholder="8K3J2Q9X7P"
              valid={teamValid}
            />
          </div>
        </div>
      ),
      help: (
        <HelpDocs>
          <HelpTitle>Bundle ID</HelpTitle>
          <ol>
            <li>
              Open your project in Xcode and select it at the top of the file
              list.
            </li>
            <li>
              Under <b>Targets</b>, pick your app and open <b>General</b>.
            </li>
            <li>
              Copy <b>Bundle Identifier</b>, e.g. <code>com.company.app</code>.
            </li>
          </ol>
          <HelpTitle>Team ID</HelpTitle>
          <ol>
            <li>
              Sign in at <b>developer.apple.com/account</b>.
            </li>
            <li>
              Open <b>Membership details</b>.
            </li>
            <li>
              Copy <b>Team ID</b>: 10 letters and numbers.
            </li>
          </ol>
          <HelpPitfalls
            items={[
              "Using the Bundle ID of a test or widget target instead of the app.",
              "Copying your personal team when the app ships under your company's team.",
            ]}
          />
          <HelpLinks>
            <DocLink
              href={docsUrl("/docs/how-to-guides/ios/bundle-identifier")}
            >
              Finding your Bundle ID
            </DocLink>
            <DocLink href={docsUrl("/docs/sdk/ios/quick-start")}>
              Full iOS guide in Grovs docs
            </DocLink>
          </HelpLinks>
        </HelpDocs>
      ),
    },
    {
      key: "url_scheme",
      title: "Add your domain to the app",
      summary: `${assocRows.length} values added`,
      done: signals.walked.has("url_scheme"),
      body: (
        <>
          <p className="mb-3">
            Add these in Xcode under <b>Signing &amp; Capabilities</b> and{" "}
            <b>Info → URL Types</b>.
          </p>
          <ValueTable rows={assocRows} />
        </>
      ),
      help: (
        <HelpDocs>
          <HelpTitle>Associated Domains</HelpTitle>
          <ol>
            <li>
              Select your app target → <b>Signing &amp; Capabilities</b>.
            </li>
            <li>
              Click <b>+ Capability</b> and choose <b>Associated Domains</b>.
            </li>
            <li>
              Click <b>+</b> and paste each line, including{" "}
              <code>applinks:</code>.
            </li>
          </ol>
          <HelpTitle>URL scheme</HelpTitle>
          <ol>
            <li>
              Open the <b>Info</b> tab → <b>URL Types</b> → <b>+</b>.
            </li>
            <li>
              Paste the scheme into <b>URL Schemes</b>.
            </li>
          </ol>
          <HelpPitfalls
            items={[
              <>
                Leaving out <code>applinks:</code> or adding{" "}
                <code>https://</code>.
              </>,
              "Installing the app before adding the domain: delete and reinstall it once.",
            ]}
          />
          <HelpLinks>
            <DocLink
              href={docsUrl("/docs/how-to-guides/ios/associated-domain")}
            >
              Adding associated domains
            </DocLink>
          </HelpLinks>
        </HelpDocs>
      ),
    },
    {
      key: "add_sdk",
      title: "Install the SDK",
      summary: IOS_SDK_LABEL[sdk],
      done: signals.walked.has("add_sdk"),
      body: (
        <>
          <TextTabs
            label="Package manager"
            value={sdk}
            onChange={setSdk}
            options={[
              { value: "spm", label: IOS_SDK_LABEL.spm },
              { value: "pods", label: IOS_SDK_LABEL.pods },
              { value: "rn", label: IOS_SDK_LABEL.rn },
            ]}
          />
          {sdk === "spm" && (
            <>
              <Steps>
                <li>
                  In Xcode, choose <b>File → Add Package Dependencies…</b>
                </li>
                <li>
                  Paste this URL and click <b>Add Package</b>:
                </li>
              </Steps>
              <CopyLine value={IOS_SPM_URL} />
              <div className="mt-3">
                <Steps start={3}>
                  <li>
                    Tick <b>Grovs</b> for your app target.
                  </li>
                </Steps>
              </div>
            </>
          )}
          {sdk === "pods" && (
            <>
              <Steps>
                <li>
                  Add this line to your <b>Podfile</b>:
                </li>
              </Steps>
              <CopyLine value="pod 'Grovs'" />
              <div className="mt-3">
                <Steps start={2}>
                  <li>
                    Run <code className="font-mono">pod install</code> and open
                    the <b>.xcworkspace</b>.
                  </li>
                </Steps>
              </div>
            </>
          )}
          {sdk === "rn" && (
            <>
              <Steps>
                <li>In your project folder, run:</li>
              </Steps>
              <CopyLine value="npm install react-native-grovs-wrapper" />
              <div className="mt-3">
                <Steps start={2}>
                  <li>
                    Run <code className="font-mono">pod install</code> in{" "}
                    <code className="font-mono">ios/</code>.
                  </li>
                </Steps>
              </div>
            </>
          )}
        </>
      ),
      help: (
        <HelpDocs>
          <HelpTitle>Which one?</HelpTitle>
          <ol>
            <li>
              <b>Swift Package Manager</b> if your project has no Podfile.
            </li>
            <li>
              <b>CocoaPods</b> if it already uses a Podfile: add{" "}
              <code>pod &apos;Grovs&apos;</code> and run{" "}
              <code>pod install</code>.
            </li>
            <li>
              <b>React Native</b>:{" "}
              <code>npm install react-native-grovs-wrapper</code>, then{" "}
              <code>pod install</code> in <code>ios/</code>.
            </li>
          </ol>
          <HelpLinks>
            <DocLink href={docsUrl("/docs/sdk/ios/quick-start")}>
              Full iOS guide in Grovs docs
            </DocLink>
          </HelpLinks>
        </HelpDocs>
      ),
    },
    {
      key: "initialize_sdk",
      title: "Start the SDK",
      summary: initCode.file,
      done: signals.walked.has("initialize_sdk"),
      body: (
        <>
          <TextTabs
            label="Where your app starts"
            value={init}
            onChange={setInit}
            options={[
              { value: "app", label: "App Delegate" },
              { value: "scene", label: "Scene Delegate" },
              { value: "rn", label: "React Native" },
            ]}
          />
          <CodePanel
            filename={initCode.file}
            code={withKey(initCode.code, instance)}
          />
          <Hint>
            Lines marked <b className="text-chart-users!">+</b> are the ones to
            add. Use <code className="font-mono">useTestEnvironment: true</code>{" "}
            in debug builds.
          </Hint>
        </>
      ),
      help: (
        <HelpDocs>
          <HelpTitle>What each part does</HelpTitle>
          <ol>
            <li>
              <code>configure</code> starts Grovs and records installs and
              opens.
            </li>
            <li>
              <code>handleAppDelegate</code> passes links that open your app to
              Grovs.
            </li>
            <li>
              <code>grovsReceivedPayloadFromDeeplink</code> gives you the
              link&apos;s data so you can show the right screen.
            </li>
          </ol>
          <HelpTitle>Using scenes?</HelpTitle>
          <ol>
            <li>
              Apps created since iOS 13 usually have a <b>SceneDelegate</b>. Use
              that tab; the calls are <code>handleSceneDelegate</code>.
            </li>
          </ol>
          <HelpPitfalls
            items={[
              "Calling configure after the first screen loads: put it first in didFinishLaunching.",
              <>
                Shipping with <code>useTestEnvironment: true</code>.
              </>,
            ]}
          />
          <HelpLinks>
            <DocLink href={docsUrl("/docs/sdk/ios/quick-start")}>
              Full iOS guide in Grovs docs
            </DocLink>
          </HelpLinks>
        </HelpDocs>
      ),
    },
    {
      key: "run",
      title: "Run your app",
      summary: signals.seenAt ? `Connected ${timeAgo(signals.seenAt)}` : "",
      done: signals.seen,
      body: (
        <RunBody
          seen={signals.seen}
          seenAt={signals.seenAt}
          label={cfg?.bundle_id ?? ""}
          intro="Build and open the app once on a device or the simulator."
          waiting="Waiting for your app to open"
        />
      ),
      help: (
        <RunHelp
          instance={instance}
          registered={signals.registered}
          seen={signals.seen}
          seenAt={signals.seenAt}
          identifier={cfg?.bundle_id ?? ""}
          platformLabel="iOS"
        />
      ),
    },
  ];

  const submit = async (key: string) => {
    if (key === "register_app") {
      const same =
        cfg?.bundle_id === bundleId.trim() && cfg?.app_prefix === teamId.trim();
      if (same) return true;
      try {
        await save.mutateAsync({
          enabled: signals.config?.enabled ?? true,
          bundle_id: bundleId.trim(),
          app_prefix: teamId.trim(),
        });
        trackEvent(EVENTS.SDK_INTEGRATED, { platform: "ios" });
        return true;
      } catch {
        showGenericError();
        return false;
      }
    }
    if (key === "run") return signals.seen;
    return walk(key);
  };

  return {
    parts,
    submit,
    canSubmit: (key) =>
      key === "register_app"
        ? bundleValid && teamValid
        : key === "run"
          ? signals.seen
          : true,
    saving: save.isPending,
  };
}

// --- Android ---

type AndroidSdk = "gradle" | "rn";
type AndroidInit = "app" | "activity" | "links" | "rn";

export function useAndroidGuide(instance: Instance, data: SetupData): Guide {
  const signals = data.platforms.android;
  const cfg = signals.config?.configuration;
  const save = useSetAndroidConfigMutation(instance.id);
  const walk = useWalk(instance, "android");
  const { data: prodDomains } = useCustomDomainsQuery(instance.production?.id);
  const { data: testDomains } = useCustomDomainsQuery(instance.test?.id);
  const [packageName, setPackageName] = useState("");
  const [shas, setShas] = useState<string[]>([""]);
  const [sdk, setSdk] = useState<AndroidSdk>("gradle");
  const [init, setInit] = useState<AndroidInit>("app");
  const { data: release = null } = useAndroidSdkReleaseQuery();

  const savedIds = JSON.stringify([cfg?.identifier, cfg?.sha256s]);
  const [seededIds, setSeededIds] = useState<string | null>(null);
  if (seededIds !== savedIds) {
    setSeededIds(savedIds);
    setPackageName(cfg?.identifier ?? "");
    setShas(cfg?.sha256s?.length ? cfg.sha256s : [""]);
  }

  const packageValid = /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(
    packageName.trim()
  );
  const validShas = shas
    .map((s) => s.trim())
    .filter((s) => shaSchema.safeParse(s).success);
  const gradle = androidGradleDependency(release);
  const manifest = intentFiltersXml(instance.uri_scheme, [
    instance.production?.domain,
    ...extraHosts(prodDomains),
    instance.test?.domain,
    ...extraHosts(testDomains),
  ]);
  const initCode = {
    app: {
      file: "MainApplication.kt",
      code: withKey(sdkAndroidValue, instance),
    },
    activity: { file: "MainActivity.kt", code: sdkLauncherActivityValue },
    links: { file: "MainActivity.kt", code: sdkHandleDeepLinksValue },
    rn: { file: "App.js", code: sdkReactNativeAppValue },
  }[init];

  const parts: GuidePart[] = [
    {
      key: "register_app",
      title: "Your app's IDs",
      summary: cfg?.identifier,
      done: signals.registered,
      body: (
        <>
          <FieldLabel htmlFor="onb-package">Package name</FieldLabel>
          <SetupInput
            id="onb-package"
            value={packageName}
            onChange={setPackageName}
            placeholder="com.company.app"
            valid={packageValid}
            invalid={packageName.length > 0 && !packageValid}
          />
          <FieldLabel className="mt-4">SHA-256 fingerprints</FieldLabel>
          <div className="flex flex-col gap-2">
            {shas.map((sha, i) => (
              <div key={i} className="flex items-center gap-2">
                <SetupInput
                  aria-label={`SHA-256 fingerprint ${i + 1}`}
                  className="flex-1"
                  value={sha}
                  onChange={(v) =>
                    setShas((prev) => prev.map((s, j) => (j === i ? v : s)))
                  }
                  placeholder="14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64…"
                  valid={shaSchema.safeParse(sha.trim()).success}
                  invalid={
                    sha.length > 0 && !shaSchema.safeParse(sha.trim()).success
                  }
                />
                {shas.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove fingerprint"
                    onClick={() =>
                      setShas((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <Hint>
            Add the release and debug keys.{" "}
            <TextLink onClick={() => setShas((prev) => [...prev, ""])}>
              <Plus className="mr-0.5 inline size-3" />
              Add another
            </TextLink>
          </Hint>
        </>
      ),
      help: (
        <HelpDocs>
          <HelpTitle>Package name</HelpTitle>
          <ol>
            <li>
              Open <b>app/build.gradle</b> in Android Studio.
            </li>
            <li>
              Copy <b>applicationId</b>, e.g. <code>com.company.app</code>.
            </li>
          </ol>
          <HelpTitle>SHA-256 fingerprint</HelpTitle>
          <ol>
            <li>
              In <b>Google Play Console</b>, open your app →{" "}
              <b>Test and release</b> → <b>App signing</b>.
            </li>
            <li>
              Copy the <b>SHA-256 certificate fingerprint</b> of the app signing
              key.
            </li>
            <li>
              For local builds, run <code>./gradlew signingReport</code> and add
              that one too.
            </li>
          </ol>
          <HelpPitfalls
            items={[
              "Adding only the upload key: Play re-signs your app with its own key.",
              "Using the package name of a flavor you don't ship.",
            ]}
          />
          <HelpLinks>
            <DocLink
              href={docsUrl("/docs/how-to-guides/android/sha256-fingerprint")}
            >
              Getting your SHA-256
            </DocLink>
            <DocLink href={docsUrl("/docs/sdk/android/quick-start")}>
              Full Android guide in Grovs docs
            </DocLink>
          </HelpLinks>
        </HelpDocs>
      ),
    },
    {
      key: "intent_filters",
      title: "Add your domain to the app",
      summary: "AndroidManifest.xml",
      done: signals.walked.has("intent_filters"),
      body: (
        <>
          <p className="mb-3">
            Add these inside your launcher activity in{" "}
            <b>AndroidManifest.xml</b>.
          </p>
          <CodePanel
            filename="AndroidManifest.xml"
            code={manifest}
            highlight={false}
          />
        </>
      ),
      help: (
        <HelpDocs>
          <HelpTitle>Intent filters</HelpTitle>
          <ol>
            <li>
              Open <b>app/src/main/AndroidManifest.xml</b>.
            </li>
            <li>
              Find the <code>&lt;activity&gt;</code> with the{" "}
              <code>LAUNCHER</code> category.
            </li>
            <li>Paste the filters inside it, next to the existing one.</li>
          </ol>
          <HelpPitfalls
            items={[
              <>
                Leaving out <code>android:autoVerify=&quot;true&quot;</code>:
                links open the browser instead.
              </>,
              "Putting the filters on a different activity than the launcher.",
            ]}
          />
          <HelpLinks>
            <DocLink
              href={docsUrl("/docs/how-to-guides/android/intent-filter")}
            >
              Adding intent filters
            </DocLink>
          </HelpLinks>
        </HelpDocs>
      ),
    },
    {
      key: "add_sdk",
      title: "Install the SDK",
      summary: sdk === "gradle" ? "Gradle" : "React Native",
      done: signals.walked.has("add_sdk"),
      body: (
        <>
          <TextTabs
            label="Build system"
            value={sdk}
            onChange={setSdk}
            options={[
              { value: "gradle", label: "Gradle" },
              { value: "rn", label: "React Native" },
            ]}
          />
          {sdk === "gradle" ? (
            <>
              <Steps>
                <li>
                  Add this to <b>dependencies</b> in your app&apos;s{" "}
                  <b>build.gradle</b>:
                </li>
              </Steps>
              <CopyLine value={gradle} />
              <div className="mt-3">
                <Steps start={2}>
                  <li>
                    Click <b>Sync Now</b>.
                  </li>
                </Steps>
              </div>
            </>
          ) : (
            <>
              <Steps>
                <li>In your project folder, run:</li>
              </Steps>
              <CopyLine value="npm install react-native-grovs-wrapper" />
              <div className="mt-3">
                <Steps start={2}>
                  <li>
                    Also add <code className="font-mono">{gradle}</code> to{" "}
                    <b>android/app/build.gradle</b>.
                  </li>
                </Steps>
              </div>
            </>
          )}
        </>
      ),
      help: (
        <HelpDocs>
          <HelpTitle>Where it goes</HelpTitle>
          <ol>
            <li>
              The module-level <b>build.gradle</b> (usually <code>app/</code>),
              not the project-level one.
            </li>
            <li>
              Inside <code>dependencies {"{ }"}</code>.
            </li>
          </ol>
          <HelpLinks>
            <DocLink href={docsUrl("/docs/how-to-guides/android/gradle")}>
              Adding a package with Gradle
            </DocLink>
          </HelpLinks>
        </HelpDocs>
      ),
    },
    {
      key: "initialize_sdk",
      title: "Start the SDK",
      summary: initCode.file,
      done: signals.walked.has("initialize_sdk"),
      body: (
        <>
          <TextTabs
            label="File"
            value={init}
            onChange={setInit}
            options={[
              { value: "app", label: "Application" },
              { value: "activity", label: "Launcher activity" },
              { value: "links", label: "Receive links" },
              { value: "rn", label: "React Native" },
            ]}
          />
          <CodePanel filename={initCode.file} code={initCode.code} />
          <Hint>
            Lines marked <b className="text-chart-users!">+</b> are the ones to
            add. Use{" "}
            <code className="font-mono">useTestEnvironment = true</code> in
            debug builds.
          </Hint>
        </>
      ),
      help: (
        <HelpDocs>
          <HelpTitle>What each part does</HelpTitle>
          <ol>
            <li>
              <code>Grovs.configure</code> in your Application starts Grovs and
              records installs and opens.
            </li>
            <li>
              <code>onStart</code> and <code>onNewIntent</code> in the launcher
              activity pass links that open your app to Grovs.
            </li>
            <li>
              The listener gives you the link&apos;s data so you can show the
              right screen.
            </li>
          </ol>
          <HelpPitfalls
            items={[
              <>
                Forgetting to register the Application class in the manifest (
                <code>android:name</code>).
              </>,
              <>
                Shipping with <code>useTestEnvironment = true</code>.
              </>,
            ]}
          />
          <HelpLinks>
            <DocLink href={docsUrl("/docs/sdk/android/quick-start")}>
              Full Android guide in Grovs docs
            </DocLink>
          </HelpLinks>
        </HelpDocs>
      ),
    },
    {
      key: "run",
      title: "Run your app",
      summary: signals.seenAt ? `Connected ${timeAgo(signals.seenAt)}` : "",
      done: signals.seen,
      body: (
        <RunBody
          seen={signals.seen}
          seenAt={signals.seenAt}
          label={cfg?.identifier ?? ""}
          intro="Build and open the app once on a device or the emulator."
          waiting="Waiting for your app to open"
        />
      ),
      help: (
        <RunHelp
          instance={instance}
          registered={signals.registered}
          seen={signals.seen}
          seenAt={signals.seenAt}
          identifier={cfg?.identifier ?? ""}
          platformLabel="Android"
        />
      ),
    },
  ];

  const submit = async (key: string) => {
    if (key === "register_app") {
      const same =
        cfg?.identifier === packageName.trim() &&
        JSON.stringify(cfg?.sha256s ?? []) === JSON.stringify(validShas);
      if (same) return true;
      try {
        await save.mutateAsync({
          enabled: signals.config?.enabled ?? true,
          identifier: packageName.trim(),
          sha256s: validShas,
        });
        trackEvent(EVENTS.SDK_INTEGRATED, { platform: "android" });
        return true;
      } catch {
        showGenericError();
        return false;
      }
    }
    if (key === "run") return signals.seen;
    return walk(key);
  };

  return {
    parts,
    submit,
    canSubmit: (key) =>
      key === "register_app"
        ? packageValid && validShas.length > 0
        : key === "run"
          ? signals.seen
          : true,
    saving: save.isPending,
  };
}

// --- Web ---

export function useWebGuide(instance: Instance, data: SetupData): Guide {
  const signals = data.platforms.web;
  const cfg = signals.config?.configuration;
  const save = useSetWebConfigMutation(instance.id);
  const walk = useWalk(instance, "web");
  const [domains, setDomains] = useState<string[]>([""]);

  const savedDomains = JSON.stringify(cfg?.domains ?? []);
  const [seededDomains, setSeededDomains] = useState<string | null>(null);
  if (seededDomains !== savedDomains) {
    setSeededDomains(savedDomains);
    setDomains(cfg?.domains?.length ? cfg.domains : [""]);
  }

  const validDomains = domains
    .map((d) => d.trim())
    .filter((d) => d && isDomainValid(d));
  const anyInvalid = domains.some((d) => d.trim() && !isDomainValid(d.trim()));

  const parts: GuidePart[] = [
    {
      key: "register_domains",
      title: "Your websites",
      summary: cfg?.domains?.[0],
      done: signals.registered,
      body: (
        <>
          <p className="mb-3">
            Every site that runs the SDK, including staging and local ones.
          </p>
          <div className="flex flex-col gap-2">
            {domains.map((domain, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <SetupInput
                  aria-label={`Website ${i + 1}`}
                  tone="plain"
                  className="flex-1"
                  value={domain}
                  onChange={(v) =>
                    setDomains((prev) => prev.map((d, j) => (j === i ? v : d)))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && domain.trim()) {
                      e.preventDefault();
                      setDomains((prev) => [...prev, ""]);
                    }
                  }}
                  placeholder={
                    i === 0
                      ? "https://www.company.com"
                      : "https://staging.company.com"
                  }
                  autoFocus={i > 0 && !domain}
                  valid={!!domain.trim() && isDomainValid(domain.trim())}
                  invalid={!!domain.trim() && !isDomainValid(domain.trim())}
                />
                {domains.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove website ${i + 1}`}
                    onClick={() =>
                      setDomains((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {anyInvalid && (
            <ErrorText>
              Use a full address like https://www.company.com, or file:// for
              Electron.
            </ErrorText>
          )}
          <div className="mt-1.5 -ml-2 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setDomains((prev) => [...prev, ""])}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-foreground/75 hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Add website
            </button>
            {!domains.some((d) => d.trim() === FILE_ORIGIN) && (
              <button
                type="button"
                onClick={() =>
                  setDomains((prev) => [
                    ...prev.filter((d) => d.trim()),
                    FILE_ORIGIN,
                  ])
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-foreground/75 hover:bg-muted hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Add Electron app
                <code className="font-mono text-[12px] font-normal text-muted-foreground">
                  file://
                </code>
              </button>
            )}
          </div>
        </>
      ),
      help: (
        <HelpDocs>
          <HelpTitle>Which sites?</HelpTitle>
          <ol>
            <li>Your production site, e.g. https://www.company.com.</li>
            <li>Staging and preview sites you test on.</li>
            <li>
              <code>http://localhost:3000</code> while you develop.
            </li>
            <li>
              <code>file://</code> for an Electron app that loads its pages from
              disk.
            </li>
          </ol>
          <HelpPitfalls
            items={[
              "Leaving out the scheme: write https://, not just the host.",
            ]}
          />
          <HelpLinks>
            <DocLink href={docsUrl("/docs/how-to-guides/web/register-domains")}>
              Registering domains
            </DocLink>
          </HelpLinks>
        </HelpDocs>
      ),
    },
    {
      key: "add_sdk",
      title: "Install the SDK",
      summary: "npm",
      done: signals.walked.has("add_sdk"),
      body: (
        <>
          <Steps>
            <li>In your project folder, run:</li>
          </Steps>
          <CopyLine value="npm install grovs" />
        </>
      ),
      help: (
        <HelpDocs>
          <HelpTitle>Install</HelpTitle>
          <ol>
            <li>Works with any bundler: Vite, Next.js, webpack.</li>
            <li>
              Using yarn or pnpm? <code>yarn add grovs</code> works the same.
            </li>
          </ol>
          <HelpLinks>
            <DocLink href={docsUrl("/docs/sdk/web/quick-start")}>
              Full web guide in Grovs docs
            </DocLink>
          </HelpLinks>
        </HelpDocs>
      ),
    },
    {
      key: "integrate_sdk",
      title: "Start the SDK",
      summary: "main.js",
      done: signals.walked.has("integrate_sdk"),
      body: (
        <>
          <p className="mb-3">Add this where your site starts.</p>
          <CodePanel
            filename="main.js"
            code={withKey(integrateWebSdkValue, instance)}
          />
        </>
      ),
      help: (
        <HelpDocs>
          <HelpTitle>What each part does</HelpTitle>
          <ol>
            <li>
              <code>new Grovs(APIKey, callback)</code> sets it up; the callback
              receives the link&apos;s data.
            </li>
            <li>
              <code>start()</code> records the visit.
            </li>
            <li>
              <code>setUserIdentifier</code> ties visits to your user, if you
              have one.
            </li>
          </ol>
          <HelpLinks>
            <DocLink href={docsUrl("/docs/sdk/web/quick-start")}>
              Full web guide in Grovs docs
            </DocLink>
          </HelpLinks>
        </HelpDocs>
      ),
    },
    {
      key: "run",
      title: "Open your site",
      summary: signals.seenAt ? `Connected ${timeAgo(signals.seenAt)}` : "",
      done: signals.seen,
      body: (
        <RunBody
          seen={signals.seen}
          seenAt={signals.seenAt}
          label={cfg?.domains?.[0] ?? ""}
          intro="Load one of your sites with the SDK in a browser."
          waiting="Waiting for your site to load"
        />
      ),
      help: (
        <HelpDocs>
          <HelpTitle>Not showing up?</HelpTitle>
          <ol>
            <li>Check the site&apos;s address is in the list in part 1.</li>
            <li>Open the browser console and look for Grovs errors.</li>
            <li>
              Make sure <code>start()</code> runs on page load.
            </li>
          </ol>
        </HelpDocs>
      ),
    },
  ];

  const submit = async (key: string) => {
    if (key === "register_domains") {
      if (JSON.stringify(cfg?.domains ?? []) === JSON.stringify(validDomains))
        return true;
      try {
        await save.mutateAsync({ enabled: true, domains: validDomains });
        trackEvent(EVENTS.SDK_INTEGRATED, { platform: "web" });
        return true;
      } catch {
        showGenericError();
        return false;
      }
    }
    if (key === "run") return signals.seen;
    return walk(key);
  };

  return {
    parts,
    submit,
    canSubmit: (key) =>
      key === "register_domains"
        ? validDomains.length > 0 && !anyInvalid
        : key === "run"
          ? signals.seen
          : true,
    saving: save.isPending,
  };
}

export const PART_COUNT = (platform: Platform) =>
  PLATFORM_PARTS[platform].length;
