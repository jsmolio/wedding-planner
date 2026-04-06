import { ClementineLogo } from '../ui/Logo';

interface ChatFabProps {
  onClick: () => void;
}

export function ChatFab({ onClick }: ChatFabProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Chat with Clementine"
      className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full
        bg-gradient-to-br from-accent-400 to-accent-500 text-white
        shadow-lg hover:shadow-xl hover:scale-105
        transition-all duration-200 flex items-center justify-center"
    >
      <ClementineLogo className="w-8 h-8" />
    </button>
  );
}
