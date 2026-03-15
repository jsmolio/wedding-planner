import { useQuery } from '@tanstack/react-query';
import { useWedding } from '@/contexts/WeddingContext';
import { queryKeys } from '@/lib/queryKeys';
import { fetchGuests } from '@/lib/queries/guests';
import { fetchRsvpTokens } from '@/lib/queries/rsvp';
import { RsvpLinkGenerator } from '@/components/rsvp/RsvpLinkGenerator';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Mail, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function RsvpPage() {
  const { weddingId } = useWedding();

  const { data: guests = [] } = useQuery({
    queryKey: queryKeys.guests(weddingId!),
    queryFn: () => fetchGuests(weddingId!),
    enabled: !!weddingId,
  });

  const { data: tokens = [] } = useQuery({
    queryKey: queryKeys.rsvpTokens(weddingId!),
    queryFn: () => fetchRsvpTokens(weddingId!),
    enabled: !!weddingId,
  });

  if (!weddingId) return null;

  const accepted = guests.filter((g) => g.rsvp_status === 'accepted').length;
  const declined = guests.filter((g) => g.rsvp_status === 'declined').length;
  const pending = guests.filter((g) => g.rsvp_status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">RSVP Manager</h1>
        <p className="text-gray-500 text-sm mt-1">Generate and manage RSVP links for your guests</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{accepted}</p>
              <p className="text-sm text-gray-500">Accepted</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{declined}</p>
              <p className="text-sm text-gray-500">Declined</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pending}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold">RSVP Links</h2>
        </div>
        <RsvpLinkGenerator guests={guests} tokens={tokens} weddingId={weddingId} />
      </Card>

      {/* Guest RSVP Status Table */}
      <Card padding={false}>
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Guest Responses</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Dietary</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Meal</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {guests.map((guest) => (
                <tr key={guest.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{guest.full_name}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        guest.rsvp_status === 'accepted' ? 'success' :
                        guest.rsvp_status === 'declined' ? 'danger' : 'warning'
                      }
                    >
                      {guest.rsvp_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {guest.dietary_restrictions || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {guest.meal_choice || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-xs truncate">
                    {guest.rsvp_message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
