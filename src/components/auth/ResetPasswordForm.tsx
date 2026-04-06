import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

export function ResetPasswordForm() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ResetPasswordFormData>();

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      setError('');
      if (data.password !== data.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) throw error;
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-xl font-semibold text-center">Set New Password</h2>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
        <Input
          label="New Password"
          type="password"
          placeholder="At least 6 characters"
          {...register('password', { required: true, minLength: 6 })}
        />
        <Input
          label="Confirm Password"
          type="password"
          placeholder="Repeat your password"
          {...register('confirmPassword', { required: true })}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Update Password
        </Button>
      </form>
    </Card>
  );
}
