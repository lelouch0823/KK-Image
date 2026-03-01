import { describe, it, expect } from 'vitest';
import { ContentGate, extractToolCallsFromText } from '../ai-stream-helpers.js';

describe('ContentGate', () => {
  it('does not block normal text with tool name mention only', () => {
    const gate = new ContentGate();
    const out1 = gate.push('你可以使用 searchVariants 关键词');
    const out2 = gate.push(' 来帮助筛选商品。');
    const out3 = gate.flush();
    const combined = `${out1.safeText}${out2.safeText}${out3}`;
    expect(combined).toContain('searchVariants');
    expect(combined).toContain('筛选商品');
  });

  it('blocks xml-style tool payload and keeps clean text', () => {
    const gate = new ContentGate();
    const a = gate.push('我来查询。\n');
    const b = gate.push('<arg_key>limit</arg_key><arg_value>50</arg_value>');
    const c = gate.flush();
    const combined = `${a.safeText}${b.safeText}${c}`;
    expect(combined).toContain('我来查询');
    expect(b.safeText).toContain('我来查询');
    expect(combined).not.toContain('arg_key');
  });

  it('can recover after blocked segment when safe sentence appears', () => {
    const gate = new ContentGate();
    gate.push('<arg_key>limit</arg_key><arg_value>50</arg_value>。 ');
    const resumed = gate.push('已为你整理好结果。');
    expect(resumed.safeText).toContain('已为你整理好结果');
    const stats = gate.getStats();
    expect(stats.blockedEvents).toBeGreaterThan(0);
    expect(stats.recoveredEvents).toBeGreaterThan(0);
  });
});

describe('extractToolCallsFromText', () => {
  it('extracts xml leaked args into a tool call', () => {
    const input = '准备查询 searchVariants <arg_key>limit</arg_key><arg_value>10</arg_value>';
    const parsed = extractToolCallsFromText(input);
    expect(parsed.toolCalls.length).toBe(1);
    expect(parsed.toolCalls[0].name).toBe('searchVariants');
    expect(parsed.cleanText).not.toContain('arg_key');
  });
});
