import { IS_SELF_HOSTED } from "./edition";

export function allConfigured(
  ...requiredValues: Array<string | undefined>
): boolean {
  return requiredValues.every((value) =>
    Boolean(value && value.trim().length > 0)
  );
}

export const POSTHOG_ENABLED = allConfigured(
  process.env.NEXT_PUBLIC_POSTHOG_KEY
);

export const GTM_ENABLED = allConfigured(process.env.NEXT_PUBLIC_GTM_ID);

export const CHATWOOT_ENABLED =
  !IS_SELF_HOSTED &&
  allConfigured(
    process.env.NEXT_PUBLIC_CHATWOOT_URL,
    process.env.NEXT_PUBLIC_CHATWOOT_TOKEN
  );
