import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { inAppApi } from "@ee/api/in_app/inAppService";
import {
  ok,
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import {
  inAppCampaign,
  questionCampaign,
  starsQuestion,
} from "@ee/lib/__tests__/inAppFixtures";
import {
  draftFromCampaign,
  quickQuestionDraft,
  rateDraft,
} from "@ee/lib/inAppComposer";
import InAppComposer from "../composer/InAppComposer";
import InAppSummary from "../InAppSummary";

vi.mock("@ee/api/in_app/inAppService", () => ({
  inAppApi: { create: vi.fn(), update: vi.fn(), step: vi.fn() },
}));
vi.mock("@ee/hooks/queries/useSegmentsQueries", () => ({
  useSegmentsQuery: () => ({ data: { segments: [] } }),
}));
vi.mock("@ee/hooks/queries/useInAppSuggestions", () => ({
  useInAppSuggestions: () => ({
    loading: false,
    userAttributes: [],
    eventProperties: [],
  }),
}));
vi.mock("@/lib/Notifications", () => ({
  showSuccessNotification: vi.fn(),
  showErrorNotification: vi.fn(),
}));

const api = vi.mocked(inAppApi);

function open(props: Partial<Parameters<typeof InAppComposer>[0]> = {}) {
  wrap(
    <InAppComposer
      projectId="p1"
      closeRef={{ current: null }}
      onClose={vi.fn()}
      {...props}
    />
  );
}

const radio = (name: string | RegExp) => screen.getByRole("radio", { name });
const toggle = (name: string | RegExp) => screen.getByRole("switch", { name });
const click = (el: HTMLElement) => userEvent.click(el);
const card = () => screen.getByTestId("in-app-preview-card");

async function save() {
  await click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(api.create).toHaveBeenCalled());
  return api.create.mock.calls[0]![1].content!;
}

const row = (name: string) => within(screen.getByRole("group", { name }));
// The one text input of a row: the question it asks.
const asked = (name: string) => row(name).getByRole("textbox");
const thanks = () => screen.getByRole("textbox", { name: "Thank-you message" });

async function pick(name: string, option: string) {
  await click(row(name).getByRole("combobox"));
  await click(screen.getByRole("option", { name: option }));
}

async function ask(kind?: RegExp) {
  await userEvent.type(screen.getByLabelText("Title"), "How was it?");
  await click(radio(/Answer a question/));
  if (kind) await click(radio(kind));
}

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  api.create.mockResolvedValue(
    ok({ in_app_campaign: inAppCampaign() }) as never
  );
});

