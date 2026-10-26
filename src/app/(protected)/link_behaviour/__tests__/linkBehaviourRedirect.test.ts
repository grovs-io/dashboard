import { describe, it, expect, vi } from "vitest";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

import LinkBehaviourRedirect from "../[[...rest]]/page";
import LinkSettingsPage from "../../dynamic_links/settings/page";

const query = { instance_id: "9", env_type: "test" };
const visit = (rest?: string[]) =>
  LinkBehaviourRedirect({
    params: Promise.resolve({ rest }),
    searchParams: Promise.resolve(query),
  });

describe("old Links Behaviour routes", () => {
  it.each([
    [undefined, "/dynamic_links/settings"],
    [["domain"], "/dynamic_links/settings/domain"],
    [["smart_banners"], "/smart_banners"],
    [["smart_banners", "new"], "/smart_banners/new"],
    [["smart_banners", "5"], "/smart_banners/5"],
  ])("sends %j to %s with the query", async (rest, to) => {
    await visit(rest);
    expect(redirect).toHaveBeenLastCalledWith(
      `${to}?instance_id=9&env_type=test`
    );
  });

  it("opens the first link setting from the settings index", async () => {
    await LinkSettingsPage({ searchParams: Promise.resolve(query) });
    expect(redirect).toHaveBeenLastCalledWith(
      "/dynamic_links/settings/redirect_rules?instance_id=9&env_type=test"
    );
  });
});
