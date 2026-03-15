import { useState } from 'react';
import {
  MapPin,
  Users,
  DollarSign,
  Phone,
  Mail,
  User,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  CheckCircle,
  ImageOff,
  Globe,
  Package,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Lightbox } from '@/components/ui/Lightbox';
import { formatCurrency } from '@/lib/formatters';
import type { Venue } from '@/types/database';

interface VenueCardProps {
  venue: Venue;
  onEdit: (venue: Venue) => void;
  onDelete: (venue: Venue) => void;
  onSelect: (venue: Venue) => void;
}

export function VenueCard({ venue, onEdit, onDelete, onSelect }: VenueCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const photos = venue.photo_urls ?? [];
  const hasPhotos = photos.length > 0;

  const prevPhoto = () => {
    setPhotoIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  };

  const nextPhoto = () => {
    setPhotoIndex((i) => (i === photos.length - 1 ? 0 : i + 1));
  };

  return (
    <Card padding={false} className={`overflow-hidden flex flex-col ${venue.is_selected ? 'ring-2 ring-primary-500' : ''}`}>
      {/* Photo Carousel */}
      <div className="relative aspect-video bg-gray-100">
        {hasPhotos ? (
          <>
            <img
              src={photos[photoIndex]}
              alt={`${venue.name} photo ${photoIndex + 1}`}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setLightboxOpen(true)}
            />
            {photos.length > 1 && (
              <>
                <button
                  onClick={prevPhoto}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextPhoto}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === photoIndex ? 'bg-white' : 'bg-white/50'
                      }`}
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

      {/* Details */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-gray-900 leading-tight">{venue.name}</h3>

        <div className="space-y-2 text-sm text-gray-600">
          {venue.address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
              <span>{venue.address}</span>
            </div>
          )}
          <div className="flex items-center gap-4">
            {venue.capacity != null && (
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-gray-400" />
                <span>{venue.capacity} guests</span>
              </div>
            )}
            {venue.cost != null && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span>{formatCurrency(venue.cost)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contact Info */}
        {(venue.contact_name || venue.contact_email || venue.contact_phone) && (
          <div className="border-t pt-3 space-y-1 text-sm text-gray-500">
            {venue.contact_name && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span>{venue.contact_name}</span>
              </div>
            )}
            {venue.contact_email && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <a href={`mailto:${venue.contact_email}`} className="hover:text-primary-600 transition-colors">
                  {venue.contact_email}
                </a>
              </div>
            )}
            {venue.contact_phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <a href={`tel:${venue.contact_phone}`} className="hover:text-primary-600 transition-colors">
                  {venue.contact_phone}
                </a>
              </div>
            )}
          </div>
        )}

        {venue.website_url && (
          <div className="flex items-center gap-1.5 text-sm">
            <Globe className="w-3.5 h-3.5 text-gray-400" />
            <a
              href={venue.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline truncate"
            >
              {venue.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          </div>
        )}

        {venue.notes && (
          <p className="text-sm text-gray-500 line-clamp-2">{venue.notes}</p>
        )}

        {venue.packages && venue.packages.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Package className="w-3.5 h-3.5 text-gray-400" />
              <span>Packages</span>
            </div>
            <div className="space-y-1.5">
              {venue.packages.map((pkg, i) => (
                <div key={i} className="text-sm bg-gray-50 rounded px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">{pkg.name}</span>
                    {pkg.price != null && (
                      <span className="text-gray-500">{formatCurrency(pkg.price)}</span>
                    )}
                  </div>
                  {pkg.description && (
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{pkg.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto pt-3 border-t flex items-center gap-2">
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
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(venue)}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(venue)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>
      </div>

      {lightboxOpen && hasPhotos && (
        <Lightbox
          images={photos}
          index={photoIndex}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setPhotoIndex}
        />
      )}
    </Card>
  );
}
