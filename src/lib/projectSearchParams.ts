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
