import { useCallback, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatFab } from '../chat/ChatFab';
import { ChatPanel } from '../chat/ChatPanel';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../contexts/AuthContext';
import { useWedding } from '../../contexts/WeddingContext';
import { ChatContext, getPageGreeting } from '../../contexts/ChatContext';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(840);
  const { session } = useAuth();
  const { weddingId } = useWedding();
  const location = useLocation();
  const queryClient = useQueryClient();
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);
  const chat = useChat(session?.access_token ?? null, weddingId, invalidateAll);

  const openChat = useCallback((message?: string) => {
    setChatOpen(true);
    if (message) {
      setTimeout(() => chat.addAssistantMessage(message), 350);
    }
  }, [chat.addAssistantMessage]);

  const openChatForPage = useCallback(() => {
    setChatOpen(true);
    const greeting = getPageGreeting(location.pathname);
    setTimeout(() => chat.addAssistantMessage(greeting), 350);
  }, [chat.addAssistantMessage, location.pathname]);

  const chatCtx = useMemo(() => ({ openChat, openChatForPage }), [openChat, openChatForPage]);

  return (
    <ChatContext.Provider value={chatCtx}>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div
          className="flex-1 flex flex-col overflow-hidden min-w-0 chat-main-content"
          style={{ '--chat-panel-width': `${chatOpen ? chatWidth : 0}px` } as React.CSSProperties}
        >
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
        {!chatOpen && <ChatFab onClick={() => setChatOpen(true)} />}
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          width={chatWidth}
          onWidthChange={setChatWidth}
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          pendingConfirm={chat.pendingConfirm}
          error={chat.error}
          statusText={chat.statusText}
          send={chat.send}
          handleConfirm={chat.handleConfirm}
          clearError={chat.clearError}
          conversations={chat.conversations}
          activeConversationId={chat.activeConversationId}
          onSelectConversation={chat.selectConversation}
          onNewConversation={chat.newConversation}
          onDeleteConversation={chat.removeConversation}
        />
      </div>
    </ChatContext.Provider>
  );
}
