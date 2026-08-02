'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRecaptcha } from '@/hooks/useRecaptcha';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getToken, verifying } = useRecaptcha();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email) {
      setError('Email is required');
      setIsLoading(false);
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      setIsLoading(false);
      return;
    }

    // reCAPTCHA verification
    const isHuman = await getToken('forgot_password');
    if (!isHuman) {
      setError('Security verification failed. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      const { supabase } = await import('@/lib/supabase');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/login`,
      });
      if (resetError) {
        console.error('[forgot-password]', resetError.message);
        const msg = (resetError.message || '').toLowerCase();
        if (msg.includes('not configured') || msg.includes('not implemented') || msg.includes('501')) {
          setError(
            'Password reset email is not available yet. Please contact the restaurant to reset your password.'
          );
          return;
        }
      }
      // Generic success avoids email enumeration when the provider accepts the request.
      setIsSubmitted(true);
    } catch (err) {
      console.error('[forgot-password]', err);
      setError('Unable to start password reset. Please try again or contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-[#fdf9ec] rounded-full mx-auto mb-6">
              <i className="ri-mail-send-line text-3xl text-[#C8952A]"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Check Your Email</h1>
            <p className="text-gray-600 mb-6">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-8">
              If you don't receive an email within a few minutes, please check your spam folder.
            </p>
            <Link
              href="/auth/login"
              className="inline-block bg-[#111111] hover:bg-[#111111] text-white px-8 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Reset Password</h1>
          <p className="text-gray-600">Enter your email to receive a reset link</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] ${
                  error ? 'border-[#C8952A]' : 'border-gray-300'
                }`}
                placeholder="you@example.com"
              />
              {error && (
                <p className="text-sm text-[#C8952A] mt-2">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || verifying}
              className="w-full bg-[#111111] hover:bg-[#111111] text-white py-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isLoading || verifying ? (verifying ? 'Verifying...' : 'Sending...') : 'Send Reset Link'}
            </button>
          </form>

          <p className="mt-8 text-center text-gray-600">
            Remember your password?{' '}
            <Link href="/auth/login" className="text-[#C8952A] hover:text-[#7a5418] font-semibold whitespace-nowrap">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap">
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
