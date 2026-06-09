import { SSEParser as RuntimeSSEParser } from './streaming.js';

export interface SSEEvent {
  type: string;
  data: any;
}

export const SSEParser: {
  new (): {
    buffer: string;
    feed(chunk: string): SSEEvent[];
    parseEvent(text: string): SSEEvent | null;
    reset(): void;
  };
} = RuntimeSSEParser;
