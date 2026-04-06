import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWedding } from '@/contexts/WeddingContext';
import { supabase } from '@/config/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { ClementineLogo } from '@/components/ui/Logo';

interface SignupFormData {
  fullName: string;
  email: string;
  password: string;
  partnerName: string;
}

export function SignupForm() {
  const { signUp } = useAuth();
  const { refreshWedding } = useWedding();
  const [error, setError] = useState('');
  const [settingUp, setSettingUp] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<SignupFormData>();

  const onSubmit = async (data: SignupFormData) => {
    try {
      setError('');
      await signUp(data.email, data.password, data.fullName);

      // Wait for session to be established
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please check your email to confirm your account, then sign in.');
        return;
      }

      // Show loading screen while setting up
      setSettingUp(true);

      // Create wedding + membership + seed data via RPC (bypasses RLS)
      const { error: rpcError } = await supabase.rpc('setup_new_wedding', {
        p_partner1_name: data.fullName,
        p_partner2_name: data.partnerName || 'Partner',
      });

      if (rpcError) throw rpcError;

      await refreshWedding();
      // Full reload ensures all contexts pick up the new wedding
      window.location.href = '/dashboard';
    } catch (err) {
      setSettingUp(false);
      setError(err instanceof Error ? err.message : 'Failed to create account');
    }
  };

  if (settingUp) {
    return (
      <Card>
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 rounded-full bg-accent-100 text-accent-500 flex items-center justify-center mx-auto animate-pulse">
            <ClementineLogo className="w-10 h-10" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Setting up your wedding</h3>
            <p className="text-sm text-gray-500 mt-1">Clementine is preparing everything for you...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-xl font-semibold text-center">Let's plan your wedding</h2>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
        <Input
          label="Your Name"
          placeholder="Your full name"
          {...register('fullName', { required: true })}
        />
        <Input
          label="Partner's Name"
          placeholder="Your partner's name"
          {...register('partnerName')}
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          {...register('email', { required: true })}
        />
        <Input
          label="Password"
          type="password"
          placeholder="At least 6 characters"
          {...register('password', { required: true, minLength: 6 })}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Create Account
        </Button>
        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Sign In
          </Link>
        </p>
      </form>
    </Card>
  );
}
