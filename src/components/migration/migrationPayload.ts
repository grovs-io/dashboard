import { migrationOldHostSchema } from "@/schemas/migration";
import type {
  CreateMigrationPayload,
  MigrationCredentials,
  MigrationProvider,
} from "@/types";

export function normalizeExtraHosts(
  hosts: string[],
  mainHost: string
): string[] {
  const main = mainHost.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of hosts) {
    const host = raw.trim().toLowerCase();
    if (!host || host === main || seen.has(host)) continue;
    seen.add(host);
    out.push(host);
  }
  return out;
}

export function isValidExtraHost(host: string): boolean {
  return migrationOldHostSchema.safeParse(host.trim().toLowerCase()).success;
}

export function buildCreateMigrationPayload(input: {
  provider: MigrationProvider;
  hostname: string;
  credentials: MigrationCredentials;
  providerHosted: boolean;
  extraHosts: string[];
}): CreateMigrationPayload {
  const payload: CreateMigrationPayload = {
    hostname: input.hostname,
    provider: input.provider,
    credentials: input.credentials,
  };
  if (!input.providerHosted) return payload;
  payload.provider_hosted = true;
  const extras = normalizeExtraHosts(input.extraHosts, input.hostname);
  if (extras.length > 0) payload.extra_hosts = extras;
  return payload;
}
