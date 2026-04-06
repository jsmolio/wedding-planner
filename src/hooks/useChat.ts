import { useState, useCallback, useRef } from 'react';
import { streamChat, sendConfirmation } from '../lib/chatClient';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'done' | 'streaming' | 'error';
}

export function useChat(accessToken: string | null, onWriteComplete?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  const threadIdRef = useRef(crypto.randomUUID());
  const streamBufferRef = useRef('');
  const rafRef = useRef<number>();
  const assistantIdRef = useRef<string>('');

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || pendingConfirm) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      status: 'done',
    };
    const assistantId = crypto.randomUUID();
    assistantIdRef.current = assistantId;
    streamBufferRef.current = '';

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', status: 'streaming' },
    ]);
    setIsStreaming(true);
    setStatusText('Thinking');

    streamChat(trimmed, threadIdRef.current, accessToken, {
      onToken(token) {
        setStatusText(null);
        streamBufferRef.current += token;
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            const content = streamBufferRef.current;
            const id = assistantIdRef.current;
            setMessages(prev =>
              prev.map(m => (m.id === id ? { ...m, content } : m)),
            );
            rafRef.current = undefined;
          });
        }
      },
      onStatus(status) {
        setStatusText(status);
      },
      onConfirm(msg) {
        // Flush any remaining buffer
        const content = streamBufferRef.current;
        const id = assistantIdRef.current;
        setMessages(prev =>
          prev.map(m => (m.id === id ? { ...m, content, status: 'done' } : m)),
        );
        setPendingConfirm(msg);
      },
      onDone() {
        const content = streamBufferRef.current;
        const id = assistantIdRef.current;
        setMessages(prev =>
          prev.map(m => (m.id === id ? { ...m, content, status: 'done' } : m)),
        );
        setIsStreaming(false);
        setStatusText(null);
      },
      onError(err) {
        setError(err.message);
        const id = assistantIdRef.current;
        setMessages(prev => prev.filter(m => m.id !== id));
        setIsStreaming(false);
        setStatusText(null);
      },
    });
  }, [isStreaming, pendingConfirm]);

  const handleConfirm = useCallback(async (decision: 'approve' | 'reject') => {
    setPendingConfirm(null);
    setIsStreaming(true);

    try {
      const reply = await sendConfirmation(threadIdRef.current, accessToken, decision);
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply, status: 'done' },
      ]);
      if (decision === 'approve') onWriteComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const addAssistantMessage = useCallback((text: string) => {
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', content: text, status: 'done' },
    ]);
  }, []);

  return { messages, isStreaming, pendingConfirm, error, statusText, send, handleConfirm, clearError, addAssistantMessage };
}
