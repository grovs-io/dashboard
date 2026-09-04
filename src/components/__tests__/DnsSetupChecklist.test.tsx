import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CustomDomain } from "@/types";
import DnsSetupChecklist from "../common/dns-setup-checklist";

vi.mock("@/lib/copyTextHelper", () => ({ handleCopyText: vi.fn() }));

const manualRow: CustomDomain = {
  hostname: "links.acme.com",
  purpose: "primary",
  status: "pending",
  ssl_status: null,
  verification_errors: null,
  source: "enterprise",
  cname_target: "links.app.com",
  ssl_validation_txt_records: [],
  setup_records: [
    {
      kind: "certificate",
      type: null,
      name: null,
      value: null,
      note: "Issue a certificate covering links.acme.com and attach it to your load balancer's HTTPS listener.",
    },
    {
      kind: "dns",
      type: "CNAME",
      name: "links.acme.com",
      value: "links.app.com",
      note: "Add this only after the certificate is attached.",
    },
  ],
};

describe("DnsSetupChecklist (manual mode)", () => {
  it("renders the setup_records checklist instead of the TXT/SSL steps", () => {
    render(<DnsSetupChecklist domain={manualRow} manualMode />);

    expect(
      screen.getByText(/issue a certificate covering links\.acme\.com/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/add this only after the certificate is attached/i)
    ).toBeInTheDocument();

    expect(screen.queryByText(/hostname ownership verified/i)).toBeNull();
    expect(screen.queryByText(/ssl certificate issued/i)).toBeNull();
    expect(screen.queryByText(/cname pointing to grovs/i)).toBeNull();
  });

  it("renders the DNS record as copyable Type/Host/Value rows from the record itself", () => {
    render(<DnsSetupChecklist domain={manualRow} manualMode />);
    expect(screen.getByText("CNAME")).toBeInTheDocument();
    expect(screen.getByText("links.acme.com")).toBeInTheDocument();
    expect(screen.getByText("links.app.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy value/i })
    ).toBeInTheDocument();
  });

  it("keeps the certificate step before the DNS step (ordering is load-bearing)", () => {
    render(<DnsSetupChecklist domain={manualRow} manualMode />);
    const cert = screen.getByText(/issue a certificate/i);
    const dns = screen.getByText(/add this only after/i);
    expect(
      cert.compareDocumentPosition(dns) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders a record table on a certificate step when the backend provides one", () => {
    const rowWithCertRecord = {
      ...manualRow,
      setup_records: [
        {
          kind: "certificate" as const,
          type: "CNAME",
          name: "_validation.links.acme.com",
          value: "ca-validation.example.com",
          note: "Add this validation record from your certificate authority.",
        },
      ],
    };
    render(<DnsSetupChecklist domain={rowWithCertRecord} manualMode />);
    expect(screen.getByText("_validation.links.acme.com")).toBeInTheDocument();
    expect(screen.getByText("ca-validation.example.com")).toBeInTheDocument();
  });

  it("falls back to a CNAME block when setup_records is empty", () => {
    const rowWithoutRecords = { ...manualRow, setup_records: [] };
    render(<DnsSetupChecklist domain={rowWithoutRecords} manualMode />);
    expect(screen.getByText("links.app.com")).toBeInTheDocument();
    expect(screen.getByText("CNAME")).toBeInTheDocument();
  });

  it("shows the administrator note when there is nothing renderable at all", () => {
    const bareRow = { ...manualRow, setup_records: [], cname_target: null };
    render(<DnsSetupChecklist domain={bareRow} manualMode />);
    expect(screen.getByText(/contact your administrator/i)).toBeInTheDocument();
  });

  it("still renders the Cloudflare checklist when tlsMode is cloudflare or absent", () => {
    const cloudflareRow: CustomDomain = {
      ...manualRow,
      setup_records: undefined,
      ssl_status: "pending_validation",
    };
    render(<DnsSetupChecklist domain={cloudflareRow} manualMode={false} />);
    expect(
      screen.getByText(/hostname ownership verified/i)
    ).toBeInTheDocument();
  });
});
