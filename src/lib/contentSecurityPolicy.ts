interface ContentSecurityPolicyOptions {
  apiUrl: string;
  nodeEnv?: string;
  posthogUrl?: string;
  posthogEnabled?: boolean;
  gtmEnabled?: boolean;
  chatwootUrl?: string;
  chatwootEnabled?: boolean;
}

const origin = (value: string): string => new URL(value).origin;

export const buildContentSecurityPolicy = ({
  apiUrl,
  nodeEnv = "production",
  posthogUrl = "https://eu.i.posthog.com",
  posthogEnabled = false,
  gtmEnabled = false,
  chatwootUrl = "",
  chatwootEnabled = false,
}: ContentSecurityPolicyOptions): string => {
  const apiOrigin = origin(apiUrl);
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    nodeEnv === "development" ? "'unsafe-eval'" : "",
    gtmEnabled ? "https://www.googletagmanager.com" : "",
    posthogEnabled ? posthogUrl : "",
    chatwootEnabled ? chatwootUrl : "",
  ].filter(Boolean);
  const connectSources = [
    "'self'",
    apiOrigin,
    posthogEnabled ? posthogUrl : "",
    gtmEnabled ? "https://*.google-analytics.com" : "",
    gtmEnabled ? "https://www.googletagmanager.com" : "",
    gtmEnabled ? "https://www.google.com" : "",
    gtmEnabled ? "https://*.googleadservices.com" : "",
    gtmEnabled ? "https://*.g.doubleclick.net" : "",
    "https://api.github.com",
    chatwootEnabled ? chatwootUrl : "",
  ].filter(Boolean);
  const frameSources = [
    "'self'",
    gtmEnabled ? "https://www.googletagmanager.com" : "",
    chatwootEnabled ? chatwootUrl : "",
  ].filter(Boolean);

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSources.join(" ")}`,
    `frame-src ${frameSources.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
};
