import { describe, it, expect } from 'vitest';
import { SSEParser } from '../streaming';

describe('SSEParser', () => {
  it('should parse simple SSE events', () => {
    const parser = new SSEParser();
    const chunk = 'data: {"text": "hello"}\n\n';
    const events = parser.feed(chunk);
    
    expect(events.length).toBe(1);
    expect(events[0].data).toEqual({ text: 'hello' });
    expect(events[0].type).toBe('message');
  });

  it('should handle fragmented chunks', () => {
    const parser = new SSEParser();
    expect(parser.feed('data: {"te')).toEqual([]);
    const events = parser.feed('xt": "hi"}\n\n');
    
    expect(events.length).toBe(1);
    expect(events[0].data.text).toBe('hi');
  });

  it('should handle multiple events in one chunk', () => {
    const parser = new SSEParser();
    const chunk = 'event: update\ndata: 1\n\nevent: update\ndata: 2\n\n';
    const events = parser.feed(chunk);
    
    expect(events.length).toBe(2);
    expect(events[0].type).toBe('update');
    // JSON 数据被解析为对象
    expect(events[0].data).toBe(1);
    expect(events[1].data).toBe(2);
  });

  it('should parse non-JSON data as string', () => {
    const parser = new SSEParser();
    const events = parser.feed('data: raw text here\n\n');
    // 非 JSON 数据包装在 { raw: ... } 中
    expect(events[0].data).toEqual({ raw: 'raw text here' });
  });

  it('should ignore empty events', () => {
    const parser = new SSEParser();
    const events = parser.feed('\n\n');
    expect(events.length).toBe(0);
  });

  it('should handle id and retry fields', () => {
    const parser = new SSEParser();
    const chunk = 'id: 123\nretry: 5000\ndata: hi\n\n';
    const events = parser.feed(chunk);
    // 非 JSON 数据包装在 { raw: ... } 中
    expect(events[0].data).toEqual({ raw: 'hi' });
  });

  it('should reset buffer', () => {
    const parser = new SSEParser();
    parser.feed('data: fragment');
    expect(parser.buffer).toBe('data: fragment');
    parser.reset();
    expect(parser.buffer).toBe('');
  });
});
