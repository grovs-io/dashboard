import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(() => Promise.resolve({ data: {} })),
  POST: vi.fn(() => Promise.resolve({ data: {} })),
  PUT: vi.fn(() => Promise.resolve({ data: {} })),
  DELETE: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

import { GET, POST, PUT, DELETE } from "@/lib/api";
import {
  getSsoConnectionAPICall,
  upsertSsoConnectionAPICall,
  deleteSsoConnectionAPICall,
  verifySsoDomainsAPICall,
  createScimTokenAPICall,
  deleteScimTokenAPICall,
  discoverSsoAPICall,
} from "@/api/sso/ssoService";

describe("ssoService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the connection", async () => {
    await getSsoConnectionAPICall("i1");
    expect(GET).toHaveBeenCalledWith("/api/v1/instances/i1/sso_connection");
  });

  it("upserts with the given payload", async () => {
    await upsertSsoConnectionAPICall("i1", { enforce: true });
    expect(PUT).toHaveBeenCalledWith("/api/v1/instances/i1/sso_connection", {
      enforce: true,
    });
  });

  it("deletes, verifies and manages the SCIM token on the sub-routes", async () => {
    await deleteSsoConnectionAPICall("i1");
    expect(DELETE).toHaveBeenCalledWith("/api/v1/instances/i1/sso_connection");
    await verifySsoDomainsAPICall("i1");
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/instances/i1/sso_connection/verify_domains",
      null
    );
    await createScimTokenAPICall("i1");
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/instances/i1/sso_connection/scim_token",
      null
    );
    await deleteScimTokenAPICall("i1");
    expect(DELETE).toHaveBeenCalledWith(
      "/api/v1/instances/i1/sso_connection/scim_token"
    );
  });

  it("discovers without retries", async () => {
    await discoverSsoAPICall("a@b.co");
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/identity/sso/discover",
      { email: "a@b.co" },
      { retry: false }
    );
  });
});
