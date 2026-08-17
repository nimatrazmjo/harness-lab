import type { ScribeStreamEvent } from "@scribe/shared-types";
import { getToken } from "./client";

/**
 * Reads the SSE-over-POST generation stream via fetch + ReadableStream — not the
 * browser EventSource API, which is GET-only (see docs/ARCHITECTURE.md "Streaming").
 */
export async function streamScribeGeneration(
  encounterId: string,
  onEvent: (event: ScribeStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken();
  const response = await fetch(`/api/encounters/${encounterId}/scribe/generate`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Generation request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (line) {
        const event = JSON.parse(line.slice("data: ".length)) as ScribeStreamEvent;
        onEvent(event);
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}
