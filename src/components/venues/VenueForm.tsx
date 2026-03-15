import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X, Globe, Loader2, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Lightbox } from '@/components/ui/Lightbox';
import { createVenue, updateVenue, uploadVenuePhoto, scrapeVenueWebsite } from '@/lib/queries/venues';
import { queryKeys } from '@/lib/queryKeys';
import type { Venue, VenuePackage } from '@/types/database';

interface VenueFormData {
  name: string;
  address: string;
  capacity: string;
  cost: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
  website_url: string;
}

interface VenueFormProps {
  open: boolean;
  onClose: () => void;
  venue?: Venue;
  weddingId: string;
}

export function VenueForm({ open, onClose, venue, weddingId }: VenueFormProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [packages, setPackages] = useState<VenuePackage[]>([]);
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isEdit = !!venue;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<VenueFormData>({
    defaultValues: {
      name: '',
      address: '',
      capacity: '',
      cost: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      notes: '',
      website_url: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (venue) {
        reset({
          name: venue.name,
          address: venue.address,
          capacity: venue.capacity?.toString() ?? '',
          cost: venue.cost?.toString() ?? '',
          contact_name: venue.contact_name,
          contact_email: venue.contact_email,
          contact_phone: venue.contact_phone,
          notes: venue.notes,
          website_url: venue.website_url ?? '',
        });
        setPhotoUrls(venue.photo_urls ?? []);
        setPackages(venue.packages ?? []);
      } else {
        reset({
          name: '',
          address: '',
          capacity: '',
          cost: '',
          contact_name: '',
          contact_email: '',
          contact_phone: '',
          notes: '',
          website_url: '',
        });
        setPhotoUrls([]);
        setPackages([]);
      }
      setScrapeError(null);
    }
  }, [open, venue, reset]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Venue> & { wedding_id: string; name: string }) =>
      createVenue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.venues(weddingId) });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<Venue> }) =>
      updateVenue(data.id, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.venues(weddingId) });
      onClose();
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleFetchDetails = async () => {
    const url = getValues('website_url').trim();
    if (!url) return;

    setScraping(true);
    setScrapeError(null);
    try {
      const data = await scrapeVenueWebsite(url);

      // Auto-fill form fields with extracted data (only fill empty fields or overwrite all on new venue)
      if (data.name) setValue('name', data.name);
      if (data.address) setValue('address', data.address);
      if (data.capacity != null) setValue('capacity', data.capacity.toString());
      if (data.cost != null) setValue('cost', data.cost.toString());
      if (data.contact_name) setValue('contact_name', data.contact_name);
      if (data.contact_email) setValue('contact_email', data.contact_email);
      if (data.contact_phone) setValue('contact_phone', data.contact_phone);
      if (data.notes) setValue('notes', data.notes);
      if (data.packages && data.packages.length > 0) {
        setPackages(data.packages);
      }
      if (data.photo_urls && data.photo_urls.length > 0) {
        setPhotoUrls((prev) => [...prev, ...data.photo_urls!]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch venue details';
      setScrapeError(message);
    } finally {
      setScraping(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map((file) => uploadVenuePhoto(file));
      const urls = await Promise.all(uploadPromises);
      setPhotoUrls((prev) => [...prev, ...urls]);
    } catch (error) {
      console.error('Failed to upload photos:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const addPackage = () => {
    setPackages((prev) => [...prev, { name: '', price: null, description: '' }]);
  };

  const updatePackage = (index: number, field: keyof VenuePackage, value: string) => {
    setPackages((prev) =>
      prev.map((pkg, i) => {
        if (i !== index) return pkg;
        if (field === 'price') {
          return { ...pkg, price: value ? parseFloat(value) : null };
        }
        return { ...pkg, [field]: value };
      })
    );
  };

  const removePackage = (index: number) => {
    setPackages((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (data: VenueFormData) => {
    const payload = {
      name: data.name,
      address: data.address,
      capacity: data.capacity ? parseInt(data.capacity, 10) : null,
      cost: data.cost ? parseFloat(data.cost) : null,
      contact_name: data.contact_name,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      notes: data.notes,
      website_url: data.website_url,
      photo_urls: photoUrls,
      packages: packages,
    };

    if (isEdit && venue) {
      updateMutation.mutate({ id: venue.id, updates: payload });
    } else {
      createMutation.mutate({ ...payload, wedding_id: weddingId });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Venue' : 'Add Venue'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Website URL + Fetch */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="Website URL"
              type="url"
              placeholder="https://venue-website.com"
              {...register('website_url')}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleFetchDetails}
            disabled={scraping}
            className="shrink-0"
          >
            {scraping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                Fetch Details
              </>
            )}
          </Button>
        </div>
        {scrapeError && (
          <p className="text-sm text-red-600">{scrapeError}</p>
        )}

        <Input
          label="Venue Name"
          placeholder="e.g. The Grand Ballroom"
          error={errors.name?.message}
          {...register('name', { required: 'Venue name is required' })}
        />

        <Input
          label="Address"
          placeholder="Full address"
          error={errors.address?.message}
          {...register('address')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Capacity"
            type="number"
            placeholder="Number of guests"
            error={errors.capacity?.message}
            {...register('capacity', {
              validate: (v) =>
                !v || (parseInt(v, 10) > 0) || 'Capacity must be a positive number',
            })}
          />
          <Input
            label="Cost ($)"
            type="number"
            placeholder="Total cost"
            error={errors.cost?.message}
            {...register('cost', {
              validate: (v) =>
                !v || (parseFloat(v) >= 0) || 'Cost must be zero or more',
            })}
          />
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Contact Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Contact Name"
              placeholder="Name"
              {...register('contact_name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              error={errors.contact_email?.message}
              {...register('contact_email', {
                validate: (v) =>
                  !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email',
              })}
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="(555) 123-4567"
              {...register('contact_phone')}
            />
          </div>
        </div>

        <Textarea
          label="Notes"
          placeholder="Any additional notes about this venue..."
          {...register('notes')}
        />

        {/* Packages */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Packages</p>
            <Button type="button" variant="outline" size="sm" onClick={addPackage}>
              <Plus className="w-4 h-4" />
              Add Package
            </Button>
          </div>

          {packages.length > 0 && (
            <div className="space-y-3">
              {packages.map((pkg, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Package name"
                        value={pkg.name}
                        onChange={(e) => updatePackage(index, 'name', e.target.value)}
                        className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={pkg.price ?? ''}
                        onChange={(e) => updatePackage(index, 'price', e.target.value)}
                        className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePackage(index)}
                      className="p-1 text-red-500 hover:text-red-700 mt-0.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    placeholder="What's included..."
                    value={pkg.description}
                    onChange={(e) => updatePackage(index, 'description', e.target.value)}
                    rows={2}
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Photo Upload */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Photos</p>

          {photoUrls.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photoUrls.map((url, index) => (
                <div key={index} className="relative group aspect-square rounded-lg overflow-hidden">
                  <img
                    src={url}
                    alt={`Venue photo ${index + 1}`}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setLightboxIndex(index)}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              'Uploading...'
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Add Photos
              </>
            )}
          </Button>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {isEdit ? 'Save Changes' : 'Add Venue'}
          </Button>
        </div>

        {lightboxIndex !== null && photoUrls.length > 0 && (
          <Lightbox
            images={photoUrls}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onIndexChange={setLightboxIndex}
          />
        )}
      </form>
    </Modal>
  );
}
