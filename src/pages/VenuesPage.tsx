import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, GitCompareArrows, X, Loader2, Plus } from 'lucide-react';
import { useWedding } from '@/contexts/WeddingContext';
import { useChatAction } from '@/contexts/ChatContext';
import { fetchVenues, deleteVenue, selectVenue, unselectVenue } from '@/lib/queries/venues';
import { queryKeys } from '@/lib/queryKeys';
import { VenueCard } from '@/components/venues/VenueCard';
import { VenueDetail } from '@/components/venues/VenueDetail';
import { VenueCompare } from '@/components/venues/VenueCompare';
import { Button } from '@/components/ui/Button';
import type { Venue } from '@/types/database';

export default function VenuesPage() {
  const { weddingId } = useWedding();
  const queryClient = useQueryClient();
  const { openChat } = useChatAction();
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [detailVenue, setDetailVenue] = useState<Venue | null>(null);

  const {
    data: venues = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.venues(weddingId!),
    queryFn: () => fetchVenues(weddingId!),
    enabled: !!weddingId,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVenue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.venues(weddingId!) });
      setDeleteConfirmId(null);
    },
  });

  const selectMutation = useMutation({
    mutationFn: (venueId: string) => selectVenue(weddingId!, venueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.venues(weddingId!) });
    },
  });

  const handleAdd = () => {
    openChat("I'd love to help you find the perfect venue! What location are you considering, and do you have a style in mind? (e.g. outdoor, rustic, modern, mountain, etc.)");
  };

  const handleDelete = (venue: Venue) => {
    setDeleteConfirmId(venue.id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
    }
  };

  const unselectMutation = useMutation({
    mutationFn: (venueId: string) => unselectVenue(venueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.venues(weddingId!) });
    },
  });

  const handleSelect = (venue: Venue) => {
    if (venue.is_selected) {
      unselectMutation.mutate(venue.id);
    } else {
      selectMutation.mutate(venue.id);
    }
  };

  const toggleCompareVenue = (venueId: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(venueId)) {
        next.delete(venueId);
      } else if (next.size < 3) {
        next.add(venueId);
      }
      return next;
    });
  };

  const toggleCompareMode = () => {
    setCompareMode((prev) => {
      if (prev) {
        setCompareIds(new Set());
      }
      return !prev;
    });
  };

  const comparedVenues = venues.filter((v) => compareIds.has(v.id));

  if (!weddingId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No wedding selected.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Venues</h1>
          <p className="text-gray-500 text-sm mt-1">
            Browse and compare potential venues for your wedding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {venues.length >= 2 && (
            <Button
              variant={compareMode ? 'secondary' : 'outline'}
              onClick={toggleCompareMode}
            >
              {compareMode ? (
                <>
                  <X className="w-4 h-4" />
                  Exit Compare
                </>
              ) : (
                <>
                  <GitCompareArrows className="w-4 h-4" />
                  Compare
                </>
              )}
            </Button>
          )}
          <Button variant="clementine" onClick={handleAdd}>
            <Sparkles className="w-4 h-4" />
            Ask Clementine
          </Button>
        </div>
      </div>

      {/* Compare Mode Banner */}
      {compareMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-blue-700">
              Select 2-3 venues to compare. Click on a venue card to toggle selection.
              <span className="ml-2 font-medium">{compareIds.size} of 3 selected</span>
            </p>
            {compareIds.size >= 2 && (
              <Button
                size="sm"
                onClick={() => {
                  /* scroll handled by rendering below */
                }}
              >
                View Comparison ({compareIds.size})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="text-center py-12">
          <p className="text-red-500">Failed to load venues. Please try again.</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && venues.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
            <Plus className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No venues yet</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Start adding venues you are considering for your wedding.
          </p>
          <Button variant="clementine" onClick={handleAdd}>
            <Sparkles className="w-4 h-4" />
            Ask Clementine
          </Button>
        </div>
      )}

      {/* Venue Grid */}
      {!isLoading && venues.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className={`relative ${compareMode ? 'cursor-pointer' : ''}`}
              onClick={compareMode ? () => toggleCompareVenue(venue.id) : undefined}
            >
              {compareMode && (
                <div
                  className={`absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                    compareIds.has(venue.id)
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {compareIds.has(venue.id) ? Array.from(compareIds).indexOf(venue.id) + 1 : ''}
                </div>
              )}
              <div className={compareMode ? 'pointer-events-none' : ''}>
                <VenueCard
                  venue={venue}
                  onClick={setDetailVenue}
                  onDelete={handleDelete}
                  onSelect={handleSelect}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison Table */}
      {compareMode && comparedVenues.length >= 2 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Side-by-Side Comparison</h2>
          <VenueCompare venues={comparedVenues} />
        </div>
      )}

      {/* Venue Detail Modal */}
      <VenueDetail venue={detailVenue} onClose={() => setDetailVenue(null)} />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Delete Venue</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this venue? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleteMutation.isPending} onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
