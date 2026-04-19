/**
 * Base reactive store — a thin EventTarget with typed emit/on helpers.
 * Subclasses call this.emit('event', detail); UI listens with store.on(...).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Store<Events extends Record<string, any>> extends EventTarget {
  on<K extends keyof Events & string>(event: K, handler: (detail: Events[K]) => void): () => void {
    const listener = (e: Event) => handler((e as CustomEvent<Events[K]>).detail);
    this.addEventListener(event, listener);
    return () => this.removeEventListener(event, listener);
  }

  protected emit<K extends keyof Events & string>(event: K, detail: Events[K]): void {
    this.dispatchEvent(new CustomEvent(event, { detail }));
  }
}
