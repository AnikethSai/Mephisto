import { EventEmitter } from 'events';

// Global singleton event emitter for server-sent events
declare global {
  // eslint-disable-next-line no-var
  var __eventBus: EventEmitter | undefined;
}

export const eventBus: EventEmitter = global.__eventBus || new EventEmitter();
if (process.env.NODE_ENV !== 'production') {
  global.__eventBus = eventBus;
}

// Increase max listeners for concurrent participant/organizer connections
eventBus.setMaxListeners(200);

export type RealtimeEventType = 
  | 'BALANCE_UPDATE' 
  | 'TRANSACTION_NEW' 
  | 'TRANSACTION_UPDATED' 
  | 'ORGANIZER_SYNC';

export interface RealtimeEvent {
  type: RealtimeEventType;
  teamId?: number;
  timestamp: string;
}

export function broadcastEvent(event: Omit<RealtimeEvent, 'timestamp'>) {
  const payload: RealtimeEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  eventBus.emit('change', payload);
  if (event.teamId) {
    eventBus.emit(`team:${event.teamId}`, payload);
  }
}
