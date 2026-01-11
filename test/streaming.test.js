
import { describe, it } from 'mocha';
import assert from 'assert';
import { SSEParser } from '../src/utils/streaming.js';

describe('SSEParser', () => {
    it('should parse a simple event', () => {
        const parser = new SSEParser();
        const events = parser.feed('event: message\ndata: "hello"\n\n');

        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'message');
        assert.strictEqual(events[0].data, 'hello');
    });

    it('should parse JSON data', () => {
        const parser = new SSEParser();
        const events = parser.feed('event: update\ndata: {"status":"ok"}\n\n');

        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'update');
        assert.deepStrictEqual(events[0].data, { status: 'ok' });
    });

    it('should handle multiple events in one chunk', () => {
        const parser = new SSEParser();
        const chunk = 'event: a\ndata: 1\n\nevent: b\ndata: 2\n\n';
        const events = parser.feed(chunk);

        assert.strictEqual(events.length, 2);
        assert.strictEqual(events[0].type, 'a');
        assert.strictEqual(events[0].data, 1);
        assert.strictEqual(events[1].type, 'b');
        assert.strictEqual(events[1].data, 2);
    });

    it('should handle partial chunks (split events)', () => {
        const parser = new SSEParser();

        // First part
        const events1 = parser.feed('event: split\ndata: {"pa');
        assert.strictEqual(events1.length, 0);

        // Second part
        const events2 = parser.feed('rt":1}\n\n');
        assert.strictEqual(events2.length, 1);
        assert.strictEqual(events2[0].type, 'split');
        assert.deepStrictEqual(events2[0].data, { part: 1 });
    });

    it('should ignore keep-alive comments', () => {
        const parser = new SSEParser();
        const events = parser.feed(': keep-alive\n\n');
        assert.strictEqual(events.length, 0);
    });
});
