import "@testing-library/jest-dom/vitest";
import { runInThisContext } from "node:vm";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { configure } from "@testing-library/react";
import { server } from "./server";
import { clearSession } from "@/lib/api/client";
import { useUiStore } from "@/stores/uiStore";
// Node 24 fetch requires Node's AbortSignal, not jsdom's separate DOM realm.
const nodeCancellation = runInThisContext(
  "({ AbortController, AbortSignal })",
) as Pick<typeof globalThis, "AbortController" | "AbortSignal">;
Object.assign(globalThis, nodeCancellation);
// Lazy route compilation is slow on constrained Windows hosts. Keep waits
// condition-based while giving the real route enough time to initialize.
configure({ asyncUtilTimeout: 15000 });
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.assign(globalThis, { ResizeObserver: TestResizeObserver });
// jsdom's File lacks Blob.text(), which is available in supported browsers.
if (!File.prototype.text)
  File.prototype.text = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  clearSession();
  sessionStorage.clear();
  useUiStore.getState().reset();
});
afterAll(() => server.close());
