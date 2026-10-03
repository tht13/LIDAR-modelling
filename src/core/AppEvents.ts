export type EventCallback = (...args: any[]) => void;

export class EventBus {
  private listeners: Map<string, EventCallback[]> = new Map();

  public on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public emit(event: string, ...args: any[]) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(cb => cb(...args));
    }
  }
}

export const AppEvents = new EventBus();
