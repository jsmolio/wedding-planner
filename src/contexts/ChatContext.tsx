import { createContext, useContext } from 'react';

interface ChatContextType {
  openChat: (message?: string) => void;
}

export const ChatContext = createContext<ChatContextType>({ openChat: () => {} });

export function useChatAction() {
  return useContext(ChatContext);
}
