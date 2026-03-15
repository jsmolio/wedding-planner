import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { createChecklistItem, updateChecklistItem } from '@/lib/queries/checklist';
import { queryKeys } from '@/lib/queryKeys';
import type { ChecklistItem } from '@/types/database';

interface ChecklistFormProps {
  open: boolean;
  onClose: () => void;
  item?: ChecklistItem | null;
  weddingId: string;
}

interface FormValues {
  title: string;
  description: string;
  due_date: string;
  time_period: string;
}

const TIME_PERIOD_OPTIONS = [
  { value: '12+ months before', label: '12+ months before' },
  { value: '9-12 months before', label: '9-12 months before' },
  { value: '6-9 months before', label: '6-9 months before' },
  { value: '4-6 months before', label: '4-6 months before' },
  { value: '2-4 months before', label: '2-4 months before' },
  { value: '1-2 months before', label: '1-2 months before' },
  { value: '2-4 weeks before', label: '2-4 weeks before' },
  { value: '1-2 weeks before', label: '1-2 weeks before' },
  { value: 'Week of', label: 'Week of' },
  { value: 'Day of', label: 'Day of' },
  { value: 'After the wedding', label: 'After the wedding' },
];

export function ChecklistForm({ open, onClose, item, weddingId }: ChecklistFormProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(item);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      due_date: '',
      time_period: '6-9 months before',
    },
  });

  useEffect(() => {
    if (open) {
      if (item) {
        reset({
          title: item.title,
          description: item.description || '',
          due_date: item.due_date || '',
          time_period: item.time_period,
        });
      } else {
        reset({
          title: '',
          description: '',
          due_date: '',
          time_period: '6-9 months before',
        });
      }
    }
  }, [open, item, reset]);

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      createChecklistItem({
        wedding_id: weddingId,
        title: values.title,
        description: values.description,
        due_date: values.due_date || null,
        time_period: values.time_period,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist(weddingId) });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateChecklistItem(item!.id, {
        title: values.title,
        description: values.description,
        due_date: values.due_date || null,
        time_period: values.time_period,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist(weddingId) });
      onClose();
    },
  });

  const onSubmit = (values: FormValues) => {
    if (isEditing) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit Task' : 'Add Custom Task'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Title"
          placeholder="Enter task title"
          error={errors.title?.message}
          {...register('title', { required: 'Title is required' })}
        />

        <Textarea
          label="Description"
          placeholder="Optional description"
          {...register('description')}
        />

        <Input
          label="Due Date"
          type="date"
          error={errors.due_date?.message}
          {...register('due_date')}
        />

        <Select
          label="Time Period"
          options={TIME_PERIOD_OPTIONS}
          error={errors.time_period?.message}
          {...register('time_period', { required: 'Time period is required' })}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Add Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
