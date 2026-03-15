import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { SeatingTable, Guest } from '@/types/database';
import { TableShapeComponent } from './TableShape';
import { GuestChip } from './GuestChip';
import { useDroppable } from '@dnd-kit/core';

interface SeatingCanvasProps {
  tables: SeatingTable[];
  guests: Guest[];
  onAssignGuest: (guestId: string, tableId: string | null) => void;
  onDeleteTable: (tableId: string) => void;
}

function UnassignedPanel({ guests }: { guests: Guest[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned',
    data: { type: 'unassigned' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-2 rounded-xl p-4 transition-colors ${
        isOver ? 'border-primary-400 bg-primary-50' : 'border-dashed border-gray-300 bg-gray-50'
      }`}
    >
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Unassigned ({guests.length})
      </h3>
      <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto">
        {guests.length === 0 ? (
          <p className="text-xs text-gray-400">All guests have been seated!</p>
        ) : (
          guests.map((guest) => (
            <GuestChip key={guest.id} guest={guest} />
          ))
        )}
      </div>
    </div>
  );
}

export function SeatingCanvas({ tables, guests, onAssignGuest, onDeleteTable }: SeatingCanvasProps) {
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const unassignedGuests = guests.filter(
    (g) => !g.table_id && g.rsvp_status !== 'declined'
  );

  function handleDragStart(event: DragStartEvent) {
    const guest = event.active.data.current?.guest as Guest | undefined;
    if (guest) setActiveGuest(guest);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveGuest(null);
    const { active, over } = event;
    if (!over) return;

    const guestId = active.id as string;
    const dropData = over.data.current;

    if (dropData?.type === 'table') {
      onAssignGuest(guestId, dropData.tableId as string);
    } else if (dropData?.type === 'unassigned' || over.id === 'unassigned') {
      onAssignGuest(guestId, null);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <UnassignedPanel guests={unassignedGuests} />
        </div>
        <div className="lg:col-span-3">
          {tables.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
              Add tables to start building your seating chart
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {tables.map((table) => (
                <TableShapeComponent
                  key={table.id}
                  table={table}
                  guests={guests}
                  onDelete={onDeleteTable}
                  onRemoveGuest={(guestId) => onAssignGuest(guestId, null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeGuest ? <GuestChip guest={activeGuest} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
