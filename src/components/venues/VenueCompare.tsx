import { MapPin, Users, DollarSign, User, Mail, Phone, Package } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/formatters';
import type { Venue } from '@/types/database';

interface VenueCompareProps {
  venues: Venue[];
}

interface ComparisonRow {
  label: string;
  icon: React.ReactNode;
  render: (venue: Venue) => React.ReactNode;
}

const comparisonRows: ComparisonRow[] = [
  {
    label: 'Address',
    icon: <MapPin className="w-4 h-4" />,
    render: (v) => v.address || '--',
  },
  {
    label: 'Capacity',
    icon: <Users className="w-4 h-4" />,
    render: (v) => (v.capacity != null ? `${v.capacity} guests` : '--'),
  },
  {
    label: 'Cost',
    icon: <DollarSign className="w-4 h-4" />,
    render: (v) => (v.cost != null ? formatCurrency(v.cost) : '--'),
  },
  {
    label: 'Contact',
    icon: <User className="w-4 h-4" />,
    render: (v) => v.contact_name || '--',
  },
  {
    label: 'Email',
    icon: <Mail className="w-4 h-4" />,
    render: (v) =>
      v.contact_email ? (
        <a href={`mailto:${v.contact_email}`} className="text-primary-600 hover:underline break-all">
          {v.contact_email}
        </a>
      ) : (
        '--'
      ),
  },
  {
    label: 'Phone',
    icon: <Phone className="w-4 h-4" />,
    render: (v) =>
      v.contact_phone ? (
        <a href={`tel:${v.contact_phone}`} className="text-primary-600 hover:underline">
          {v.contact_phone}
        </a>
      ) : (
        '--'
      ),
  },
  {
    label: 'Notes',
    icon: null,
    render: (v) => v.notes || '--',
  },
  {
    label: 'Packages',
    icon: <Package className="w-4 h-4" />,
    render: (v) =>
      v.packages && v.packages.length > 0 ? (
        <div className="space-y-1.5">
          {v.packages.map((pkg, i) => (
            <div key={i} className="bg-gray-50 rounded px-2 py-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{pkg.name}</span>
                {pkg.price != null && (
                  <span className="text-gray-500">{formatCurrency(pkg.price)}</span>
                )}
              </div>
              {pkg.description && (
                <p className="text-xs text-gray-500 mt-0.5">{pkg.description}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        '--'
      ),
  },
];

export function VenueCompare({ venues }: VenueCompareProps) {
  if (venues.length === 0) {
    return (
      <Card>
        <p className="text-center text-gray-500">Select venues to compare.</p>
      </Card>
    );
  }

  // Column width based on number of venues
  const colWidth = venues.length === 2 ? 'w-1/2' : 'w-1/3';

  return (
    <Card padding={false} className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        {/* Header: Venue names + photos */}
        <thead>
          <tr className="border-b">
            <th className="text-left p-4 w-32 text-gray-500 font-medium align-bottom">Venue</th>
            {venues.map((venue) => (
              <th key={venue.id} className={`p-4 text-left align-bottom ${colWidth}`}>
                <div className="space-y-2">
                  {venue.photo_urls?.length > 0 && (
                    <img
                      src={venue.photo_urls[0]}
                      alt={venue.name}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-base">{venue.name}</span>
                    {venue.is_selected && <Badge variant="success">Selected</Badge>}
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Comparison Rows */}
        <tbody>
          {comparisonRows.map((row) => (
            <tr key={row.label} className="border-b last:border-b-0">
              <td className="p-4 text-gray-500 font-medium align-top">
                <div className="flex items-center gap-2">
                  {row.icon}
                  <span>{row.label}</span>
                </div>
              </td>
              {venues.map((venue) => (
                <td key={venue.id} className="p-4 text-gray-700 align-top">
                  {row.render(venue)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
