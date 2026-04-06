import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface ForgotPasswordFormData {
  email: string;
}

export function ForgotPasswordForm() {
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ForgotPasswordFormData>();

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setError('');
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    }
  };

  if (sent) {
    return (
      <Card>
        <div className="text-center space-y-3 py-4">
          <h2 className="text-xl font-semibold">Check Your Email</h2>
          <p className="text-sm text-gray-500">
            We've sent a password reset link to your email address. Click the link to set a new password.
          </p>
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium text-sm">
            Back to Sign In
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-xl font-semibold text-center">Reset Password</h2>
        <p className="text-sm text-gray-500 text-center">
          Enter your email and we'll send you a link to reset your password.
        </p>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          {...register('email', { required: true })}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Send Reset Link
        </Button>
        <p className="text-center text-sm text-gray-500">
          Remember your password?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Sign In
          </Link>
        </p>
      </form>
    </Card>
  );
}
