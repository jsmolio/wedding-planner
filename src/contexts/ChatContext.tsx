import { createContext, useContext } from 'react';

interface ChatContextType {
  openChat: (message?: string) => void;
  openChatForPage: () => void;
}

export const ChatContext = createContext<ChatContextType>({
  openChat: () => {},
  openChatForPage: () => {},
});

export function useChatAction() {
  return useContext(ChatContext);
}

const PAGE_GREETINGS: Record<string, string> = {
  '/dashboard': "Hi! I can help you get an overview of your wedding plans. What would you like to know?",
  '/guests': "Need help with your guest list? I can import guests from a CSV, check RSVPs, or help organize groups.",
  '/rsvp-manager': "I can help you track RSVPs and follow up with guests who haven't responded yet.",
  '/venues': "I'd love to help you find the perfect venue! What location are you considering, and do you have a style in mind?",
  '/seating': "Let me help you plan your seating arrangement! I can check your guest list and suggest table groupings.",
  '/budget': "I can help you review your budget, track expenses, or find ways to save. What do you need?",
  '/checklist': "Let's make sure you're on track! I can review your checklist and suggest what to focus on next.",
  '/settings': "Need help with anything? I'm here if you have questions about your wedding plans.",
};

export function getPageGreeting(pathname: string): string {
  return PAGE_GREETINGS[pathname] ?? "How can I help with your wedding planning?";
}
