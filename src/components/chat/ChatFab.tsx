import { Sparkles } from 'lucide-react';

interface ChatFabProps {
  onClick: () => void;
}

export function ChatFab({ onClick }: ChatFabProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Open AI assistant"
      className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full
        bg-gradient-to-br from-primary-500 to-primary-600 text-white
        shadow-lg hover:shadow-xl hover:scale-105
        transition-all duration-200 flex items-center justify-center"
    >
      <Sparkles className="w-6 h-6" />
    </button>
  );
}
