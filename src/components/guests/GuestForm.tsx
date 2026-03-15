import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { createGuest, updateGuest } from '@/lib/queries/guests';
import { queryKeys } from '@/lib/queryKeys';
import type { Guest, GuestSide, RsvpStatus } from '@/types/database';

interface GuestFormData {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  side: GuestSide;
  group_name: string;
  has_plus_one: boolean;
  plus_one_name: string;
  dietary_restrictions: string;
  meal_choice: string;
  rsvp_status: RsvpStatus;
}

interface GuestFormProps {
  open: boolean;
  onClose: () => void;
  guest?: Guest;
  weddingId: string;
}

const sideOptions = [
  { value: 'partner1', label: 'Partner 1' },
  { value: 'partner2', label: 'Partner 2' },
  { value: 'mutual', label: 'Mutual' },
];

const rsvpOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
];

const mealOptions = [
  { value: '', label: 'No preference' },
  { value: 'chicken', label: 'Chicken' },
  { value: 'beef', label: 'Beef' },
  { value: 'fish', label: 'Fish' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
];

const defaultValues: GuestFormData = {
  full_name: '',
  email: '',
  phone: '',
  address: '',
  side: 'mutual',
  group_name: '',
  has_plus_one: false,
  plus_one_name: '',
  dietary_restrictions: '',
  meal_choice: '',
  rsvp_status: 'pending',
};

export function GuestForm({ open, onClose, guest, weddingId }: GuestFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!guest;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<GuestFormData>({
    defaultValues,
  });

  const hasPlusOne = watch('has_plus_one');

  useEffect(() => {
    if (open) {
      if (guest) {
        reset({
          full_name: guest.full_name,
          email: guest.email,
          phone: guest.phone,
          address: guest.address,
          side: guest.side,
          group_name: guest.group_name,
          has_plus_one: guest.has_plus_one,
          plus_one_name: guest.plus_one_name,
          dietary_restrictions: guest.dietary_restrictions,
          meal_choice: guest.meal_choice,
          rsvp_status: guest.rsvp_status,
        });
      } else {
        reset(defaultValues);
      }
    }
  }, [open, guest, reset]);

  const createMutation = useMutation({
    mutationFn: (data: GuestFormData) =>
      createGuest({ ...data, wedding_id: weddingId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(weddingId) });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: GuestFormData) => updateGuest(guest!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(weddingId) });
      onClose();
    },
  });

  const onSubmit = (data: GuestFormData) => {
    if (!data.has_plus_one) {
      data.plus_one_name = '';
    }
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Guest' : 'Add Guest'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Name and Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            placeholder="Jane Doe"
            error={errors.full_name?.message}
            {...register('full_name', { required: 'Name is required' })}
          />
          <Input
            label="Email"
            type="email"
            placeholder="jane@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone"
            type="tel"
            placeholder="(555) 123-4567"
            {...register('phone')}
          />
          <Input
            label="Address"
            placeholder="123 Main St, City, ST 12345"
            {...register('address')}
          />
        </div>

        {/* Grouping */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Side"
            options={sideOptions}
            {...register('side')}
          />
          <Input
            label="Group"
            placeholder="e.g. College Friends, Family"
            {...register('group_name')}
          />
        </div>

        {/* Plus One */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              {...register('has_plus_one')}
            />
            Has Plus One
          </label>
          {hasPlusOne && (
            <Input
              label="Plus One Name"
              placeholder="Guest's plus one"
              {...register('plus_one_name')}
            />
          )}
        </div>

        {/* Meal and Dietary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Meal Choice"
            options={mealOptions}
            {...register('meal_choice')}
          />
          <Select
            label="RSVP Status"
            options={rsvpOptions}
            {...register('rsvp_status')}
          />
        </div>

        <Textarea
          label="Dietary Restrictions"
          placeholder="e.g. Gluten free, nut allergy"
          {...register('dietary_restrictions')}
        />

        {/* Error */}
        {mutationError && (
          <p className="text-sm text-red-600">
            {mutationError instanceof Error
              ? mutationError.message
              : 'Something went wrong. Please try again.'}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {isEditing ? 'Save Changes' : 'Add Guest'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
