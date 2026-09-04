import { describe, it, expect } from "vitest";
import { AUDIT_ACTION_GROUPS, formatAuditAction } from "../auditActions";

describe("auditActions", () => {
  it("lists every action exactly once across groups", () => {
    const all = AUDIT_ACTION_GROUPS.flatMap((g) => g.actions);
    expect(all.length).toBeGreaterThan(40);
    expect(new Set(all).size).toBe(all.length);
  });

  it("every group has a label and at least one action", () => {
    for (const group of AUDIT_ACTION_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0);
      expect(group.actions.length).toBeGreaterThan(0);
    }
  });

  it("formatAuditAction returns the raw action string", () => {
    expect(formatAuditAction("instance.member_added")).toBe(
      "instance.member_added"
    );
  });
});
