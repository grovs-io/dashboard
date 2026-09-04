import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(() => Promise.resolve({ data: {} })),
  POST: vi.fn(() => Promise.resolve({ data: {} })),
  DELETE: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

import { GET, POST, DELETE } from "@/lib/api";
import {
  getAuditHeadAPICall,
  getAuditEventsAPICall,
  listAuditExportTokensAPICall,
  createAuditExportTokenAPICall,
  revokeAuditExportTokenAPICall,
} from "@/api/audit/auditService";

describe("auditService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches the chain head", async () => {
    await getAuditHeadAPICall("i1");
    expect(GET).toHaveBeenCalledWith("/api/v1/instances/i1/audit_events/head");
  });

  it("fetches events with query params, skipping empty ones", async () => {
    await getAuditEventsAPICall("i1", {
      order: "desc",
      limit: 50,
      before: 120,
      event_action: "link.created",
      actor_email: "",
      from: undefined,
    });
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/instances/i1/audit_events?order=desc&limit=50&before=120&event_action=link.created"
    );
  });

  it("fetches events with no params", async () => {
    await getAuditEventsAPICall("i1");
    expect(GET).toHaveBeenCalledWith("/api/v1/instances/i1/audit_events");
  });

  it("lists export tokens", async () => {
    await listAuditExportTokensAPICall("i1");
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/instances/i1/audit_export_tokens"
    );
  });

  it("creates an export token", async () => {
    await createAuditExportTokenAPICall("i1", { name: "Splunk" });
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/instances/i1/audit_export_tokens",
      { name: "Splunk" }
    );
  });

  it("revokes an export token", async () => {
    await revokeAuditExportTokenAPICall("i1", "tok_1");
    expect(DELETE).toHaveBeenCalledWith(
      "/api/v1/instances/i1/audit_export_tokens/tok_1"
    );
  });
});
