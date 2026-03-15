import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchRsvpByToken, submitRsvp } from '@/lib/queries/rsvp';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Card } from '@/components/ui/Card';
import { Heart, Check, X } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import type { RsvpStatus } from '@/types/database';

interface GuestResponse {
  guest_id: string;
  rsvp_status: RsvpStatus;
  dietary_restrictions: string;
  meal_choice: string;
  plus_one_name: string;
  rsvp_message: string;
}

export function RsvpPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [responses, setResponses] = useState<Map<string, GuestResponse>>(new Map());

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.rsvpPublic(token!),
    queryFn: () => fetchRsvpByToken(token!),
    enabled: !!token,
  });

  const updateResponse = (guestId: string, field: keyof GuestResponse, value: string) => {
    setResponses((prev) => {
      const next = new Map(prev);
      const current = next.get(guestId) || {
        guest_id: guestId,
        rsvp_status: 'pending' as RsvpStatus,
        dietary_restrictions: '',
        meal_choice: '',
        plus_one_name: '',
        rsvp_message: '',
      };
      next.set(guestId, { ...current, [field]: value });
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!data) return;
    const rsvpResponses: Array<{
      guest_id: string;
      rsvp_status: 'accepted' | 'declined';
      dietary_restrictions: string;
      meal_choice: string;
      plus_one_name: string;
      rsvp_message: string;
    }> = [];

    for (const guest of data.guests) {
      const resp = responses.get(guest.id);
      if (!resp || !resp.rsvp_status || resp.rsvp_status === 'pending') {
        setError('Please accept or decline for each guest.');
        return;
      }
      rsvpResponses.push({
        guest_id: guest.id,
        rsvp_status: resp.rsvp_status as 'accepted' | 'declined',
        dietary_restrictions: resp.dietary_restrictions || '',
        meal_choice: resp.meal_choice || '',
        plus_one_name: resp.plus_one_name || '',
        rsvp_message: resp.rsvp_message || '',
      });
    }

    setSubmitting(true);
    setError('');
    try {
      await submitRsvp(token!, rsvpResponses);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50 p-4">
        <Card className="max-w-md text-center">
          <X className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Invalid RSVP Link</h2>
          <p className="text-gray-500">This link may have expired or is incorrect.</p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50 p-4">
        <Card className="max-w-md text-center">
          <Heart className="w-12 h-12 text-primary-500 fill-primary-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
          <p className="text-gray-600">
            Your RSVP has been submitted. {data.wedding.partner1_name} & {data.wedding.partner2_name} will be thrilled!
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <Heart className="w-10 h-10 text-primary-500 fill-primary-500 mx-auto mb-3" />
          <h1 className="text-3xl font-bold">
            {data.wedding.partner1_name} & {data.wedding.partner2_name}
          </h1>
          {data.wedding.wedding_date && (
            <p className="text-gray-500 mt-1">{formatDate(data.wedding.wedding_date)}</p>
          )}
          <p className="text-gray-600 mt-2">We would love to celebrate with you!</p>
          {data.wedding.rsvp_deadline && (
            <p className="text-sm text-gray-400 mt-1">
              Please respond by {formatDate(data.wedding.rsvp_deadline)}
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {data.guests.map((guest) => {
          const resp = responses.get(guest.id);
          return (
            <Card key={guest.id}>
              <h3 className="font-semibold text-lg mb-4">{guest.full_name}</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Will you be attending?
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={resp?.rsvp_status === 'accepted' ? 'primary' : 'outline'}
                      onClick={() => updateResponse(guest.id, 'rsvp_status', 'accepted')}
                      className="flex-1"
                    >
                      <Check className="w-4 h-4" /> Joyfully Accept
                    </Button>
                    <Button
                      type="button"
                      variant={resp?.rsvp_status === 'declined' ? 'danger' : 'outline'}
                      onClick={() => updateResponse(guest.id, 'rsvp_status', 'declined')}
                      className="flex-1"
                    >
                      <X className="w-4 h-4" /> Respectfully Decline
                    </Button>
                  </div>
                </div>

                {resp?.rsvp_status === 'accepted' && (
                  <>
                    {guest.has_plus_one && (
                      <Input
                        label="Plus One Name"
                        value={resp.plus_one_name}
                        onChange={(e) => updateResponse(guest.id, 'plus_one_name', e.target.value)}
                        placeholder="Guest name"
                      />
                    )}
                    <Input
                      label="Dietary Restrictions"
                      value={resp.dietary_restrictions}
                      onChange={(e) => updateResponse(guest.id, 'dietary_restrictions', e.target.value)}
                      placeholder="Any allergies or dietary needs?"
                    />
                    <Input
                      label="Meal Choice"
                      value={resp.meal_choice}
                      onChange={(e) => updateResponse(guest.id, 'meal_choice', e.target.value)}
                      placeholder="e.g., Chicken, Fish, Vegetarian"
                    />
                  </>
                )}

                <Textarea
                  label="Message to the Couple (optional)"
                  value={resp?.rsvp_message || ''}
                  onChange={(e) => updateResponse(guest.id, 'rsvp_message', e.target.value)}
                  placeholder="Congratulations and well wishes..."
                />
              </div>
            </Card>
          );
        })}

        <Button onClick={handleSubmit} loading={submitting} className="w-full" size="lg">
          Submit RSVP
        </Button>
      </div>
    </div>
  );
}
