import { useState } from 'react';
import {
  MapPin,
  Users,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckCircle,
  ImageOff,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/formatters';
import type { Venue } from '@/types/database';

interface VenueCardProps {
  venue: Venue;
  onClick: (venue: Venue) => void;
  onDelete: (venue: Venue) => void;
  onSelect: (venue: Venue) => void;
}

export function VenueCard({ venue, onClick, onDelete, onSelect }: VenueCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = venue.photo_urls ?? [];
  const hasPhotos = photos.length > 0;

  return (
    <Card padding={false} className={`overflow-hidden flex flex-col h-[440px] ${venue.is_selected ? 'ring-2 ring-primary-500' : ''}`}>
      {/* Photo */}
      <div
        className="relative h-[280px] bg-gray-100 shrink-0 cursor-pointer"
        onClick={() => onClick(venue)}
      >
        {hasPhotos ? (
          <>
            <img
              src={photos[photoIndex]}
              alt={venue.name}
              className="w-full h-full object-cover"
            />
            {photos.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => (i === 0 ? photos.length - 1 : i - 1)); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => (i === photos.length - 1 ? 0 : i + 1)); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setPhotoIndex(i); }}
                      className={`w-2 h-2 rounded-full transition-colors ${i === photoIndex ? 'bg-white' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            <ImageOff className="w-10 h-10 mb-1" />
            <span className="text-xs">No photos</span>
          </div>
        )}

        {venue.is_selected && (
          <div className="absolute top-2 right-2">
            <Badge variant="success">Selected</Badge>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 flex-1 flex flex-col cursor-pointer" onClick={() => onClick(venue)}>
        <h3 className="text-base font-semibold text-gray-900 leading-tight truncate">{venue.name}</h3>

        <div className="mt-2 space-y-1.5 text-sm text-gray-500">
          {venue.address && (
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />
              <span className="truncate">{venue.address}</span>
            </div>
          )}
          <div className="flex items-center gap-4">
            {venue.capacity != null && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <span>{venue.capacity} guests</span>
              </div>
            )}
            {venue.cost != null && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                <span>{formatCurrency(venue.cost)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions — pinned bottom */}
      <div className="px-4 pb-3 flex items-center gap-2 shrink-0">
        {venue.is_selected ? (
          <Button size="sm" variant="outline" onClick={() => onSelect(venue)}>
            <CheckCircle className="w-4 h-4 text-green-500" />
            Unselect
          </Button>
        ) : (
          <Button size="sm" onClick={() => onSelect(venue)}>
            <CheckCircle className="w-4 h-4" />
            Select
          </Button>
        )}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => onDelete(venue)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
