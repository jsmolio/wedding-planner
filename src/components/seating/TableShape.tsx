import { useDroppable } from '@dnd-kit/core';
import type { SeatingTable, Guest } from '@/types/database';
import { Trash2, GripVertical } from 'lucide-react';

interface TableShapeProps {
  table: SeatingTable;
  guests: Guest[];
  onDelete: (id: string) => void;
  onRemoveGuest: (guestId: string) => void;
}

export function TableShapeComponent({ table, guests, onDelete, onRemoveGuest }: TableShapeProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `table-${table.id}`,
    data: { type: 'table', tableId: table.id },
  });

  const seatedGuests = guests.filter((g) => g.table_id === table.id);
  const emptySeats = table.capacity - seatedGuests.length;

  return (
    <div
      ref={setNodeRef}
      className={`relative p-4 rounded-xl border-2 transition-colors min-w-[200px]
        ${isOver ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white'}
        ${table.shape === 'round' ? 'rounded-full aspect-square flex flex-col items-center justify-center min-w-[220px]' : ''}`}
    >
      <div className="flex items-center justify-between mb-2 w-full">
        <div className="flex items-center gap-1">
          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
          <span className="font-medium text-sm">{table.name}</span>
        </div>
        <button
          onClick={() => onDelete(table.id)}
          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="text-xs text-gray-500 mb-2">
        {seatedGuests.length}/{table.capacity} seats
      </div>

      <div className="flex flex-wrap gap-1.5">
        {seatedGuests.map((guest) => (
          <button
            key={guest.id}
            onClick={() => onRemoveGuest(guest.id)}
            className="px-2 py-0.5 rounded-full text-xs bg-primary-100 text-primary-700 hover:bg-red-100 hover:text-red-700 transition-colors"
            title={`Click to unseat ${guest.full_name}`}
          >
            {guest.full_name}
          </button>
        ))}
        {Array.from({ length: Math.max(0, emptySeats) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-7 h-7 rounded-full border-2 border-dashed border-gray-200"
          />
        ))}
      </div>
    </div>
  );
}
