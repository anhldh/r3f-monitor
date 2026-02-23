import type EventEmitter from "eventemitter3";

/**
 * Callback
 */
export type EventHandler = (...args: any[]) => any;

/**
 * EventEmitter context
 */
export type EventContext = EventEmitter;

/**
 * Options
 */
export interface EventOptions {
  once?: boolean;

  /** EventEmitter*/
  context?: EventContext;
}
