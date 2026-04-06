import { useState } from 'react';
import {
  MapPin, Users, DollarSign, Phone, Mail, User,
  ChevronLeft, ChevronRight, Globe, Package,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Lightbox } from '@/components/ui/Lightbox';
import { formatCurrency } from '@/lib/formatters';
import type { Venue } from '@/types/database';

interface VenueDetailProps {
  venue: Venue | null;
  onClose: () => void;
}

function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '') + parsed.pathname.replace(/\/$/, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

export function VenueDetail({ venue, onClose }: VenueDetailProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!venue) return null;

  const photos = venue.photo_urls ?? [];
  const hasPhotos = photos.length > 0;

  return (
    <>
      <Modal open onClose={onClose} size="lg">
        {/* Photos */}
        {hasPhotos && (
          <div className="relative h-[300px] bg-gray-100 -mx-6 -mt-6 mb-6 rounded-t-xl overflow-hidden">
            <img
              src={photos[photoIndex]}
              alt={venue.name}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setLightboxOpen(true)}
            />
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIndex((i) => (i === 0 ? photos.length - 1 : i - 1))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPhotoIndex((i) => (i === photos.length - 1 ? 0 : i + 1))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded-full text-white text-sm">
                  {photoIndex + 1} / {photos.length}
                </div>
              </>
            )}
          </div>
        )}

        {/* Header */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">{venue.name}</h2>

        {/* Key info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {venue.address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary-500" />
              <span className="text-gray-700">{venue.address}</span>
            </div>
          )}
          {venue.capacity != null && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 shrink-0 text-primary-500" />
              <span className="text-gray-700">{venue.capacity} guests</span>
            </div>
          )}
          {venue.cost != null && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 shrink-0 text-primary-500" />
              <span className="text-gray-700">{formatCurrency(venue.cost)}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {venue.notes && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">About</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{venue.notes}</p>
          </div>
        )}

        {/* Contact & Website */}
        {(venue.contact_name || venue.contact_email || venue.contact_phone || venue.website_url) && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Contact</h3>
            <div className="space-y-1.5 text-sm text-gray-600">
              {venue.contact_name && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>{venue.contact_name}</span>
                </div>
              )}
              {venue.contact_email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${venue.contact_email}`} className="text-primary-600 hover:underline">
                    {venue.contact_email}
                  </a>
                </div>
              )}
              {venue.contact_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${venue.contact_phone}`} className="text-primary-600 hover:underline">
                    {venue.contact_phone}
                  </a>
                </div>
              )}
              {venue.website_url && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <a
                    href={venue.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline truncate"
                  >
                    {cleanUrl(venue.website_url)}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Packages */}
        {venue.packages && venue.packages.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-gray-400" />
              Packages
            </h3>
            <div className="space-y-2">
              {venue.packages.map((pkg, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{pkg.name}</span>
                    {pkg.price != null && (
                      <span className="text-sm text-gray-500">{formatCurrency(pkg.price)}</span>
                    )}
                  </div>
                  {pkg.description && (
                    <p className="text-xs text-gray-500 mt-1">{pkg.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {lightboxOpen && hasPhotos && (
        <Lightbox
          images={photos}
          index={photoIndex}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setPhotoIndex}
        />
      )}
    </>
  );
}
