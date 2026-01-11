/**
 * Robust Server-Sent Events (SSE) Parser
 * ======================================
 *
 * Implements a SOTA parser for processing SSE streams.
 * Handles partial chunks, multi-event chunks, and buffer management.
 */

export class SSEParser {
    constructor() {
        this.buffer = '';
    }

    /**
     * Feed a new chunk of text into the parser.
     * @param {string} chunk - The text chunk received from the stream.
     * @returns {Array<{type: string, data: any}>} - An array of parsed events.
     */
    feed(chunk) {
        this.buffer += chunk;
        const events = [];

        // SSE events are separated by double newlines (\n\n)
        let eventEndIndex;
        while ((eventEndIndex = this.buffer.indexOf('\n\n')) !== -1) {
            // Extract the complete event text (including the double newline)
            const eventText = this.buffer.slice(0, eventEndIndex);

            // Advance buffer past this event
            this.buffer = this.buffer.slice(eventEndIndex + 2);

            if (!eventText.trim()) continue; // Skip empty events (keep-alive)

            const parsedEvent = this.parseEvent(eventText);
            if (parsedEvent) {
                events.push(parsedEvent);
            }
        }

        return events;
    }

    /**
     * Parse a single event block.
     * @param {string} text - The raw event text block.
     * @returns {Object|null} - The parsed event object or null if invalid.
     */
    parseEvent(text) {
        let type = 'message'; // Default event type
        let data = '';

        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('event: ')) {
                type = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
                data += (data ? '\n' : '') + line.slice(6);
            } else if (line.startsWith('id: ')) {
                // ID handling can be added here if needed
            } else if (line.startsWith('retry: ')) {
                // Retry logic can be added here
            }
        }

        if (!data) return null;

        try {
            // Try to parse data as JSON, but keep as string if it fails or isn't JSON
            // Note: In our AI stream context, data is usually JSON.
            // However, standard SSE data is just text. We'll try JSON parsing for convenience.
            const parsedData = JSON.parse(data);
            return { type, data: parsedData };
        } catch (_e) {
            // If not JSON, return as string
            return { type, data };
        }
    }

    /**
     * Reset the parser state.
     */
    reset() {
        this.buffer = '';
    }
}
