/**
 * Minimal typed event emitter — a tiny stand-in for `eventemitter3` so the
 * package ships with zero runtime dependencies. Events map an event name to
 * its listener argument tuple.
 */
export class TinyEmitter<Events extends Record<string, unknown[]>> {
  private listeners: {
    [K in keyof Events]?: Set<(...args: Events[K]) => void>
  } = {}

  on<K extends keyof Events>(event: K, fn: (...args: Events[K]) => void): this {
    ;(this.listeners[event] ??= new Set()).add(fn)
    return this
  }

  off<K extends keyof Events>(event: K, fn: (...args: Events[K]) => void): this {
    this.listeners[event]?.delete(fn)
    return this
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): this {
    this.listeners[event]?.forEach((fn) => fn(...args))
    return this
  }
}
