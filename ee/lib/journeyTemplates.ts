import { createStep, emptyJourney } from "@ee/lib/journeys";
import type {
  InAppJourneyStep,
  JourneyInput,
  PushStep,
} from "@ee/types/journey";

export interface JourneyTemplate {
  id: "blank" | "welcome" | "cart" | "winback";
  title: string;
  hint: string;
  draft: () => JourneyInput;
}

const push = (
  id: string,
  title: string,
  body: string,
  next: string | null = null
): PushStep => ({
  ...(createStep("push", id) as PushStep),
  title,
  body,
  next,
});

const inApp = (
  id: string,
  title: string,
  message: string,
  button: string
): InAppJourneyStep => ({
  ...(createStep("in_app", id) as InAppJourneyStep),
  content: {
    title,
    message,
    close_button: true,
    dismissible: true,
    backdrop: "dim",
    colors: {},
    image: { portrait: null, landscape: null },
    buttons: [{ id: "b1", text: button, action: { type: "close" } }],
    tap_action: null,
    question: null,
  },
  triggers: [{ type: "app_open" }],
});

export const JOURNEY_TEMPLATES: JourneyTemplate[] = [
  {
    id: "blank",
    title: "Blank",
    hint: "Start from the entry and add steps yourself",
    draft: emptyJourney,
  },
  {
    id: "welcome",
    title: "Welcome series",
    hint: "After install: a welcome push, then a tip if they do not come back",
    draft: () => ({
      ...emptyJourney(),
      name: "Welcome series",
      entry: {
        type: "event",
        event: { system: "install" },
        segment_id: null,
        audience_segment_id: null,
      },
      first_step: "s1",
      steps: {
        s1: {
          id: "s1",
          type: "wait",
          minutes: 1440,
          until: null,
          next: "s2",
          timeout_next: null,
        },
        s2: push(
          "s2",
          "Welcome aboard",
          "Here is how to get the most out of the app.",
          "s3"
        ),
        s3: {
          id: "s3",
          type: "wait",
          minutes: 4320,
          until: { kind: "event", event: { system: "app_open" } },
          next: null,
          timeout_next: "s4",
        },
        s4: inApp(
          "s4",
          "A quick tip",
          "Tap the + button to create your first item.",
          "Got it"
        ),
      },
    }),
  },
  {
    id: "cart",
    title: "Cart recovery",
    hint: "A push when a cart is left, then a discount if the push is ignored",
    draft: () => ({
      ...emptyJourney(),
      name: "Cart recovery",
      entry: {
        type: "event",
        event: { name: "add_to_cart", filters: [] },
        segment_id: null,
        audience_segment_id: null,
      },
      goals: [{ event: "checkout_completed", window_hours: 168 }],
      first_step: "s1",
      steps: {
        s1: {
          id: "s1",
          type: "wait",
          minutes: 120,
          until: {
            kind: "event",
            event: { name: "checkout_completed", filters: [] },
          },
          next: null,
          timeout_next: "s2",
        },
        s2: push(
          "s2",
          "You left something behind",
          "Your cart is saved. Finish your order in a tap.",
          "s3"
        ),
        s3: {
          id: "s3",
          type: "wait",
          minutes: 1440,
          until: { kind: "opened", step: "s2" },
          next: null,
          timeout_next: "s4",
        },
        s4: inApp(
          "s4",
          "10% off your cart",
          "Use code CART10 at checkout today.",
          "Go to cart"
        ),
      },
    }),
  },
  {
    id: "winback",
    title: "Win-back",
    hint: "People in a segment you pick get a push, then an in-app if they stay away",
    draft: () => ({
      ...emptyJourney(),
      name: "Win-back",
      entry: {
        type: "segment",
        event: null,
        segment_id: null,
        audience_segment_id: null,
      },
      first_step: "s1",
      steps: {
        s1: push("s1", "We miss you", "Come back and see what is new.", "s2"),
        s2: {
          id: "s2",
          type: "wait",
          minutes: 4320,
          until: { kind: "event", event: { system: "app_open" } },
          next: null,
          timeout_next: "s3",
        },
        s3: inApp(
          "s3",
          "Welcome back",
          "Here is what changed while you were away.",
          "Show me"
        ),
      },
    }),
  },
];
