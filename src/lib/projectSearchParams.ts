export function updatedSearchParams(
  currentSearch: string,
  paramsObj: Record<string, string | number | undefined>
): string | null {
  const currentParams = new URLSearchParams(currentSearch);
  Object.entries(paramsObj).forEach(([key, value]) => {
    currentParams.set(key, String(value));
  });

  const nextSearch = `?${currentParams.toString()}`;
  return nextSearch === currentSearch ? null : nextSearch;
}

// Which instance to open: the URL's when given, else the one last chosen here, else the newest.
export function chooseInstance<T extends { id: number | string }>(
  sorted: T[],
  fromUrl: string | null,
  remembered: string | null | undefined
): { instance: T | undefined; denied: boolean } {
  const byId = (id: string) => sorted.find((item) => String(item.id) === id);
  if (fromUrl) {
    const found = byId(fromUrl);
    return { instance: found ?? sorted[0], denied: !found };
  }
  return {
    instance: (remembered && byId(remembered)) || sorted[0],
    denied: false,
  };
}
