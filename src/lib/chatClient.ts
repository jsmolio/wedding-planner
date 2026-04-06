const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? '/api/agent';

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onStatus: (status: string) => void;
  onConfirm: (confirmMessage: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamChat(
  message: string,
  threadId: string,
  accessToken: string | null,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { onToken, onStatus, onConfirm, onDone, onError } = callbacks;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${AGENT_URL}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, thread_id: threadId, stream: true }),
    });

    if (!res.ok) {
      throw new Error(`Server error (${res.status})`);
    }
    if (!res.body) {
      throw new Error('No response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop()!;

      for (const part of parts) {
        const match = part.match(/^data:\s*(.+)$/m);
        if (!match) continue;

        try {
          const payload = JSON.parse(match[1]);
          if (payload.type === 'token') {
            onToken(payload.content);
          } else if (payload.type === 'status') {
            onStatus(payload.content);
          } else if (payload.type === 'confirm') {
            onConfirm(payload.confirm_message);
          }
          // 'done' type is handled by stream ending
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    onDone();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('fetch')) {
      onError(new Error('Could not reach the AI assistant. Make sure the agent server is running on port 8000.'));
    } else {
      onError(error);
    }
  }
}

export async function sendConfirmation(
  threadId: string,
  accessToken: string | null,
  decision: 'approve' | 'reject',
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${AGENT_URL}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ confirm: decision, thread_id: threadId }),
  });

  if (!res.ok) {
    throw new Error(`Server error (${res.status})`);
  }

  const data = await res.json();
  return data.reply ?? '';
}
