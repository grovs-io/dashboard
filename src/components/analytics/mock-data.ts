import type {
  SankeyData,
  InsightCard,
  TimelineEntry,
  TrendDataPoint,
  SourceBreakdown,
  NodeDetail,
  VersionFunnel,
  PlatformVersion,
} from "./types";

// Numbers are balanced: every node's inflow = outflow (or it's a terminal node)
// 8,400 App Opens → 7,200 Onboarding + 1,200 Didn't Start
// 7,200 Onboarding → 5,400 Main Screens + 1,800 Abandoned
// 5,400 Main Screens → 1,800 Conversions + 3,600 Exited
export const sankeyData: SankeyData = {
  nodes: [
    {
      name: "app_opens",
      displayName: "App Opens",
      value: 8400,
      category: "entry",
    },
    {
      name: "activation",
      displayName: "Activation",
      value: 7200,
      category: "screen",
    },
    {
      name: "drop_nostart",
      displayName: "Didn't Start",
      value: 1200,
      category: "negative",
    },
    {
      name: "main_screens",
      displayName: "Main Screens",
      value: 5400,
      category: "screen",
    },
    {
      name: "drop_abandoned",
      displayName: "Abandoned",
      value: 1800,
      category: "negative",
    },
    {
      name: "conversions",
      displayName: "Conversions",
      value: 1800,
      category: "positive",
    },
    {
      name: "drop_exited",
      displayName: "Exited",
      value: 3600,
      category: "negative",
    },
  ],
  links: [
    // App Opens → Activation (86%) + Didn't Start (14%)
    { source: 0, target: 1, value: 7200 },
    { source: 0, target: 2, value: 1200 },
    // Activation → Main Screens (75%) + Abandoned (25%)
    { source: 1, target: 3, value: 5400 },
    { source: 1, target: 4, value: 1800 },
    // Main Screens → Conversions (33%) + Exited (67%)
    { source: 3, target: 5, value: 1800 },
    { source: 3, target: 6, value: 3600 },
  ],
};

export const insightCards: InsightCard[] = [
  {
    label: "App Opens",
    value: 8400,
    formattedValue: "8.4K",
    conversionRate: 100,
    insight: "Up 11% from last week",
  },
  {
    label: "Activation",
    value: 7200,
    formattedValue: "7.2K",
    conversionRate: 86,
    previousRate: 80,
    insight: "86% complete login & onboarding",
  },
  {
    label: "Main Screens",
    value: 5400,
    formattedValue: "5.4K",
    conversionRate: 75,
    previousRate: 70,
    insight: "75% complete onboarding to screens",
  },
  {
    label: "Conversions",
    value: 1800,
    formattedValue: "1.8K",
    conversionRate: 33,
    previousRate: 28,
    insight: "33% of engaged users convert",
  },
];

export const timelineEntries: TimelineEntry[] = [
  {
    id: "1",
    date: "2026-04-26T14:30:00Z",
    message: "New users from 'summer-promo' link spiked 4x",
    type: "positive",
  },
  {
    id: "2",
    date: "2026-04-24T09:15:00Z",
    message: "Android retention dropped below 10% at Day 7",
    type: "negative",
  },
  {
    id: "3",
    date: "2026-04-22T16:45:00Z",
    message: "Screen 'checkout' became the #1 drop-off point",
    type: "info",
  },
  {
    id: "4",
    date: "2026-04-20T11:00:00Z",
    message: "iOS purchase conversion reached all-time high of 22%",
    type: "positive",
  },
  {
    id: "5",
    date: "2026-04-18T08:30:00Z",
    message: "Campaign 'spring-launch' drove 2.3K new installs",
    type: "positive",
  },
];

