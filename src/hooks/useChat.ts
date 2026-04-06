import { useState, useCallback, useRef, useEffect } from 'react';
import { streamChat, sendConfirmation, type FileAttachment } from '../lib/chatClient';
import {
  fetchConversations,
  createConversation,
  deleteConversation,
  updateConversationTitle,
  fetchMessages,
  saveMessage,
} from '../lib/queries/conversations';
import type { Conversation } from '../types/database';

export type { FileAttachment } from '../lib/chatClient';

export interface ToolStep {
  label: string;
  timestamp: number;
}

export interface FormRequest {
  action: 'create' | 'update';
  table: string;
  prefill?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'done' | 'streaming' | 'error';
  attachments?: FileAttachment[];
  toolSteps?: ToolStep[];
  formRequest?: FormRequest;
}

function extractFormRequest(content: string): { cleaned: string; form?: FormRequest } {
  // Try fenced code block: ```form ... ```
  const fenced = content.match(/```form\s*\n?([\s\S]*?)\n?```/);
  if (fenced) {
    try {
      const form = JSON.parse(fenced[1].trim()) as FormRequest;
      if (form.action && form.table) {
        const cleaned = content.replace(/```form\s*\n?[\s\S]*?\n?```/, '').trim();
        return { cleaned, form };
      }
    } catch { /* fall through */ }
  }

  // Try raw JSON with action+table signature (agent might skip the fence)
  const raw = content.match(/\{[^{}]*"action"\s*:\s*"(?:create|update)"[^{}]*"table"\s*:\s*"[^"]*"[^{}]*\}/);
  if (raw) {
    try {
      const form = JSON.parse(raw[0]) as FormRequest;
      if (form.action && form.table) {
        const cleaned = content.replace(raw[0], '').trim();
        return { cleaned, form };
      }
    } catch { /* fall through */ }
  }

  return { cleaned: content };
}

export function useChat(
  accessToken: string | null,
  weddingId: string | null,
  onWriteComplete?: () => void,
) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const streamBufferRef = useRef('');
  const rafRef = useRef<number>();
  const assistantIdRef = useRef<string>('');
  const toolStepsRef = useRef<ToolStep[]>([]);

  // The thread_id for the agent is the conversation ID
  const threadId = activeConversationId ?? 'default';

  // Load conversations list
  const loadConversations = useCallback(async () => {
    if (!weddingId) return;
    setLoadingConversations(true);
    try {
      const convos = await fetchConversations(weddingId);
      setConversations(convos);
    } catch {
      // silently fail — conversations just won't load
    } finally {
      setLoadingConversations(false);
    }
  }, [weddingId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when switching conversations
  const selectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    setMessages([]);
    setError(null);
    setPendingConfirm(null);
    try {
      const msgs = await fetchMessages(id);
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          status: 'done' as const,
          toolSteps: m.tool_steps ?? undefined,
        })),
      );
    } catch {
      setError('Failed to load conversation');
    }
  }, []);

  // Create a new conversation
  const newConversation = useCallback(async () => {
    if (!weddingId) return;
    try {
      const convo = await createConversation(weddingId);
      setConversations((prev) => [convo, ...prev]);
      setActiveConversationId(convo.id);
      setMessages([]);
      setError(null);
      setPendingConfirm(null);
    } catch {
      setError('Failed to create conversation');
    }
  }, [weddingId]);

  // Delete a conversation
  const removeConversation = useCallback(async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch {
      setError('Failed to delete conversation');
    }
  }, [activeConversationId]);

  // Auto-create a conversation if none exists when sending
  const ensureConversation = useCallback(async (): Promise<string> => {
    if (activeConversationId) return activeConversationId;
    if (!weddingId) throw new Error('No wedding');
    const convo = await createConversation(weddingId);
    setConversations((prev) => [convo, ...prev]);
    setActiveConversationId(convo.id);
    return convo.id;
  }, [activeConversationId, weddingId]);

  const send = useCallback(async (text: string, attachments?: FileAttachment[]) => {
    const trimmed = text.trim();
    if ((!trimmed && !attachments?.length) || isStreaming || pendingConfirm) return;

    setError(null);

    let convoId: string;
    try {
      convoId = await ensureConversation();
    } catch {
      setError('Failed to start conversation');
      return;
    }

    const displayText = trimmed || `Attached ${attachments!.map((a) => a.name).join(', ')}`;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: displayText,
      status: 'done',
      attachments,
    };
    const assistantId = crypto.randomUUID();
    assistantIdRef.current = assistantId;
    streamBufferRef.current = '';
    toolStepsRef.current = [];

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', status: 'streaming' },
    ]);
    setIsStreaming(true);
    setStatusText('Thinking');

    // Persist user message
    saveMessage(convoId, 'user', displayText).catch(() => {});

    // Auto-title on first message
    if (trimmed && conversations.find((c) => c.id === convoId)?.title === 'New conversation') {
      const title = trimmed.length > 40 ? trimmed.slice(0, 40) + '...' : trimmed;
      updateConversationTitle(convoId, title).catch(() => {});
      setConversations((prev) =>
        prev.map((c) => (c.id === convoId ? { ...c, title } : c)),
      );
    }

    streamChat(trimmed || '', convoId, accessToken, {
      onToken(token) {
        setStatusText(null);
        streamBufferRef.current += token;
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            const content = streamBufferRef.current;
            const id = assistantIdRef.current;
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...m, content } : m)),
            );
            rafRef.current = undefined;
          });
        }
      },
      onStatus(status) {
        setStatusText(status);
        if (status && status !== 'Thinking') {
          const steps = toolStepsRef.current;
          if (!steps.length || steps[steps.length - 1].label !== status) {
            steps.push({ label: status, timestamp: Date.now() });
          }
        }
      },
      onConfirm(msg) {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = undefined; }
        const content = streamBufferRef.current;
        const id = assistantIdRef.current;
        const toolSteps = toolStepsRef.current.length ? [...toolStepsRef.current] : undefined;
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: content || 'Processing...', status: 'done', toolSteps } : m)),
        );
        setPendingConfirm(msg);
        setIsStreaming(false);
        setStatusText(null);
        if (content) saveMessage(convoId, 'assistant', content, toolSteps).catch(() => {});
      },
      onDone() {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = undefined; }
        const rawContent = streamBufferRef.current;
        const id = assistantIdRef.current;
        const toolSteps = toolStepsRef.current.length ? [...toolStepsRef.current] : undefined;
        const { cleaned, form } = extractFormRequest(rawContent);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: cleaned, status: 'done', toolSteps, formRequest: form } : m)),
        );
        setIsStreaming(false);
        setStatusText(null);
        if (rawContent) saveMessage(convoId, 'assistant', cleaned, toolSteps).catch(() => {});
      },
      onError(err) {
        setError(err.message);
        const id = assistantIdRef.current;
        setMessages((prev) => prev.filter((m) => m.id !== id));
        setIsStreaming(false);
        setStatusText(null);
      },
    }, attachments);
  }, [isStreaming, pendingConfirm, ensureConversation, accessToken, conversations]);

  const handleConfirm = useCallback(async (decision: 'approve' | 'reject') => {
    setPendingConfirm(null);
    setIsStreaming(true);

    try {
      const reply = await sendConfirmation(threadId, accessToken, decision);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply, status: 'done' },
      ]);
      if (decision === 'approve') onWriteComplete?.();
      if (activeConversationId && reply) {
        saveMessage(activeConversationId, 'assistant', reply).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
    }
  }, [threadId, accessToken, activeConversationId, onWriteComplete]);

  const clearError = useCallback(() => setError(null), []);

  const addAssistantMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', content: text, status: 'done' },
    ]);
    // Don't persist Clementine greetings — they're ephemeral UI messages
  }, []);

  return {
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    pendingConfirm,
    error,
    statusText,
    loadingConversations,
    send,
    handleConfirm,
    clearError,
    addAssistantMessage,
    selectConversation,
    newConversation,
    removeConversation,
  };
}
