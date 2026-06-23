import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { RsvpStatus, GuestSide } from '@/types/database';

export type SentFilter = '' | 'sent' | 'not_sent';

export interface GuestFiltersState {
  search: string;
  rsvpStatus: RsvpStatus | '';
  side: GuestSide | '';
  group: string;
  saveTheDate: SentFilter;
  invitation: SentFilter;
}

interface GuestFiltersProps {
  filters: GuestFiltersState;
  onFilterChange: (filters: GuestFiltersState) => void;
  groups: string[];
}

const rsvpOptions = [
  { value: '', label: 'All RSVP Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
];

const sideOptions = [
  { value: '', label: 'All Sides' },
  { value: 'partner1', label: 'Partner 1' },
  { value: 'partner2', label: 'Partner 2' },
  { value: 'mutual', label: 'Mutual' },
];

const saveTheDateOptions = [
  { value: '', label: 'Save the Date: All' },
  { value: 'sent', label: 'Save the Date: Sent' },
  { value: 'not_sent', label: 'Save the Date: Not sent' },
];

const invitationOptions = [
  { value: '', label: 'Invitation: All' },
  { value: 'sent', label: 'Invitation: Sent' },
  { value: 'not_sent', label: 'Invitation: Not sent' },
];

export function GuestFilters({ filters, onFilterChange, groups }: GuestFiltersProps) {
  const groupOptions = [
    { value: '', label: 'All Groups' },
    ...groups.map((g) => ({ value: g, label: g })),
  ];

  const update = (partial: Partial<GuestFiltersState>) => {
    onFilterChange({ ...filters, ...partial });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Search guests..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="pl-9"
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 sm:flex-shrink-0">
        <Select
          options={rsvpOptions}
          value={filters.rsvpStatus}
          onChange={(e) =>
            update({ rsvpStatus: e.target.value as RsvpStatus | '' })
          }
        />
        <Select
          options={sideOptions}
          value={filters.side}
          onChange={(e) =>
            update({ side: e.target.value as GuestSide | '' })
          }
        />
        <Select
          options={groupOptions}
          value={filters.group}
          onChange={(e) => update({ group: e.target.value })}
        />
        <Select
          options={saveTheDateOptions}
          value={filters.saveTheDate}
          onChange={(e) => update({ saveTheDate: e.target.value as SentFilter })}
        />
        <Select
          options={invitationOptions}
          value={filters.invitation}
          onChange={(e) => update({ invitation: e.target.value as SentFilter })}
        />
      </div>
    </div>
  );
}
