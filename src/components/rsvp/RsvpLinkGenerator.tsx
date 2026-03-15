import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRsvpToken } from '@/lib/queries/rsvp';
import { queryKeys } from '@/lib/queryKeys';
import type { Guest, RsvpToken } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Link, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface RsvpLinkGeneratorProps {
  guests: Guest[];
  tokens: RsvpToken[];
  weddingId: string;
}

export function RsvpLinkGenerator({ guests, tokens, weddingId }: RsvpLinkGeneratorProps) {
  const queryClient = useQueryClient();
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const createTokenMutation = useMutation({
    mutationFn: () => createRsvpToken(weddingId, selectedGuests),
    onSuccess: (token) => {
      const link = `${window.location.origin}/rsvp/${token.token}`;
      setGeneratedLink(link);
      queryClient.invalidateQueries({ queryKey: queryKeys.rsvpTokens(weddingId) });
    },
  });

  const pendingGuests = guests.filter((g) => g.rsvp_status === 'pending');

  // Find which guests already have tokens
  const guestsWithTokens = new Set(tokens.flatMap((t) => t.guest_ids));

  const handleGenerate = () => {
    if (selectedGuests.length === 0) return;
    createTokenMutation.mutate();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateAll = () => {
    // Generate individual tokens for all pending guests without tokens
    const withoutTokens = pendingGuests.filter((g) => !guestsWithTokens.has(g.id));
    if (withoutTokens.length === 0) return;
    // Generate one by one
    Promise.all(
      withoutTokens.map((g) => createRsvpToken(weddingId, [g.id]))
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rsvpTokens(weddingId) });
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => setShowModal(true)}>
          <Link className="w-4 h-4" />
          Generate RSVP Link
        </Button>
        <Button variant="outline" onClick={handleGenerateAll}>
          Generate All Missing
        </Button>
      </div>

      {/* Existing tokens list */}
      <div className="space-y-2">
        {tokens.map((token) => {
          const tokenGuests = guests.filter((g) => token.guest_ids.includes(g.id));
          const link = `${window.location.origin}/rsvp/${token.token}`;
          return (
            <div key={token.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <span className="text-sm font-medium">
                  {tokenGuests.map((g) => g.full_name).join(', ')}
                </span>
                {token.is_used && (
                  <span className="ml-2 text-xs text-green-600 font-medium">Responded</span>
                )}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(link)}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
                title="Copy link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setGeneratedLink(''); setSelectedGuests([]); }} title="Generate RSVP Link">
        {generatedLink ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-600">Share this link with your guests:</p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <input
                readOnly
                value={generatedLink}
                className="flex-1 bg-transparent text-sm truncate"
              />
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex justify-center">
              <QRCodeSVG value={generatedLink} size={200} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Select guests for this RSVP link (household):</p>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {pendingGuests.map((guest) => (
                <label key={guest.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedGuests.includes(guest.id)}
                    onChange={(e) => {
                      setSelectedGuests(e.target.checked
                        ? [...selectedGuests, guest.id]
                        : selectedGuests.filter((id) => id !== guest.id)
                      );
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{guest.full_name}</span>
                  {guestsWithTokens.has(guest.id) && (
                    <span className="text-xs text-gray-400">(already has link)</span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleGenerate} loading={createTokenMutation.isPending} disabled={selectedGuests.length === 0}>
                Generate
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
