import "@testing-library/jest-dom";

// jsdom does not implement IntersectionObserver. Provide a minimal browser-like
// constructor so components that call `new IntersectionObserver(...)` work in tests.
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(callback, options = {}) {
      this.callback = callback;
      this.options = options;
      this._observed = new Set();
    }

    observe(target) {
      if (!target) return;
      this._observed.add(target);
      this.callback(
        [
          {
            isIntersecting: true,
            target,
            intersectionRatio: 1,
            time: Date.now(),
            boundingClientRect: {},
            intersectionRect: {},
            rootBounds: null,
          },
        ],
        this,
      );
    }

    unobserve(target) {
      this._observed.delete(target);
    }

    disconnect() {
      this._observed.clear();
    }

    takeRecords() {
      return [];
    }
  };
}
