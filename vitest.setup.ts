import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

afterEach(() => {
  cleanup()
})

// jsdom doesn't implement these; stub so component effects don't throw.
if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(globalThis as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}

// TanStack Router's scroll restoration calls this on every navigation.
if (typeof window !== "undefined" && !("__scrollToStubbed" in window)) {
  window.scrollTo = function scrollTo() {}
  ;(window as unknown as Record<string, boolean>).__scrollToStubbed = true
}
