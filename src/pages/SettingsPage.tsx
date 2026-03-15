import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useWedding } from '@/contexts/WeddingContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/config/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Save, UserPlus, Copy, Check } from 'lucide-react';

interface WeddingSettingsData {
  partner1_name: string;
  partner2_name: string;
  wedding_date: string;
  overall_budget: number;
  rsvp_deadline: string;
}

export default function SettingsPage() {
  const { wedding, refreshWedding } = useWedding();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<WeddingSettingsData>({
    defaultValues: {
      partner1_name: wedding?.partner1_name || '',
      partner2_name: wedding?.partner2_name || '',
      wedding_date: wedding?.wedding_date || '',
      overall_budget: wedding?.overall_budget || 0,
      rsvp_deadline: wedding?.rsvp_deadline || '',
    },
  });

  const onSubmit = async (data: WeddingSettingsData) => {
    if (!wedding) return;
    const { error } = await supabase
      .from('weddings')
      .update(data)
      .eq('id', wedding.id);
    if (error) throw error;
    await refreshWedding();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleJoinWedding = async () => {
    if (!joinCode.trim() || !user) return;
    setJoinError('');
    setJoinSuccess(false);

    const { data: weddingData, error } = await supabase
      .from('weddings')
      .select('id')
      .eq('invite_code', joinCode.trim())
      .single();

    if (error || !weddingData) {
      setJoinError('Invalid invite code. Please check and try again.');
      return;
    }

    const { error: memberError } = await supabase
      .from('wedding_members')
      .insert({
        wedding_id: weddingData.id,
        user_id: user.id,
        role: 'partner',
      });

    if (memberError) {
      setJoinError(memberError.message.includes('unique') ? 'You are already linked to this wedding.' : memberError.message);
      return;
    }

    setJoinSuccess(true);
    await refreshWedding();
  };

  const handleCopyCode = async () => {
    if (!wedding) return;
    await navigator.clipboard.writeText(wedding.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {wedding ? (
        <>
          <Card>
            <h2 className="text-lg font-semibold mb-4">Wedding Details</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Partner 1 Name" {...register('partner1_name')} />
                <Input label="Partner 2 Name" {...register('partner2_name')} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Wedding Date" type="date" {...register('wedding_date')} />
                <Input label="RSVP Deadline" type="date" {...register('rsvp_deadline')} />
              </div>
              <Input
                label="Overall Budget ($)"
                type="number"
                min={0}
                step={100}
                {...register('overall_budget', { valueAsNumber: true })}
              />
              <Button type="submit" loading={isSubmitting}>
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'Saved!' : 'Save Changes'}
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold mb-4">Partner Linking</h2>
            <p className="text-sm text-gray-500 mb-3">
              Share this invite code with your partner so they can join your wedding plan.
            </p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg mb-4">
              <code className="flex-1 text-lg font-mono tracking-wider">{wedding.invite_code}</code>
              <Button size="sm" variant="outline" onClick={handleCopyCode}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold">Join a Wedding</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Enter the invite code from your partner to join their wedding plan.
          </p>
          {joinError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
              {joinError}
            </div>
          )}
          {joinSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600 mb-4">
              Successfully joined! Refreshing...
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Enter invite code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleJoinWedding}>Join</Button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <div className="text-sm text-gray-500">
          <p>Signed in as: {user?.email}</p>
        </div>
      </Card>
    </div>
  );
}
