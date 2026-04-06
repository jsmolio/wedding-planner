import { useState, useEffect, useRef, useCallback, useMemo, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { X, Send, Check, XCircle, AlertCircle, Paperclip, FileText, Image, ChevronDown, Plus, Trash2, MessageSquare } from 'lucide-react';
import { ClementineLogo } from '../ui/Logo';
import { marked } from 'marked';
import { Lightbox } from '../ui/Lightbox';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWedding } from '../../contexts/WeddingContext';
import { fetchVenues, createVenue } from '../../lib/queries/venues';
import { queryKeys } from '../../lib/queryKeys';
import { ChatForm } from './ChatForm';
import type { ChatMessage, FileAttachment } from '../../hooks/useChat';
import type { Conversation } from '../../types/database';

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(text: string, savedVenueNames?: Set<string>): string {
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

  // Inject "Save" buttons after venue headings (h3), skip if already saved
  html = html.replace(/<h3>([^<]+)<\/h3>/g, (_match, name) => {
    const isSaved = savedVenueNames?.has(name.trim().toLowerCase());
    const escaped = name.replace(/"/g, '&quot;');
    const btn = isSaved
      ? `<span class="chat-venue-saved">Saved</span>`
      : `<button class="chat-add-venue-btn" data-venue-name="${escaped}">+ Save</button>`;
    return `<div class="chat-venue-header"><h3>${name}</h3>${btn}</div>`;
  });

  return html;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 1200;

const suggestions = [
  "Show me rustic wedding venues in Colorado",
  "How many guests have RSVP'd?",
  "What's my budget status?",
  "What tasks are coming up?",
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
  send: (text: string, attachments?: FileAttachment[]) => void;
  handleConfirm: (decision: 'approve' | 'reject') => void;
  clearError: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
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
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isDragging = useRef(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const { weddingId } = useWedding();
  const queryClient = useQueryClient();
  const { data: venues = [] } = useQuery({
    queryKey: queryKeys.venues(weddingId!),
    queryFn: () => fetchVenues(weddingId!),
    enabled: !!weddingId,
  });
  const savedVenueNames = useMemo(() => new Set(venues.map(v => v.name.trim().toLowerCase())), [venues]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    const newFiles: FileAttachment[] = [];
    for (const file of Array.from(selected)) {
      if (file.type.startsWith('image/')) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newFiles.push({ name: file.name, type: 'image', content: dataUrl });
      } else {
        const text = await file.slice(0, 50000).text();
        newFiles.push({ name: file.name, type: 'text', content: text });
      }
    }
    setFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handle clicks on images (lightbox) and "Add" buttons inside rendered markdown
  const handleContentClick = useCallback((e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;

    // Handle "Save" venue button — save directly to Supabase
    if (target.classList.contains('chat-add-venue-btn') && weddingId) {
      const venueName = target.getAttribute('data-venue-name');
      if (!venueName) return;

      // Find the venue's section in the DOM (everything between this h3 and the next h3)
      const header = target.closest('.chat-venue-header');
      if (!header) return;

      // Collect text content and images from sibling elements until the next venue header
      let el = header.nextElementSibling;
      const lines: string[] = [];
      const photos: string[] = [];
      while (el && !el.classList?.contains('chat-venue-header')) {
        // Collect images from galleries
        if (el.classList?.contains('chat-gallery')) {
          el.querySelectorAll('img').forEach(img => {
            if (img.src && !photos.includes(img.src)) photos.push(img.src);
          });
        }
        // Collect text lines
        const text = el.textContent?.trim();
        if (text) lines.push(text);
        el = el.nextElementSibling;
      }

      // Parse structured data from the text lines
      const getText = (prefix: string) => {
        const line = lines.find(l => l.startsWith(prefix));
        return line ? line.slice(prefix.length).trim() : '';
      };
      const parseCost = (s: string) => {
        const m = s.replace(/[$,]/g, '').match(/\d+/);
        return m ? parseFloat(m[0]) : null;
      };
      const parseCapacity = (s: string) => {
        const m = s.match(/\d+/);
        return m ? parseInt(m[0]) : null;
      };

      // Extract a link URL if present
      const linkEl = header.parentElement?.querySelector('a[href^="http"]') as HTMLAnchorElement | null;

      const venue = {
        wedding_id: weddingId,
        name: venueName,
        address: getText('Location:'),
        capacity: parseCapacity(getText('Capacity:')),
        cost: parseCost(getText('Price:')),
        website_url: linkEl?.href ?? getText('Website:'),
        notes: getText('Why it fits:'),
        photo_urls: photos,
      };

      // Disable button immediately
      (target as HTMLButtonElement).disabled = true;
      (target as HTMLButtonElement).textContent = 'Saving...';

      createVenue(venue)
        .then(() => {
          (target as HTMLButtonElement).textContent = 'Saved';
          target.classList.remove('chat-add-venue-btn');
          target.classList.add('chat-venue-saved');
          queryClient.invalidateQueries({ queryKey: queryKeys.venues(weddingId) });
        })
        .catch(() => {
          (target as HTMLButtonElement).disabled = false;
          (target as HTMLButtonElement).textContent = '+ Save';
        });
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
  }, [width, onWidthChange]);

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
    const val = inputRef.current?.value.trim() ?? '';
    if (!val && !files.length) return;
    send(val, files.length ? files : undefined);
    setFiles([]);
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
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-primary-500 to-accent-500 text-white shrink-0">
          <div className="flex items-center gap-3">
            <ClementineLogo className="w-7 h-7" />
            <div>
              <h2 className="font-semibold text-base leading-tight">Clementine</h2>
              <p className="text-xs text-primary-100">Your wedding planning assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowConversations(v => !v)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              aria-label="Conversations"
              title="Conversations"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button
              onClick={onNewConversation}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              aria-label="New conversation"
              title="New conversation"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conversation list */}
        {showConversations && (
          <div className="border-b border-gray-200 bg-white max-h-[240px] overflow-y-auto shrink-0">
            {conversations.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No conversations yet</p>
            ) : (
              conversations.map(convo => (
                <div
                  key={convo.id}
                  className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors text-sm
                    ${convo.id === activeConversationId ? 'bg-accent-50 text-accent-700' : 'hover:bg-gray-50 text-gray-700'}`}
                  onClick={() => { onSelectConversation(convo.id); setShowConversations(false); }}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span className="flex-1 truncate">{convo.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteConversation(convo.id); }}
                    className="p-1 rounded hover:bg-red-50 hover:text-red-500 text-gray-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} onClick={handleContentClick} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Welcome / suggestions */}
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-accent-100 text-accent-500 flex items-center justify-center mx-auto mb-3">
                <ClementineLogo className="w-9 h-9" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Hey there! I'm Clementine</h3>
              <p className="text-sm text-gray-500 mb-6">
                I'm here to help make your wedding planning a breeze — from finding venues to managing guests, budgets, and more. Just ask!
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
                <div className="max-w-[85%]">
                  <div className="rounded-2xl rounded-bl-md bg-gray-100 text-gray-800 px-4 py-2.5 text-sm">
                    <div
                      className="chat-prose"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content, savedVenueNames) }}
                    />
                    {msg.status === 'streaming' && (
                      <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-middle rounded-sm" />
                    )}
                  </div>
                  {msg.toolSteps && msg.toolSteps.length > 0 && (
                    <details className="mt-1 group">
                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-500 flex items-center gap-1 px-1 select-none">
                        <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                        {msg.toolSteps.length} step{msg.toolSteps.length > 1 ? 's' : ''} taken
                      </summary>
                      <div className="mt-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex flex-wrap items-center gap-1">
                          {msg.toolSteps.map((step, i) => (
                            <span key={i} className="inline-flex items-center">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-600 whitespace-nowrap">
                                {step.label}
                              </span>
                              {i < msg.toolSteps!.length - 1 && (
                                <span className="text-gray-300 mx-0.5 text-xs">&rarr;</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </details>
                  )}
                  {msg.formRequest && (
                    <div className="mt-2">
                      <ChatForm
                        form={msg.formRequest}
                        onSubmit={send}
                        disabled={isStreaming}
                      />
                    </div>
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
                    bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
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
          {/* File chips */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent-50 border border-accent-200 text-xs text-accent-600">
                  {f.type === 'image' ? <Image className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button onClick={() => removeFile(i)} className="hover:text-accent-800">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.txt,.json,.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!!pendingConfirm}
              className="shrink-0 w-10 h-10 rounded-xl text-gray-400
                hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40
                transition-colors flex items-center justify-center"
              aria-label="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <textarea
              ref={inputRef}
              onKeyDown={handleKeyDown}
              onInput={handleTextareaInput}
              placeholder={pendingConfirm ? 'Approve or reject the action above...' : 'Ask Clementine anything...'}
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