export const trendData: TrendDataPoint[] = Array.from(
  { length: 30 },
  (_, i) => {
    const date = new Date(2026, 3, i + 1);
    const base = 800 + Math.sin(i / 4) * 200 + i * 15;
    const previousBase = 700 + Math.sin(i / 4) * 180 + i * 10;
    return {
      date: date.toISOString().split("T")[0]!,
      users: Math.round(base + Math.random() * 100),
      previousUsers: Math.round(previousBase + Math.random() * 80),
    };
  }
);

export const sourceBreakdown: SourceBreakdown[] = [
  { name: "Direct Links", value: 4200 },
  { name: "Referrals", value: 2800 },
  { name: "Organic", value: 3100 },
  { name: "Campaigns", value: 2300 },
];

export const nodeDetails: Record<string, NodeDetail> = {
  src_links: {
    name: "src_links",
    displayName: "Direct Links",
    value: 4200,
    topProperties: [
      { label: "iOS", category: "device", count: 2436, percent: 58 },
      { label: "Android", category: "device", count: 1428, percent: 34 },
      { label: "Web", category: "device", count: 336, percent: 8 },
    ],
    topSources: [
      { name: "summer-promo", count: 1800 },
      { name: "product-launch", count: 1200 },
      { name: "email-campaign", count: 1200 },
    ],
  },
  src_organic: {
    name: "src_organic",
    displayName: "Organic",
    value: 3100,
    topProperties: [
      { label: "iOS", category: "device", count: 2015, percent: 65 },
      { label: "Android", category: "device", count: 930, percent: 30 },
      { label: "Web", category: "device", count: 155, percent: 5 },
    ],
    topSources: [
      { name: "app-store-search", count: 1800 },
      { name: "play-store", count: 1300 },
    ],
  },
  src_referrals: {
    name: "src_referrals",
    displayName: "Referrals",
    value: 2800,
    topProperties: [
      { label: "iOS", category: "device", count: 1540, percent: 55 },
      { label: "Android", category: "device", count: 1064, percent: 38 },
      { label: "Web", category: "device", count: 196, percent: 7 },
    ],
    topSources: [
      { name: "user-invites", count: 1600 },
      { name: "share-links", count: 1200 },
    ],
  },
  src_campaigns: {
    name: "src_campaigns",
    displayName: "Campaigns",
    value: 2300,
    topProperties: [
      { label: "iOS", category: "device", count: 1196, percent: 52 },
      { label: "Android", category: "device", count: 920, percent: 40 },
      { label: "Web", category: "device", count: 184, percent: 8 },
    ],
    topSources: [
      { name: "spring-campaign", count: 1400 },
      { name: "retargeting", count: 900 },
    ],
  },
  app_opens: {
    name: "app_opens",
    displayName: "App Opens",
    value: 8400,
    avgTime: "—",
    conversionRate: 81,
    topProperties: [
      { label: "iOS", category: "device", count: 4872, percent: 58 },
      { label: "Android", category: "device", count: 2940, percent: 35 },
      { label: "Web", category: "device", count: 588, percent: 7 },
    ],
    topSources: [
      { name: "summer-promo", count: 2900 },
      { name: "referral-program", count: 2200 },
      { name: "organic", count: 1800 },
    ],
    topEvents: [
      { name: "app_launch", count: 8400, percent: 100 },
      { name: "push_notification_open", count: 2100, percent: 25 },
      { name: "deep_link_open", count: 1800, percent: 21 },
    ],
  },
  activation: {
    name: "activation",
    displayName: "Activation",
    value: 7200,
    dropOff: 1800,
    avgTime: "2m 05s",
    conversionRate: 75,
    topProperties: [
      { label: "iOS", category: "device", count: 4320, percent: 60 },
      { label: "Android", category: "device", count: 2376, percent: 33 },
      { label: "Web", category: "device", count: 504, percent: 7 },
    ],
    topSources: [{ name: "app-open", count: 7200 }],
    topEvents: [
      { name: "login_start", count: 7200, percent: 100 },
      { name: "login_complete", count: 5800, percent: 81 },
      { name: "tutorial_complete", count: 5400, percent: 75 },
      { name: "profile_setup_complete", count: 5400, percent: 75 },
    ],
  },
  main_screens: {
    name: "main_screens",
    displayName: "Main Screens",
    value: 5400,
    dropOff: 3600,
    avgTime: "3m 40s",
    conversionRate: 33,
    topProperties: [
      { label: "Home", category: "screen", count: 2376, percent: 44 },
      {
        label: "Browse / Search",
        category: "screen",
        count: 1782,
        percent: 33,
      },
      { label: "Profile", category: "screen", count: 1242, percent: 23 },
    ],
    topSources: [{ name: "onboarding-complete", count: 5400 }],
    topEvents: [
      { name: "screen_view", count: 5400, percent: 100 },
      { name: "add_to_cart", count: 2100, percent: 39 },
      { name: "search_query", count: 1600, percent: 30 },
      { name: "category_browse", count: 1200, percent: 22 },
    ],
  },
  purchases: {
    name: "purchases",
    displayName: "Conversions",
    value: 1800,
    avgTime: "45s",
    conversionRate: 100,
    topProperties: [
      { label: "Purchase", category: "property", count: 1008, percent: 56 },
      { label: "Signup", category: "property", count: 504, percent: 28 },
      { label: "Custom event", category: "property", count: 288, percent: 16 },
    ],
    topSources: [
      { name: "checkout", count: 1000 },
      { name: "signup-complete", count: 500 },
      { name: "custom-goal", count: 300 },
    ],
    topEvents: [
      { name: "purchase_complete", count: 1000, percent: 56 },
      { name: "signup_complete", count: 500, percent: 28 },
      { name: "custom_conversion", count: 300, percent: 16 },
    ],
  },
  drop_nostart: {
    name: "drop_nostart",
    displayName: "Didn't Start",
    value: 1200,
    topProperties: [
      { label: "iOS", category: "device", count: 624, percent: 52 },
      { label: "Android", category: "device", count: 480, percent: 40 },
      { label: "Web", category: "device", count: 96, percent: 8 },
    ],
    topSources: [
      { name: "app-open-bounce", count: 800 },
      { name: "notification-dismiss", count: 400 },
    ],
  },
  drop_abandoned: {
    name: "drop_abandoned",
    displayName: "Abandoned",
    value: 1800,
    topProperties: [
      { label: "iOS", category: "device", count: 990, percent: 55 },
      { label: "Android", category: "device", count: 684, percent: 38 },
      { label: "Web", category: "device", count: 126, percent: 7 },
    ],
    topSources: [
      { name: "onboarding-skip", count: 1100 },
      { name: "permissions-denied", count: 700 },
    ],
  },
  drop_exited: {
    name: "drop_exited",
    displayName: "Exited",
    value: 3600,
    topProperties: [
      { label: "iOS", category: "device", count: 2088, percent: 58 },
      { label: "Android", category: "device", count: 1260, percent: 35 },
      { label: "Web", category: "device", count: 252, percent: 7 },
    ],
    topSources: [
      { name: "idle-timeout", count: 2000 },
      { name: "back-button", count: 1600 },
    ],
  },
  // Expanded conversion children
  conv_purchase: {
    name: "conv_purchase",
    displayName: "Purchases",
    value: 1000,
    avgTime: "35s",
    conversionRate: 100,
    topProperties: [
      { label: "Avg. Order", category: "property", count: 1000, percent: 100 },
      { label: "iOS", category: "device", count: 680, percent: 68 },
      { label: "Android", category: "device", count: 320, percent: 32 },
    ],
    topSources: [
      { name: "checkout", count: 700 },
      { name: "quick-buy", count: 300 },
    ],
    topEvents: [
      { name: "purchase_complete", count: 1000, percent: 100 },
      { name: "payment_selected", count: 1000, percent: 100 },
      { name: "coupon_applied", count: 230, percent: 23 },
    ],
  },
  conv_signup: {
    name: "conv_signup",
    displayName: "Sign Ups",
    value: 500,
    avgTime: "1m 20s",
    conversionRate: 100,
    topProperties: [
      { label: "Email", category: "property", count: 250, percent: 50 },
      { label: "Google", category: "property", count: 160, percent: 32 },
      { label: "Apple", category: "property", count: 90, percent: 18 },
    ],
    topSources: [
      { name: "signup-wall", count: 320 },
      { name: "checkout-prompt", count: 180 },
    ],
    topEvents: [
      { name: "signup_complete", count: 500, percent: 100 },
      { name: "email_verified", count: 420, percent: 84 },
    ],
  },
  conv_custom: {
    name: "conv_custom",
    displayName: "Custom Goals",
    value: 300,
    conversionRate: 100,
    topProperties: [
      {
        label: "Add to Wishlist",
        category: "property",
        count: 141,
        percent: 47,
      },
      { label: "Share Content", category: "property", count: 99, percent: 33 },
      { label: "Invite Friend", category: "property", count: 60, percent: 20 },
    ],
    topSources: [
      { name: "product-page", count: 140 },
      { name: "home-screen", count: 100 },
      { name: "profile", count: 60 },
    ],
    topEvents: [
      { name: "add_to_wishlist", count: 140, percent: 47 },
      { name: "share_content", count: 100, percent: 33 },
      { name: "invite_friend", count: 60, percent: 20 },
    ],
  },
  // Expanded activation child screens
  screen_login: {
    name: "screen_login",
    displayName: "Login / Signup",
    value: 7200,
    dropOff: 800,
    avgTime: "45s",
    conversionRate: 89,
    topProperties: [
      { label: "Email", category: "property", count: 3240, percent: 45 },
      { label: "Google SSO", category: "property", count: 2304, percent: 32 },
      {
        label: "Apple Sign In",
        category: "property",
        count: 1656,
        percent: 23,
      },
    ],
    topSources: [
      { name: "first-launch", count: 2200 },
      { name: "session-expired", count: 600 },
      { name: "logout-return", count: 400 },
    ],
    topEvents: [
      { name: "login_screen_view", count: 3200, percent: 100 },
      { name: "login_attempt", count: 2800, percent: 88 },
      { name: "login_success", count: 2400, percent: 75 },
      { name: "signup_start", count: 1100, percent: 34 },
    ],
  },
  screen_tutorial: {
    name: "screen_tutorial",
    displayName: "Tutorial",
    value: 6400,
    dropOff: 600,
    avgTime: "1m 30s",
    conversionRate: 91,
    topProperties: [
      {
        label: "Completed All Steps",
        category: "property",
        count: 3840,
        percent: 60,
      },
      {
        label: "Skipped Early",
        category: "property",
        count: 1600,
        percent: 25,
      },
      {
        label: "Partially Viewed",
        category: "property",
        count: 960,
        percent: 15,
      },
    ],
    topSources: [{ name: "login-complete", count: 2000 }],
    topEvents: [
      { name: "tutorial_start", count: 2000, percent: 100 },
      { name: "slide_view", count: 1700, percent: 85 },
      { name: "tutorial_skip", count: 500, percent: 25 },
      { name: "tutorial_complete", count: 1600, percent: 80 },
    ],
  },
  screen_setup: {
    name: "screen_setup",
    displayName: "Profile Setup",
    value: 5800,
    dropOff: 400,
    avgTime: "1m 50s",
    conversionRate: 93,
    topProperties: [
      { label: "Basic Info", category: "property", count: 5800, percent: 100 },
      { label: "Preferences", category: "property", count: 4524, percent: 78 },
      {
        label: "Avatar Upload",
        category: "property",
        count: 3770,
        percent: 65,
      },
    ],
    topSources: [
      { name: "tutorial-complete", count: 1600 },
      { name: "tutorial-skip", count: 400 },
    ],
    topEvents: [
      { name: "setup_start", count: 2000, percent: 100 },
      { name: "avatar_upload", count: 800, percent: 40 },
      { name: "preferences_set", count: 1560, percent: 78 },
      { name: "setup_complete", count: 1400, percent: 70 },
    ],
  },
  // Expanded main screens child screens
  screen_home: {
    name: "screen_home",
    displayName: "Home",
    value: 2400,
    dropOff: 1600,
    avgTime: "1m 24s",
    conversionRate: 33,
    topProperties: [
      { label: "iOS", category: "device", count: 1440, percent: 60 },
      { label: "Android", category: "device", count: 792, percent: 33 },
      { label: "Web", category: "device", count: 168, percent: 7 },
    ],
    topSources: [{ name: "onboarding-complete", count: 2400 }],
    topEvents: [
      { name: "screen_view", count: 2400, percent: 100 },
      { name: "banner_tap", count: 1100, percent: 46 },
      { name: "search_tap", count: 720, percent: 30 },
      { name: "category_browse", count: 580, percent: 24 },
    ],
  },
  screen_browse: {
    name: "screen_browse",
    displayName: "Browse / Search",
    value: 1800,
    dropOff: 1200,
    avgTime: "2m 10s",
    conversionRate: 33,
    topProperties: [
      { label: "With Results", category: "property", count: 1404, percent: 78 },
      { label: "No Results", category: "property", count: 396, percent: 22 },
    ],
    topSources: [
      { name: "home-search", count: 1100 },
      { name: "nav-browse", count: 700 },
    ],
    topEvents: [
      { name: "search_query", count: 1800, percent: 100 },
      { name: "result_tap", count: 1200, percent: 67 },
      { name: "filter_applied", count: 540, percent: 30 },
      { name: "add_to_cart", count: 420, percent: 23 },
    ],
  },
  screen_profile: {
    name: "screen_profile",
    displayName: "Profile",
    value: 1200,
    dropOff: 800,
    avgTime: "1m 05s",
    conversionRate: 33,
    topProperties: [
      { label: "View Settings", category: "property", count: 540, percent: 45 },
      { label: "Edit Profile", category: "property", count: 420, percent: 35 },
      { label: "Order History", category: "property", count: 240, percent: 20 },
    ],
    topSources: [
      { name: "nav-profile", count: 900 },
      { name: "settings-tap", count: 300 },
    ],
    topEvents: [
      { name: "profile_view", count: 1200, percent: 100 },
      { name: "settings_open", count: 540, percent: 45 },
      { name: "order_history", count: 240, percent: 20 },
    ],
  },
};

