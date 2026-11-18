import { api, ApiError } from "./client";

export async function allPages(path, signal) {
  const result = [];
  for (let offset = 0; offset < 20000; offset += 200) {
    const page = await api(
      `${path}${path.includes("?") ? "&" : "?"}limit=200&offset=${offset}`,
      { signal },
    );
    if (!Array.isArray(page)) return page;
    result.push(...page);
    if (page.length < 200) return result;
  }
  return result;
}

export async function mapLimited(items, fn, signal, concurrency = 4) {
  const results = [];
  const executing = [];
  for (const item of items) {
    if (signal?.aborted) break;
    const p = Promise.resolve().then(() => fn(item, signal));
    results.push(p);
    if (concurrency <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}
