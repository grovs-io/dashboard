import type { InAppLayout } from "@ee/types/inApp";
import announcementBanner from "./announcement-banner";
import blank from "./blank";
import countdownOffer from "./countdown-offer";
import featureTour from "./feature-tour";
import feedback from "./feedback";
import productLaunch from "./product-launch";
import promoVideo from "./promo-video";
import pushPrimer from "./push-primer";
import winBack from "./win-back";

// A CC0 sample clip hosted on Grovs' own S3 bucket.
export const SAMPLE_VIDEO_URL =
  "https://s3.eu-north-1.amazonaws.com/grovs.io/grovs-test-video.mp4";

export interface GalleryExample {
  id: string;
  title: string;
  // Under the thumbnail: what the example is for and what it does.
  description: string;
  layout: InAppLayout;
  html: string;
}

export const GALLERY: GalleryExample[] = [
  {
    id: "promo-video",
    title: "Promo video",
    description:
      "A muted, looping clip with a sound toggle and a call to action.",
    layout: "modal",
    html: promoVideo.replace("SAMPLE_VIDEO_URL", SAMPLE_VIDEO_URL),
  },
  {
    id: "product-launch",
    title: "Product launch",
    description: "A full-screen hero image, three selling points and a button.",
    layout: "full",
    html: productLaunch,
  },
  {
    id: "push-primer",
    title: "Push permission primer",
    description:
      "Explains why before asking. The button hides when the app can't ask.",
    layout: "modal",
    html: pushPrimer,
  },
  {
    id: "countdown-offer",
    title: "Countdown offer",
    description: "A live countdown to midnight that makes a deal feel urgent.",
    layout: "modal",
    html: countdownOffer,
  },
  {
    id: "feature-tour",
    title: "Feature tour",
    description: "Three swipeable slides that walk people through what's new.",
    layout: "full",
    html: featureTour,
  },
  {
    id: "feedback",
    title: "Feedback",
    description:
      "Five faces to tap. Each tap tracks its own event, then thanks.",
    layout: "banner_bottom",
    html: feedback,
  },
  {
    id: "announcement-banner",
    title: "Announcement",
    description: "A slim banner for news, with a link to read more.",
    layout: "banner_top",
    html: announcementBanner,
  },
  {
    id: "win-back",
    title: "Win-back offer",
    description: "A personal welcome back with a discount code to copy.",
    layout: "modal",
    html: winBack,
  },
  {
    id: "blank",
    title: "Blank",
    description: "A plain card with a heading, text and a button.",
    layout: "modal",
    html: blank,
  },
];