export const liveUsersCount = 14;

export const versionFunnels: VersionFunnel[] = [
  {
    version: "2.4.0",
    releaseDate: "Apr 20",
    funnels: {
      all: [
        { label: "App Opens", users: 3200, rate: 100 },
        { label: "Activation", users: 2750, rate: 86 },
        { label: "Main Screens", users: 1980, rate: 72 },
        { label: "Conversions", users: 576, rate: 29 },
      ],
      ios: [
        { label: "App Opens", users: 1850, rate: 100 },
        { label: "Activation", users: 1665, rate: 90 },
        { label: "Main Screens", users: 1250, rate: 75 },
        { label: "Conversions", users: 407, rate: 33 },
      ],
      android: [
        { label: "App Opens", users: 1100, rate: 100 },
        { label: "Activation", users: 880, rate: 80 },
        { label: "Main Screens", users: 594, rate: 68 },
        { label: "Conversions", users: 154, rate: 26 },
      ],
      web: [
        { label: "App Opens", users: 250, rate: 100 },
        { label: "Activation", users: 205, rate: 82 },
        { label: "Main Screens", users: 136, rate: 66 },
        { label: "Conversions", users: 15, rate: 11 },
      ],
    },
  },
  {
    version: "2.3.1",
    releaseDate: "Apr 10",
    funnels: {
      all: [
        { label: "App Opens", users: 4800, rate: 100 },
        { label: "Activation", users: 3936, rate: 82 },
        { label: "Main Screens", users: 2676, rate: 68 },
        { label: "Conversions", users: 720, rate: 27 },
      ],
      ios: [
        { label: "App Opens", users: 2800, rate: 100 },
        { label: "Activation", users: 2380, rate: 85 },
        { label: "Main Screens", users: 1666, rate: 70 },
        { label: "Conversions", users: 504, rate: 30 },
      ],
      android: [
        { label: "App Opens", users: 1600, rate: 100 },
        { label: "Activation", users: 1248, rate: 78 },
        { label: "Main Screens", users: 812, rate: 65 },
        { label: "Conversions", users: 192, rate: 24 },
      ],
      web: [
        { label: "App Opens", users: 400, rate: 100 },
        { label: "Activation", users: 308, rate: 77 },
        { label: "Main Screens", users: 198, rate: 64 },
        { label: "Conversions", users: 24, rate: 12 },
      ],
    },
  },
  {
    version: "2.3.0",
    releaseDate: "Mar 28",
    funnels: {
      all: [
        { label: "App Opens", users: 5100, rate: 100 },
        { label: "Activation", users: 4335, rate: 85 },
        { label: "Main Screens", users: 3060, rate: 71 },
        { label: "Conversions", users: 816, rate: 27 },
      ],
      ios: [
        { label: "App Opens", users: 2950, rate: 100 },
        { label: "Activation", users: 2596, rate: 88 },
        { label: "Main Screens", users: 1888, rate: 73 },
        { label: "Conversions", users: 590, rate: 31 },
      ],
      android: [
        { label: "App Opens", users: 1750, rate: 100 },
        { label: "Activation", users: 1400, rate: 80 },
        { label: "Main Screens", users: 952, rate: 68 },
        { label: "Conversions", users: 193, rate: 20 },
      ],
      web: [
        { label: "App Opens", users: 400, rate: 100 },
        { label: "Activation", users: 340, rate: 85 },
        { label: "Main Screens", users: 220, rate: 65 },
        { label: "Conversions", users: 34, rate: 15 },
      ],
    },
  },
  {
    version: "2.2.0",
    releaseDate: "Mar 15",
    funnels: {
      all: [
        { label: "App Opens", users: 4200, rate: 100 },
        { label: "Activation", users: 3360, rate: 80 },
        { label: "Main Screens", users: 2268, rate: 68 },
        { label: "Conversions", users: 588, rate: 26 },
      ],
      ios: [
        { label: "App Opens", users: 2400, rate: 100 },
        { label: "Activation", users: 2016, rate: 84 },
        { label: "Main Screens", users: 1411, rate: 70 },
        { label: "Conversions", users: 408, rate: 29 },
      ],
      android: [
        { label: "App Opens", users: 1500, rate: 100 },
        { label: "Activation", users: 1125, rate: 75 },
        { label: "Main Screens", users: 720, rate: 64 },
        { label: "Conversions", users: 150, rate: 21 },
      ],
      web: [
        { label: "App Opens", users: 300, rate: 100 },
        { label: "Activation", users: 219, rate: 73 },
        { label: "Main Screens", users: 138, rate: 63 },
        { label: "Conversions", users: 30, rate: 22 },
      ],
    },
  },
];

export const platformVersions: Record<string, PlatformVersion[]> = {
  ios: [
    { version: "2.4.0", users: 2950 },
    { version: "2.3.1", users: 2800 },
    { version: "2.3.0", users: 2400 },
    { version: "2.2.0", users: 1850 },
  ],
  android: [
    { version: "2.4.0", users: 1750 },
    { version: "2.3.1", users: 1600 },
    { version: "2.3.0", users: 1500 },
    { version: "2.2.1", users: 900 },
  ],
  web: [
    { version: "2.4.0", users: 680 },
    { version: "2.3.0", users: 420 },
  ],
};
