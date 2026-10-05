import { api, ApiError } from "./client";
export async function allPages<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; offset < 20000; offset += 200) {
    const page = await api<T[]>(
      `${path}${path.includes("?") ? "&" : "?"}limit=200&offset=${offset}`,
      { signal },
    );
    result.push(...page);
    if (page.length < 200) return result;
  }
  throw new ApiError(
    0,
    "PAGE_LIMIT",
    "This list is too large to load. Narrow your selection.",
  );
}
export async function mapLimited<T, R>(
  items: T[],
  action: (item: T) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (next < items.length) {
        signal?.throwIfAborted();
        const index = next++;
        result[index] = await action(items[index]);
      }
    }),
  );
  return result;
}
