import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface LoginFormData {
  email: string;
  password: string;
}

export function LoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError('');
      await signIn(data.email, data.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-xl font-semibold text-center">Welcome Back</h2>
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
        <Input
          label="Password"
          type="password"
          placeholder="Your password"
          {...register('password', { required: true })}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Sign In
        </Button>
        <p className="text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
            Sign Up
          </Link>
        </p>
      </form>
    </Card>
  );
}
