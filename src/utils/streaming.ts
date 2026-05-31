/**
 * 健壮的服务端推送事件 (SSE) 解析器
 * ======================================
 *
 * 实现了用于处理 SSE 流的 SOTA 解析器。
 * 支持处理碎片化数据包、多事件并行包以及缓冲区管理。
 */

export class SSEParser {
    /** 内部缓冲区，用于存储尚未构成完整事件的片段 */
    buffer: string;

    constructor() {
        this.buffer = '';
    }

    /**
     * 将新接收到的文本块推入解析器。
     * @param chunk - 从流中接收到的文本块。
     * @returns 解析出的完整事件数组。
     */
    feed(chunk: string): Array<{ type: string; data: any }> {
        this.buffer += chunk;
        const events: Array<{ type: string; data: any }> = [];

        // SSE 事件由双换行符 (\n\n) 分隔
        let eventEndIndex: number;
        while ((eventEndIndex = this.buffer.indexOf('\n\n')) !== -1) {
            // 提取完整的事件文本（包括双换行符之前的内容）
            const eventText = this.buffer.slice(0, eventEndIndex);

            // 将缓冲区指针移过当前事件
            this.buffer = this.buffer.slice(eventEndIndex + 2);

            // 忽略空事件（通常是心跳包）
            if (!eventText.trim()) continue;

            const parsedEvent = this.parseEvent(eventText);
            if (parsedEvent) {
                events.push(parsedEvent);
            }
        }

        return events;
    }

    /**
     * 解析单个事件数据块。
     * @param text - 原始事件文本块。
     * @returns 解析后的事件对象，如果格式不正确则返回 null。
     */
    parseEvent(text: string): { type: string; data: any } | null {
        let type = 'message'; // 默认事件类型
        let data = '';

        const lines = text.split(/\r?\n/);
        for (const line of lines) {
            if (line.startsWith('event:')) {
                type = line.slice(6).trim();
                if (type.startsWith(' ')) type = type.slice(1);
            } else if (line.startsWith('data:')) {
                let value = line.slice(5);
                if (value.startsWith(' ')) value = value.slice(1);
                // 如果存在多个 data 行，按标准应当换行合并
                data += (data ? '\n' : '') + value;
            } else if (line.startsWith('id:')) {
                // 如果需要支持事件 ID 恢复，可以在此处处理
            } else if (line.startsWith('retry:')) {
                // 如果需要支持自定义重试间隔，可以在此处处理
            }
        }

        if (!data) return null;

        try {
            // 在 AI 聊天上下文中，data 通常是 JSON 格式
            // 我们尝试解析 JSON，如果失败则按原始字符串返回
            const parsedData = JSON.parse(data);
            return { type, data: parsedData };
        } catch (_e) {
            // 非 JSON 格式，按纯文本处理
            return { type, data };
        }
    }

    /**
     * 重置解析器状态（清空缓冲区）。
     */
    reset(): void {
        this.buffer = '';
    }
}
