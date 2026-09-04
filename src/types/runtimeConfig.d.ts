export {};

declare global {
  interface Window {
    __GROVS_RUNTIME_CONFIG__?: {
      apiUrl: string;
    };
  }
}
