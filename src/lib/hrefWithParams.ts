export type PageSearchParams = Record<string, string | string[] | undefined>;

// Server redirects rebuild the URL, so carry the incoming query (instance_id,
// env_type, …) across, with `extra` taking precedence.
export const hrefWithParams = (
  path: string,
  params: PageSearchParams = {},
  extra: Record<string, string> = {}
): string => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || key in extra) continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else qs.append(key, value);
  }
  for (const [key, value] of Object.entries(extra)) qs.set(key, value);
  const query = qs.toString();
  return `${path}${query ? `?${query}` : ""}`;
};
