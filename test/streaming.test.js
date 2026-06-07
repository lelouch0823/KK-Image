import { describe, it } from 'mocha';
import assert from 'assert';
import { SSEParser } from '../src/utils/streaming.js';

describe('SSEParser (流式解析器测试)', () => {
  it('应当能解析基础消息事件', () => {
    const parser = new SSEParser();
    const events = parser.feed('event: message\ndata: "hello"\n\n');

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].type, 'message');
    assert.strictEqual(events[0].data, 'hello');
  });

  it('应当能解析 JSON 格式的数据', () => {
    const parser = new SSEParser();
    const events = parser.feed('event: update\ndata: {"status":"ok"}\n\n');

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].type, 'update');
    assert.deepStrictEqual(events[0].data, { status: 'ok' });
  });

  it('应当能处理单次推送中包含多个事件的情况 (粘包处理)', () => {
    const parser = new SSEParser();
    const chunk = 'event: a\ndata: 1\n\nevent: b\ndata: 2\n\n';
    const events = parser.feed(chunk);

    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].type, 'a');
    assert.strictEqual(events[0].data, 1);
    assert.strictEqual(events[1].type, 'b');
    assert.strictEqual(events[1].data, 2);
  });

  it('应当能处理被切割的碎片化事件 (断包处理)', () => {
    const parser = new SSEParser();

    // 第一部分：事件未完成，缓冲区应当保留内容
    const events1 = parser.feed('event: split\ndata: {"pa');
    assert.strictEqual(events1.length, 0);

    // 第二部分：推送剩余内容，补全事件
    const events2 = parser.feed('rt":1}\n\n');
    assert.strictEqual(events2.length, 1);
    assert.strictEqual(events2[0].type, 'split');
    assert.deepStrictEqual(events2[0].data, { part: 1 });
  });

  it('应当忽略 SSE 协议中的注释 (如 keep-alive)', () => {
    const parser = new SSEParser();
    const events = parser.feed(': keep-alive\n\n');
    assert.strictEqual(events.length, 0);
  });
});
