import type EventEmitter from "eventemitter3";
import type { EventHandler, EventOptions, EventContext } from "./types";

/**
 * Register event
 */
export function onEvent(
  emitter: EventEmitter,
  eventName: string,
  handler: EventHandler,
  options?: EventOptions,
): EventContext {
  return options?.once
    ? emitter.once(eventName, handler)
    : emitter.on(eventName, handler);
}

/**
 * Unregister event
 */
export function offEvent(
  emitter: EventEmitter,
  eventName: string,
  handler: EventHandler,
  options?: EventOptions,
): void {
  emitter.removeListener(
    eventName,
    handler,
    options?.context ?? null,
    options?.once,
  );
}
