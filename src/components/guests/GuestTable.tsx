import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Trash2, Mail, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Guest } from '@/types/database';

type SortField = 'full_name' | 'side' | 'group_name' | 'rsvp_status' | 'meal_choice';
type SortDirection = 'asc' | 'desc';

interface GuestTableProps {
  guests: Guest[];
  onEdit: (guest: Guest) => void;
  onDelete: (guest: Guest) => void;
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
}

const rsvpBadgeVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  accepted: 'success',
  pending: 'warning',
  declined: 'danger',
};

const sideLabels: Record<string, string> = {
  partner1: 'Partner 1',
  partner2: 'Partner 2',
  mutual: 'Mutual',
};

export function GuestTable({ guests, onEdit, onDelete, selectedIds, onSelect }: GuestTableProps) {
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedGuests = [...guests].sort((a, b) => {
    const aVal = a[sortField] ?? '';
    const bVal = b[sortField] ?? '';
    const cmp = String(aVal).localeCompare(String(bVal));
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const allSelected = guests.length > 0 && selectedIds.size === guests.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      onSelect(new Set());
    } else {
      onSelect(new Set(guests.map((g) => g.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelect(next);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-primary-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-primary-600" />;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
        onClick={() => handleSort(field)}
      >
        {children}
        <SortIcon field={field} />
      </button>
    </th>
  );

  if (guests.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium">No guests found</p>
        <p className="text-sm mt-1">Add guests manually or import from a CSV file.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                />
              </th>
              <SortableHeader field="full_name">Name</SortableHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Contact
              </th>
              <SortableHeader field="side">Side</SortableHeader>
              <SortableHeader field="group_name">Group</SortableHeader>
              <SortableHeader field="rsvp_status">RSVP</SortableHeader>
              <SortableHeader field="meal_choice">Meal</SortableHeader>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {sortedGuests.map((guest) => (
              <tr
                key={guest.id}
                className={`hover:bg-gray-50 transition-colors ${
                  selectedIds.has(guest.id) ? 'bg-primary-50' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(guest.id)}
                    onChange={() => toggleOne(guest.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                  />
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{guest.full_name}</p>
                    {guest.has_plus_one && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        +1{guest.plus_one_name ? `: ${guest.plus_one_name}` : ''}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex flex-col gap-0.5">
                    {guest.email && (
                      <span className="inline-flex items-center gap-1 text-gray-600 text-xs">
                        <Mail className="w-3 h-3" />
                        {guest.email}
                      </span>
                    )}
                    {guest.phone && (
                      <span className="inline-flex items-center gap-1 text-gray-600 text-xs">
                        <Phone className="w-3 h-3" />
                        {guest.phone}
                      </span>
                    )}
                    {!guest.email && !guest.phone && (
                      <span className="text-gray-400 text-xs">--</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {sideLabels[guest.side] ?? guest.side}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {guest.group_name || '--'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={rsvpBadgeVariant[guest.rsvp_status] ?? 'default'}>
                    {guest.rsvp_status.charAt(0).toUpperCase() + guest.rsvp_status.slice(1)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {guest.meal_choice
                    ? guest.meal_choice.charAt(0).toUpperCase() + guest.meal_choice.slice(1)
                    : '--'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(guest)}
                      aria-label={`Edit ${guest.full_name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(guest)}
                      aria-label={`Delete ${guest.full_name}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
