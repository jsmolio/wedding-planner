import { useDraggable } from '@dnd-kit/core';
import type { Guest } from '@/types/database';

const sideColors: Record<string, string> = {
  partner1: 'bg-blue-100 text-blue-700 border-blue-200',
  partner2: 'bg-pink-100 text-pink-700 border-pink-200',
  mutual: 'bg-purple-100 text-purple-700 border-purple-200',
};

interface GuestChipProps {
  guest: Guest;
  isDragOverlay?: boolean;
}

export function GuestChip({ guest, isDragOverlay }: GuestChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: guest.id,
    data: { type: 'guest', guest },
  });

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      {...(isDragOverlay ? {} : { ...listeners, ...attributes })}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-grab select-none
        ${sideColors[guest.side] || sideColors.mutual}
        ${isDragging ? 'opacity-40' : ''}
        ${isDragOverlay ? 'shadow-lg scale-105' : ''}`}
    >
      {guest.full_name}
    </div>
  );
}
