import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWedding } from '@/contexts/WeddingContext';
import { queryKeys } from '@/lib/queryKeys';
import { fetchSeatingTables, createSeatingTable, deleteSeatingTable } from '@/lib/queries/seating';
import { fetchGuests, updateGuest } from '@/lib/queries/guests';
import { SeatingCanvas } from '@/components/seating/SeatingCanvas';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Plus, Wand2 } from 'lucide-react';
import type { TableShape } from '@/types/database';

export default function SeatingPage() {
  const { weddingId } = useWedding();
  const queryClient = useQueryClient();
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableShape, setNewTableShape] = useState<TableShape>('round');
  const [newTableCapacity, setNewTableCapacity] = useState(8);

  const { data: tables = [] } = useQuery({
    queryKey: queryKeys.seatingTables(weddingId!),
    queryFn: () => fetchSeatingTables(weddingId!),
    enabled: !!weddingId,
  });

  const { data: guests = [] } = useQuery({
    queryKey: queryKeys.guests(weddingId!),
    queryFn: () => fetchGuests(weddingId!),
    enabled: !!weddingId,
  });

  const addTableMutation = useMutation({
    mutationFn: () =>
      createSeatingTable({
        wedding_id: weddingId!,
        name: newTableName || `Table ${tables.length + 1}`,
        shape: newTableShape,
        capacity: newTableCapacity,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seatingTables(weddingId!) });
      setShowAddTable(false);
      setNewTableName('');
      setNewTableCapacity(8);
    },
  });

  const deleteTableMutation = useMutation({
    mutationFn: deleteSeatingTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seatingTables(weddingId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(weddingId!) });
    },
  });

  const assignGuestMutation = useMutation({
    mutationFn: ({ guestId, tableId }: { guestId: string; tableId: string | null }) =>
      updateGuest(guestId, { table_id: tableId, seat_number: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(weddingId!) });
    },
  });

  const handleAutoAssign = () => {
    const unassigned = guests.filter((g) => !g.table_id && g.rsvp_status !== 'declined');
    const sortedTables = [...tables];
    let guestIndex = 0;

    // Group by group_name first, then by side
    const grouped = new Map<string, typeof unassigned>();
    for (const guest of unassigned) {
      const key = guest.group_name || guest.side || 'other';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(guest);
    }

    const allGuests = [...grouped.values()].flat();

    for (const table of sortedTables) {
      const currentSeated = guests.filter((g) => g.table_id === table.id).length;
      const available = table.capacity - currentSeated;
      for (let i = 0; i < available && guestIndex < allGuests.length; i++) {
        assignGuestMutation.mutate({
          guestId: allGuests[guestIndex].id,
          tableId: table.id,
        });
        guestIndex++;
      }
    }
  };

  if (!weddingId) return null;

  const acceptedGuests = guests.filter((g) => g.rsvp_status !== 'declined');
  const seatedCount = acceptedGuests.filter((g) => g.table_id).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Seating Chart</h1>
          <p className="text-gray-500 text-sm mt-1">
            {seatedCount} of {acceptedGuests.length} guests seated
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAutoAssign} disabled={tables.length === 0}>
            <Wand2 className="w-4 h-4" />
            Auto-Assign
          </Button>
          <Button onClick={() => setShowAddTable(true)}>
            <Plus className="w-4 h-4" />
            Add Table
          </Button>
        </div>
      </div>

      <SeatingCanvas
        tables={tables}
        guests={guests}
        onAssignGuest={(guestId, tableId) =>
          assignGuestMutation.mutate({ guestId, tableId })
        }
        onDeleteTable={(id) => deleteTableMutation.mutate(id)}
      />

      <Modal open={showAddTable} onClose={() => setShowAddTable(false)} title="Add Table" size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addTableMutation.mutate();
          }}
          className="space-y-4"
        >
          <Input
            label="Table Name"
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            placeholder={`Table ${tables.length + 1}`}
          />
          <Select
            label="Shape"
            value={newTableShape}
            onChange={(e) => setNewTableShape(e.target.value as TableShape)}
            options={[
              { value: 'round', label: 'Round' },
              { value: 'rectangular', label: 'Rectangular' },
            ]}
          />
          <Input
            label="Capacity"
            type="number"
            min={1}
            max={20}
            value={newTableCapacity}
            onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 8)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setShowAddTable(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={addTableMutation.isPending}>
              Add Table
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
