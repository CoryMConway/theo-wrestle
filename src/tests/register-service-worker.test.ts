import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "../lib/register-service-worker";

describe("registerServiceWorker", () => {
  it("registers SW and applies update when a new worker is installed", async () => {
    const loadListeners: Array<() => void> = [];
    const controllerChangeListeners: Array<() => void> = [];
    const updateFoundListeners: Array<() => void> = [];
    const stateChangeListeners: Array<() => void> = [];
    const addWindowListener = vi.fn((event: string, callback: () => void) => {
      if (event === "load") loadListeners.push(callback);
    });
    const addSwListener = vi.fn((event: string, callback: () => void) => {
      if (event === "controllerchange") controllerChangeListeners.push(callback);
    });
    const setIntervalRef = vi.fn();
    const postMessage = vi.fn();

    let state = "installing";
    const installingWorker = {
      get state() {
        return state;
      },
      addEventListener: vi.fn((event: string, callback: () => void) => {
        if (event === "statechange") stateChangeListeners.push(callback);
      }),
      postMessage,
    };

    const registration = {
      installing: installingWorker,
      addEventListener: vi.fn((event: string, callback: () => void) => {
        if (event === "updatefound") updateFoundListeners.push(callback);
      }),
      update: vi.fn().mockResolvedValue(undefined),
    };

    const register = vi.fn().mockResolvedValue(registration);
    const reload = vi.fn();

    registerServiceWorker({
      windowRef: {
        addEventListener: addWindowListener,
        location: { reload },
      } as unknown as Window,
      navigatorRef: {
        serviceWorker: {
          controller: {},
          addEventListener: addSwListener,
          register,
        },
      } as unknown as Navigator,
      setIntervalRef,
      updateIntervalMs: 5_000,
    });

    expect(loadListeners).toHaveLength(1);

    loadListeners[0]();
    await Promise.resolve();

    expect(register).toHaveBeenCalledWith("/sw.js");
    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(setIntervalRef).toHaveBeenCalledWith(expect.any(Function), 5_000);

    expect(updateFoundListeners).toHaveLength(1);
    updateFoundListeners[0]();
    expect(stateChangeListeners).toHaveLength(1);

    state = "installed";
    stateChangeListeners[0]();

    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    expect(controllerChangeListeners).toHaveLength(1);
    controllerChangeListeners[0]();
    controllerChangeListeners[0]();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does nothing when service workers are unsupported", () => {
    const addWindowListener = vi.fn();

    registerServiceWorker({
      windowRef: {
        addEventListener: addWindowListener,
      } as unknown as Window,
      navigatorRef: {} as Navigator,
    });

    expect(addWindowListener).not.toHaveBeenCalled();
  });
});