describe("a question in the composer", () => {
  it("takes the place of the buttons and the tap action, which are kept", async () => {
    open();
    await click(screen.getByRole("button", { name: /Add button/ }));
    await userEvent.type(screen.getByLabelText("Button 1 label"), "Shop");
    expect(radio(/Tap a button/)).toBeChecked();
    await ask();
    expect(radio(/^Stars/)).toBeChecked();
    expect(screen.queryByLabelText("Button 1 label")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Tap action" })).toBeNull();
    expect(card()).not.toHaveTextContent("Shop");
    await click(radio(/Tap a button/));
    expect(screen.getByLabelText("Button 1 label")).toHaveValue("Shop");
    await click(radio(/Answer a question/));
    expect(await save()).toMatchObject({
      buttons: [],
      tap_action: null,
      question: {
        id: "q1",
        type: "stars",
        options: [],
        comment: null,
        thanks: null,
        review_from: null,
      },
    });
  });

  it("stars: what follows a low answer, a high one, and the thanks", async () => {
    open();
    await ask();
    expect(screen.getByText("After the answer")).toBeInTheDocument();
    expect(
      screen.queryAllByRole("switch", { name: /comment|review/i })
    ).toEqual([]);
    for (const name of ["1 to 3 stars", "4 or 5 stars"]) {
      expect(row(name).getByRole("combobox")).toHaveTextContent("Nothing more");
      expect(row(name).queryByRole("textbox")).toBeNull();
    }
    expect(thanks()).toHaveAttribute("placeholder", "Thank you");
    expect(screen.getByText("(optional)")).toHaveClass("text-muted-foreground");

    await pick("1 to 3 stars", "Ask what could be better");
    expect(asked("1 to 3 stars")).toHaveValue("What could be better?");
    await pick("4 or 5 stars", "Ask what they like");
    expect(asked("4 or 5 stars")).toHaveValue("What do you like most?");
    await userEvent.type(asked("4 or 5 stars"), " Tell us");
    await userEvent.type(thanks(), " Thank you ");
    expect((await save()).question).toEqual({
      id: "q1",
      type: "stars",
      options: [],
      comment: {
        split: 3,
        low: "What could be better?",
        high: "What do you like most? Tell us",
      },
      thanks: "Thank you",
      review_from: null,
    });
  });

  it("stars: a store review instead of a question for high answers", async () => {
    open();
    await ask();
    await pick("4 or 5 stars", "Ask what they like");
    await pick("4 or 5 stars", "Ask for a store review");
    expect(row("4 or 5 stars").queryByRole("textbox")).toBeNull();
    expect(
      row("4 or 5 stars").getByText(
        "Shows the store's own review prompt inside the app. Apple and Google decide how often it appears. Not shown on the web."
      )
    ).toBeInTheDocument();
    expect((await save()).question).toMatchObject({
      comment: null,
      review_from: 4,
    });
  });

  it("stars: nothing more puts a row back to nothing", async () => {
    open({ preset: rateDraft() });
    await pick("1 to 3 stars", "Nothing more");
    await pick("4 or 5 stars", "Nothing more");
    expect(screen.queryByLabelText(/^Question (for|after)/)).toBeNull();
    expect(screen.queryByText(/review prompt/)).toBeNull();
    expect((await save()).question).toMatchObject({
      comment: null,
      review_from: null,
      thanks: "Thank you",
    });
  });

  it("each question input is named for a screen reader by the answers it follows", async () => {
    open({ preset: rateDraft() });
    await pick("4 or 5 stars", "Ask what they like");
    expect(screen.getByLabelText("Question for 1 to 3 stars")).toHaveValue(
      "What could be better?"
    );
    expect(screen.getByLabelText("Question for 4 or 5 stars")).toHaveValue(
      "What do you like most?"
    );
    // Both still read "Question" on the page.
    expect(screen.getAllByText("Question", { selector: "label" })).toHaveLength(
      2
    );
    await click(radio(/^Choices/));
    expect(screen.getByLabelText("Question after the choice")).toHaveValue(
      "Anything to add?"
    );
  });

  it("a row that asks needs its question", async () => {
    open({ preset: rateDraft() });
    await userEvent.clear(asked("1 to 3 stars"));
    await click(screen.getByRole("button", { name: /Check and launch/ }));
    expect(
      screen.getByText("Write the question for 1 to 3 stars.")
    ).toBeInTheDocument();
  });

  it("numbers the editor does not offer name the rows, and stay until a row is changed", async () => {
    api.update.mockResolvedValue(
      ok({ in_app_campaign: inAppCampaign() }) as never
    );
    const question = {
      ...starsQuestion,
      comment: { split: 2, low: "Why?", high: "What is best?" },
      review_from: 5,
    };
    open({
      initial: questionCampaign({ content: { title: "Hi", question } }),
    });
    expect(asked("1 or 2 stars")).toHaveValue("Why?");
    expect(row("3 to 5 stars").getByRole("combobox")).toHaveTextContent(
      "Ask what they like"
    );
    await userEvent.type(thanks(), "!");
    await click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.update.mock.calls[0]![2].content?.question).toEqual({
      ...question,
      thanks: "Thank you!",
    });
    await pick("3 to 5 stars", "Ask for a store review");
    await click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
    expect(api.update.mock.calls[1]![2].content?.question).toMatchObject({
      comment: { split: 2, low: "Why?", high: null },
      review_from: 3,
    });
  });

  it("offers two kinds", async () => {
    open();
    await ask();
    expect(
      within(screen.getByRole("radiogroup", { name: "Kind of question" }))
        .getAllByRole("radio")
        .map((el) => el.textContent)
    ).toEqual(["Stars1 to 5", "ChoicesPick one from a list"]);
  });

  it("wording nobody touched follows the kind, and what was typed stays", async () => {
    open();
    await ask();
    await pick("1 to 3 stars", "Ask what could be better");
    await click(radio(/^Choices/));
    expect(row("After the choice").getByRole("combobox")).toHaveTextContent(
      "Ask a follow-up question"
    );
    expect(asked("After the choice")).toHaveValue("Anything to add?");
    await click(radio(/^Stars/));
    expect(asked("1 to 3 stars")).toHaveValue("What could be better?");
    await userEvent.type(asked("1 to 3 stars"), " Tell us");
    await click(radio(/^Choices/));
    expect(asked("After the choice")).toHaveValue(
      "What could be better? Tell us"
    );
  });

  it("choices: two to five, each with an id that stays put and is never handed on", async () => {
    open();
    await ask(/^Choices/);
    expect(
      screen.getAllByRole("group").map((el) => el.getAttribute("aria-label"))
    ).toEqual(["After the choice", "Thank-you message"]);
    expect(
      screen.getByRole("button", { name: "Remove choice 1" })
    ).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Choice 1"), "Search");
    await userEvent.type(screen.getByLabelText("Choice 2"), "Browse");
    const add = () => screen.queryByRole("button", { name: /Add choice/ });
    await click(add()!);
    await userEvent.type(screen.getByLabelText("Choice 3"), "Offline");
    await click(screen.getByRole("button", { name: "Remove choice 2" }));
    await click(add()!);
    await userEvent.type(screen.getByLabelText("Choice 3"), "Sharing");
    expect(card()).toHaveTextContent("SearchOfflineSharing");
    await pick("After the choice", "Ask a follow-up question");
    expect(asked("After the choice")).toHaveValue("Anything to add?");
    await click(add()!);
    await click(add()!);
    expect(add()).toBeNull();
    await click(screen.getByRole("button", { name: "Remove choice 5" }));
    await click(screen.getByRole("button", { name: "Remove choice 4" }));
    const question = (await save()).question!;
    const fresh = expect.stringMatching(/^o_[0-9a-z]{8}$/);
    expect(question).toEqual({
      id: "q1",
      type: "choice",
      options: [
        { id: "option_1", text: "Search" },
        { id: fresh, text: "Offline" },
        { id: fresh, text: "Sharing" },
      ],
      comment: { split: null, low: "Anything to add?", high: null },
      thanks: null,
      review_from: null,
    });
    // The removed "Browse" was option_2; its answers must not show under "Sharing".
    expect(new Set(question.options.map((o) => o.id)).size).toBe(3);
  });

  it("after launch the kind, and whether there is a question, cannot change", async () => {
    open({ initial: questionCampaign({ status: "live" }) });
    const locked = [
      radio(/^Stars/),
      radio(/^Choices/),
      radio(/Tap a button/),
      radio(/Answer a question/),
    ];
    for (const el of locked)
      expect(el).toHaveAttribute("aria-disabled", "true");
    await click(radio(/^Choices/));
    expect(radio(/^Stars/)).toBeChecked();
    expect(
      await screen.findByText(
        "The question's type can't change once the message is live."
      )
    ).toBeInTheDocument();
    await click(radio(/Tap a button/));
    expect(radio(/Answer a question/)).toBeChecked();
    // The wording, the follow-ups and the thanks are still open.
    expect(asked("1 to 3 stars")).toBeEnabled();
    expect(thanks()).toBeEnabled();
  });

  it("before launch nothing about the question is locked", async () => {
    open({ initial: questionCampaign() });
    for (const name of [
      /^Stars/,
      /^Choices/,
      /Tap a button/,
      /Answer a question/,
    ]) {
      expect(radio(name)).toBeEnabled();
      expect(radio(name)).not.toHaveAttribute("title");
    }
  });

  it("after launch the choices of a list can still be edited, added and removed", async () => {
    open({
      initial: questionCampaign({
        status: "live",
        content: {
          title: "How did you find us?",
          question: {
            id: "q1",
            type: "choice",
            options: [
              { id: "option_1", text: "Search" },
              { id: "option_2", text: "A friend" },
            ],
            comment: null,
            thanks: null,
            review_from: null,
          },
        },
      }),
    });
    await userEvent.type(screen.getByLabelText("Choice 1"), " engine");
    await click(screen.getByRole("button", { name: /Add choice/ }));
    await userEvent.type(screen.getByLabelText("Choice 3"), "An ad");
    await click(screen.getByRole("button", { name: "Remove choice 2" }));
    expect(screen.getByLabelText("Choice 1")).toHaveValue("Search engine");
    expect(screen.getByLabelText("Choice 2")).toHaveValue("An ad");
    expect(screen.queryByLabelText("Choice 3")).toBeNull();
  });

  it("templates that cannot hold the question are switched off, with the reason", async () => {
    open();
    await ask();
    await click(screen.getByRole("combobox", { name: "Template" }));
    const option = (name: RegExp) => screen.getByRole("option", { name });
    for (const name of [
      /^Alert/,
      /^Interstitial image/,
      /^Half interstitial image/,
      /^Cover image/,
    ]) {
      expect(option(name)).toBeDisabled();
      expect(option(name)).toHaveTextContent("Cannot hold a question");
    }
    for (const name of [/^Header/, /^Footer/, /^Cover\s*Fills/])
      expect(option(name)).toBeEnabled();
    await click(option(/^Footer/));
    expect(
      screen.getByRole("combobox", { name: "Template" })
    ).toHaveTextContent("Footer");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a template chosen before the question says so once, and blocks the launch", async () => {
    open();
    await click(screen.getByRole("combobox", { name: "Template" }));
    await click(screen.getByRole("option", { name: /^Alert/ }));
    await ask();
    const problem = "Alert cannot hold a question. Choose another template.";
    expect(screen.getByRole("alert")).toHaveTextContent(problem);
    await click(screen.getByRole("button", { name: /Check and launch/ }));
    await click(screen.getByRole("button", { name: "Launch" }));
    expect(screen.getAllByText(problem)).toHaveLength(1);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("without a question every template can be chosen", async () => {
    open();
    await click(screen.getByRole("combobox", { name: "Template" }));
    for (const option of screen.getAllByRole("option"))
      expect(option).toBeEnabled();
  });

  it("a saved question opens as it was", () => {
    open({ initial: questionCampaign() });
    expect(radio(/Answer a question/)).toBeChecked();
    expect(radio(/^Stars/)).toBeChecked();
    expect(asked("1 to 3 stars")).toHaveValue("What could be better?");
    expect(row("4 or 5 stars").getByRole("combobox")).toHaveTextContent(
      "Ask for a store review"
    );
    expect(thanks()).toHaveValue("Thank you");
  });

  it("a message people cannot close stays until it is answered", async () => {
    open();
    await ask();
    await click(toggle(/People can close it without answering/));
    expect(
      screen.getByText("It stays until the question is answered.")
    ).toBeInTheDocument();
    await click(screen.getByRole("button", { name: /Check and launch/ }));
    expect(screen.getByText("Ready to launch")).toBeInTheDocument();
  });
});

describe("the preview of a question", () => {
  const steps = () =>
    within(screen.getByRole("radiogroup", { name: "Preview step" }))
      .getAllByRole("radio")
      .map((el) => el.textContent);

  it("draws five stars and offers only the steps that are set", async () => {
    open();
    await ask();
    expect(card().querySelectorAll("svg.lucide-star")).toHaveLength(5);
    expect(
      screen.queryByRole("radiogroup", { name: "Preview step" })
    ).toBeNull();
    await userEvent.type(thanks(), "Bye");
    expect(steps()).toEqual(["Question", "Thanks"]);
    await pick("4 or 5 stars", "Ask what they like");
    expect(steps()).toEqual(["Question", "Comment", "Thanks"]);
  });

  it("walks the comment for low answers, the other one, and the thanks", async () => {
    open({ preset: rateDraft() });
    await pick("4 or 5 stars", "Ask what they like");
    await click(radio("Comment"));
    expect(card()).toHaveTextContent("What could be better?");
    expect(card()).toHaveTextContent("Your answer");
    expect(card()).not.toHaveTextContent("Enjoying the app?");
    expect(radio("1 to 3 stars")).toBeChecked();
    await click(radio("4 or 5 stars"));
    expect(card()).toHaveTextContent("What do you like most?");
    await click(radio("Thanks"));
    expect(card()).toHaveTextContent("Thank you");
    expect(card()).not.toHaveTextContent("Your answer");
  });

  it("goes back to the question when the step it showed is switched off", async () => {
    open({ preset: rateDraft() });
    expect(
      screen.queryByRole("radiogroup", { name: "Comment for" })
    ).toBeNull();
    await click(radio("Comment"));
    expect(card()).toHaveTextContent("What could be better?");
    await pick("1 to 3 stars", "Nothing more");
    expect(steps()).toEqual(["Question", "Thanks"]);
    expect(card()).toHaveTextContent("Enjoying the app?");
  });

  it("stacks the choices under the text", () => {
    open({ preset: quickQuestionDraft() });
    expect(card()).toHaveTextContent(
      "What would you like to see next?Option 1Option 2"
    );
  });

  it("keeps the question light on a dark message", async () => {
    open({
      preset: { ...quickQuestionDraft(), colors: { background: "#111827" } },
    });
    expect(within(card()).getByText("Option 1")).toHaveClass("text-white");
  });
});

describe("the summary of a question", () => {
  it("says it in plain words, and that nobody is asked twice", () => {
    wrap(<InAppSummary draft={draftFromCampaign(questionCampaign())} />);
    expect(
      screen.getByText(
        "Asks for 1 to 5 stars. People who give 1 to 3 stars are asked “What could be better?”. People who give 4 or 5 stars are asked for a store review. Says “Thank you”."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("A person who has answered is not asked again.")
    ).toBeInTheDocument();
  });

  it("leaves out the buttons a question does not send", () => {
    wrap(
      <InAppSummary
        draft={{
          ...rateDraft(),
          dismissible: false,
          buttons: [{ id: "b", text: "Shop", action: { type: "close" } }],
          tapAction: { type: "close" },
        }}
      />
    );
    expect(screen.queryByText("Shop")).toBeNull();
    expect(screen.queryByText("A tap on the message")).toBeNull();
    expect(screen.getByText("the question is answered")).toBeInTheDocument();
  });

  it("says nothing of a question when there is none", () => {
    wrap(<InAppSummary draft={draftFromCampaign(inAppCampaign())} />);
    expect(screen.queryByText(/not asked again/)).toBeNull();
  });
});
