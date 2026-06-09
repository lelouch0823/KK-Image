export class SSEParser {
  constructor() {
    this.buffer = '';
  }

  feed(chunk) {
    this.buffer += chunk;
    const events = [];

    let eventEndIndex;
    while ((eventEndIndex = this.buffer.indexOf('\n\n')) !== -1) {
      const eventText = this.buffer.slice(0, eventEndIndex);
      this.buffer = this.buffer.slice(eventEndIndex + 2);

      if (!eventText.trim()) continue;

      const parsedEvent = this.parseEvent(eventText);
      if (parsedEvent) {
        events.push(parsedEvent);
      }
    }

    return events;
  }

  parseEvent(text) {
    let type = 'message';
    let data = '';

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('event:')) {
        type = line.slice(6).trim();
        if (type.startsWith(' ')) type = type.slice(1);
      } else if (line.startsWith('data:')) {
        let value = line.slice(5);
        if (value.startsWith(' ')) value = value.slice(1);
        data += (data ? '\n' : '') + value;
      }
    }

    if (!data) return null;

    try {
      return { type, data: JSON.parse(data) };
    } catch (_error) {
      return { type, data: { raw: data } };
    }
  }

  reset() {
    this.buffer = '';
  }
}
