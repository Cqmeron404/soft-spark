import type { DomainEvent, EventName } from "@soft-spark/shared";

export class EventLog {
  events: DomainEvent[] = [];

  emit(type: EventName, payload: Record<string, unknown>): DomainEvent {
    const event: DomainEvent = { type, payload, at: new Date().toISOString() };
    this.events.push(event);
    return event;
  }

  clear(): void {
    this.events = [];
  }

  types(): EventName[] {
    return this.events.map((e) => e.type);
  }
}

export const eventLog = new EventLog();
