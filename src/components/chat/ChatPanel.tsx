import { useState, useEffect, useRef, useCallback, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { X, Send, Sparkles, Check, XCircle, AlertCircle } from 'lucide-react';
import { marked } from 'marked';
import { Lightbox } from '../ui/Lightbox';
import type { ChatMessage } from '../../hooks/useChat';

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(text: string): string {
  let html = marked.parse(text) as string;

  // When multiple images are inside a single <p> (separated by <br>),
  // extract them into a scrollable gallery container
  html = html.replace(
    /<p>\s*(<img [^>]+>[\s<br>\/]*){2,}<\/p>/gi,
    (match) => {
      const imgs = match.match(/<img [^>]+>/g) || [];
      const seen = new Set<string>();
      const unique = imgs.filter(img => {
        const src = img.match(/src="([^"]+)"/)?.[1] ?? '';
        if (seen.has(src)) return false;
        seen.add(src);
        return true;
      });
      return `<div class="chat-gallery">${unique.join('')}</div>`;
    },
  );

  // Inject "Add" buttons after venue headings (h3)
  html = html.replace(/<h3>([^<]+)<\/h3>/g, (_match, name) => {
    const escaped = name.replace(/"/g, '&quot;');
    return `<div class="chat-venue-header"><h3>${name}</h3>`
      + `<button class="chat-add-venue-btn" data-venue-name="${escaped}">+ Save</button></div>`;
  });

  return html;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 420;

const suggestions = [
  "How many guests have RSVP'd?",
  "What's my budget status?",
  "What tasks are coming up?",
  "Any tips for choosing a venue?",
];

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (w: number) => void;
  messages: ChatMessage[];
  isStreaming: boolean;
  pendingConfirm: string | null;
  error: string | null;
  statusText: string | null;
  send: (text: string) => void;
  handleConfirm: (decision: 'approve' | 'reject') => void;
  clearError: () => void;
}

export function ChatPanel({
  open,
  onClose,
  width,
  onWidthChange,
  messages,
  isStreaming,
  pendingConfirm,
  error,
  statusText,
  send,
  handleConfirm,
  clearError,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isDragging = useRef(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  // Handle clicks on images (lightbox) and "Add" buttons inside rendered markdown
  const handleContentClick = useCallback((e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;

    // Handle "Save" venue button
    if (target.classList.contains('chat-add-venue-btn')) {
      const venueName = target.getAttribute('data-venue-name');
      if (venueName) {
        send(`Add ${venueName} to my saved venues`);
      }
      return;
    }

    // Handle image click → lightbox
    if (target.tagName !== 'IMG') return;
    const src = (target as HTMLImageElement).src;
    const container = target.closest('.chat-gallery') || target.closest('.chat-prose');
    if (!container) return;
    const allImgs = Array.from(container.querySelectorAll('img'))
      .map(img => img.src)
      .filter((v, i, a) => a.indexOf(v) === i);
    const index = allImgs.indexOf(src);
    setLightbox({ images: allImgs, index: Math.max(0, index) });
  }, [send]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      onWidthChange(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width]);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingConfirm, error]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // Escape key closes panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSubmit = () => {
    const val = inputRef.current?.value.trim();
    if (!val) return;
    send(val);
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <>
      {/* Backdrop (mobile) */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full bg-white shadow-2xl
          flex flex-col transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ maxWidth: '100vw', width: `${width}px` }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={onDragStart}
          className="hidden sm:block absolute inset-y-0 left-0 w-1.5 cursor-col-resize
            hover:bg-primary-300 active:bg-primary-400 transition-colors z-10"
        />
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5" />
            <div>
              <h2 className="font-semibold text-base leading-tight">Wedding Assistant</h2>
              <p className="text-xs text-primary-100">Powered by AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} onClick={handleContentClick} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Welcome / suggestions */}
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-primary-500" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Hi! I'm your wedding assistant</h3>
              <p className="text-sm text-gray-500 mb-6">
                I can help you manage guests, track your budget, plan seating, and more.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-primary-200 text-primary-700
                      hover:bg-primary-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map(msg => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary-500 text-white px-4 py-2.5 text-sm whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              );
            }

            // Assistant message
            if (!msg.content && msg.status === 'streaming') {
              // Status indicator
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="chat-typing-dot" />
                        <span className="chat-typing-dot" />
                        <span className="chat-typing-dot" />
                      </div>
                      {statusText && (
                        <span className="text-xs text-gray-500 italic">{statusText}...</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            if (!msg.content) return null;

            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 text-gray-800 px-4 py-2.5 text-sm">
                  <div
                    className="chat-prose"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                  {msg.status === 'streaming' && (
                    <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-middle rounded-sm" />
                  )}
                </div>
              </div>
            );
          })}

          {/* Confirmation banner */}
          {pendingConfirm && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div
                className="chat-prose text-amber-800 mb-3"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(pendingConfirm) }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleConfirm('approve')}
                  disabled={isStreaming}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
                    bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50 transition-colors"
                >
                  <Check className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => handleConfirm('reject')}
                  disabled={isStreaming}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
                    bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <button onClick={clearError} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 px-4 py-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              onKeyDown={handleKeyDown}
              onInput={handleTextareaInput}
              placeholder={pendingConfirm ? 'Approve or reject the action above...' : 'Ask about your wedding...'}
              disabled={!!pendingConfirm}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                disabled:bg-gray-50 disabled:text-gray-400"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSubmit}
              disabled={isStreaming || !!pendingConfirm}
              className="shrink-0 w-10 h-10 rounded-xl bg-primary-500 text-white
                hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors flex items-center justify-center"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Image lightbox */}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox({ ...lightbox, index: i })}
        />
      )}
    </>
  );
}
