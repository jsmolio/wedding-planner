import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Upload, Trash2, Users, Sparkles } from 'lucide-react';
import { useWedding } from '@/contexts/WeddingContext';
import { useChatAction } from '@/contexts/ChatContext';
import { fetchGuests, deleteGuest, deleteGuests } from '@/lib/queries/guests';
import { queryKeys } from '@/lib/queryKeys';
import { GuestForm } from '@/components/guests/GuestForm';
import { GuestFilters, type GuestFiltersState } from '@/components/guests/GuestFilters';
import { GuestTable } from '@/components/guests/GuestTable';
import { CSVImport } from '@/components/guests/CSVImport';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Guest } from '@/types/database';

export default function GuestsPage() {
  const { weddingId } = useWedding();
  const { openChatForPage } = useChatAction();
  const queryClient = useQueryClient();

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | undefined>();
  const [deletingGuest, setDeletingGuest] = useState<Guest | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [filters, setFilters] = useState<GuestFiltersState>({
    search: '',
    rsvpStatus: '',
    side: '',
    group: '',
  });

  // Fetch guests
  const {
    data: guests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.guests(weddingId!),
    queryFn: () => fetchGuests(weddingId!),
    enabled: !!weddingId,
  });

  // Delete single guest
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGuest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(weddingId!) });
      setDeletingGuest(null);
    },
  });

  // Bulk delete
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteGuests(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(weddingId!) });
      setSelectedIds(new Set());
    },
  });

  // Unique group names for filter dropdown
  const groups = useMemo(() => {
    const set = new Set<string>();
    guests.forEach((g) => {
      if (g.group_name) set.add(g.group_name);
    });
    return Array.from(set).sort();
  }, [guests]);

  // Apply filters
  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [g.full_name, g.email, g.phone, g.plus_one_name]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filters.rsvpStatus && g.rsvp_status !== filters.rsvpStatus) return false;
      if (filters.side && g.side !== filters.side) return false;
      if (filters.group && g.group_name !== filters.group) return false;
      return true;
    });
  }, [guests, filters]);

  // Stats
  const stats = useMemo(() => {
    const total = guests.length;
    const accepted = guests.filter((g) => g.rsvp_status === 'accepted').length;
    const declined = guests.filter((g) => g.rsvp_status === 'declined').length;
    const pending = guests.filter((g) => g.rsvp_status === 'pending').length;
    return { total, accepted, declined, pending };
  }, [guests]);

  // Handlers
  const handleEdit = (guest: Guest) => {
    setEditingGuest(guest);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingGuest(undefined);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingGuest(undefined);
  };

  const handleDeleteConfirm = () => {
    if (deletingGuest) {
      deleteMutation.mutate(deletingGuest.id);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  if (!weddingId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Please set up your wedding first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guest List</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your wedding guests, RSVPs, and seating arrangements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="clementine" onClick={openChatForPage}>
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Ask Clementine</span>
          </Button>
          <Button variant="outline" onClick={() => setCsvOpen(true)}>
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Guest</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Users className="w-4 h-4" />
            Total
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="success">Accepted</Badge>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.accepted}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="warning">Pending</Badge>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="danger">Declined</Badge>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.declined}</p>
        </div>
      </div>

      {/* Filters */}
      <GuestFilters filters={filters} onFilterChange={setFilters} groups={groups} />

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-primary-800">
            {selectedIds.size} guest{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <Button
            variant="danger"
            size="sm"
            onClick={handleBulkDelete}
            loading={bulkDeleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Table / States */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">
          <p>Failed to load guests. Please try again.</p>
        </div>
      ) : (
        <GuestTable
          guests={filteredGuests}
          onEdit={handleEdit}
          onDelete={setDeletingGuest}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
        />
      )}

      {/* Guest Form Modal */}
      <GuestForm
        open={formOpen}
        onClose={handleFormClose}
        guest={editingGuest}
        weddingId={weddingId}
      />

      {/* CSV Import Modal */}
      <CSVImport open={csvOpen} onClose={() => setCsvOpen(false)} weddingId={weddingId} />

      {/* Delete Confirmation */}
      {deletingGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeletingGuest(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900">Delete Guest</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete{' '}
              <span className="font-medium">{deletingGuest.full_name}</span>? This action cannot be
              undone.
            </p>
            {deleteMutation.error && (
              <p className="mt-2 text-sm text-red-600">
                Failed to delete guest. Please try again.
              </p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setDeletingGuest(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                loading={deleteMutation.isPending}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
