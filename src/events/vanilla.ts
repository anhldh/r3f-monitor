import EventEmitter from "eventemitter3";
import type { EventHandler, EventOptions, EventContext } from "./types";

// EventEmitter global
const eventEmitter = new EventEmitter();

/**
 * Register event
 */
export function onEvent(
  eventName: string,
  handler: EventHandler,
  options?: EventOptions,
): EventContext {
  return options?.once
    ? eventEmitter.once(eventName, handler)
    : eventEmitter.on(eventName, handler);
}

/**
 * Unregister event
 */
export function offEvent(
  eventName: string,
  handler: EventHandler,
  options?: EventOptions,
): void {
  eventEmitter.removeListener(
    eventName,
    handler,
    options?.context ?? null,
    options?.once,
  );
}

/**
 * Emit event
 */
export function emitEvent(eventName: string, payload?: any): void {
  eventEmitter.emit(eventName, payload);
}
