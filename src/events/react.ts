import { useRef, useEffect } from "react";
import { onEvent, offEvent } from "./vanilla";
import { usePerfInstance } from "../store";
import type { EventHandler, EventOptions } from "./types";

/**
 * React hook for subscribing to a canvas's events (EventEmitter wrapper).
 * - Auto cleanup on unmount
 * - No stale closures
 */
export function useEvent(
  eventName: string,
  handler: EventHandler,
  deps: any[] = [],
  options?: EventOptions,
): void {
  const { events } = usePerfInstance();

  // Keep the latest handler to avoid stale closures
  const handlerRef = useRef<EventHandler>(handler);

  // Sync ref whenever handler changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    // Wrapper always calls the latest handler
    const handlerWrapper = (event: any) => handlerRef.current?.(event);

    // Subscribe
    const context = onEvent(events, eventName, handlerWrapper, options);

    // Cleanup on unmount or deps change
    return () =>
      offEvent(events, eventName, handlerWrapper, {
        ...options,
        context,
      });
  }, [events, eventName, options?.once, ...deps]);
}
