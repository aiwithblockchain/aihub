// src/utils/sse-parser.ts

/**
 * A utility class for parsing Server-Sent Events (SSE) streams.
 * It handles the low-level details of reading from a ReadableStream,
 * decoding chunks, and parsing SSE message events.
 */
export class SseParser {
    /**
     * Parses an SSE stream from a fetch response.
     *
     * @param response The fetch Response object.
     * @param onMessage A callback function that will be invoked for each SSE message event.
     * @returns A promise that resolves when the stream is fully consumed.
     */
    async parse(
        response: Response,
        onMessage: (data: any) => void
    ): Promise<void> {
        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (buffer.length > 0) {
                    this.processBuffer(buffer, onMessage);
                }
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lastNewline = buffer.lastIndexOf('\n');
            if (lastNewline !== -1) {
                const processable = buffer.substring(0, lastNewline);
                this.processBuffer(processable, onMessage);
                buffer = buffer.substring(lastNewline + 1);
            }
        }
    }

    private processBuffer(buffer: string, onMessage: (data: any) => void) {
        const lines = buffer.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.substring(6);
                if (dataStr === '[DONE]') {
                    return; // End of stream
                }
                try {
                    const data = JSON.parse(dataStr);
                    onMessage(data);
                } catch (e) {
                    // Ignore parsing errors for non-JSON data
                }
            }
        }
    }
}
