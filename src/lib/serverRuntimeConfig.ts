export const serializeRuntimeConfig = (apiUrl: string): string => {
  const config = JSON.stringify({ apiUrl }).replace(/</g, "\\u003c");
  return `window.__GROVS_RUNTIME_CONFIG__=${config};`;
};
