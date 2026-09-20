import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';
import type { UserRole } from '../types/auth.types';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { getPasswordValidation } from '../utils/password.utils';
import {
  Loader2,
  Mail,
  Lock,
  User,
  AlertCircle,
  Shield,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin }) => {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('DEVELOPER');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((state) => state.login);

  // Step 1: Validate details and send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = getPasswordValidation(password);
    if (!validation.isStrong) {
      setError('Password is too weak. Please meet all complexity requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await authApi.sendRegisterOtp({ email });
      setStep('otp');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send verification code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Complete registration with OTP
  const handleCompleteRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.register({
        name,
        email,
        password,
        role,
        otp: otp.trim(),
      });
      login(response.data.accessToken, response.data.refreshToken, response.data.user);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="space-y-3.5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Details */}
      {step === 'details' && (
        <form onSubmit={handleSendOtp} className="space-y-3.5">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Mercer"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@acme.inc"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, 1 uppercase, 1 special..."
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <PasswordStrengthMeter password={password} />
          </div>

          {/* Confirm Password */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Confirm Password</label>
              {passwordsMatch && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                  <CheckCircle2 className="size-3" /> Passwords match
                </span>
              )}
              {passwordsMismatch && (
                <span className="text-[11px] text-destructive font-medium">
                  Passwords do not match
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={`w-full rounded-lg border py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 ${
                  passwordsMismatch
                    ? 'border-destructive focus:border-destructive focus:ring-destructive'
                    : 'border-border bg-background focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              />
            </div>
          </div>

          {/* Role */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Role</label>
            <div className="relative">
              <Shield className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="DEVELOPER">Developer</option>
                <option value="BUSINESS_USER">Business User</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium py-2.5 h-9 mt-3"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
            <span>{loading ? 'Sending code...' : 'Continue to Verification'}</span>
          </Button>

          {onSwitchToLogin && (
            <div className="text-center text-xs text-muted-foreground pt-1">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Sign in
              </button>
            </div>
          )}
        </form>
      )}

      {/* STEP 2: OTP Verification */}
      {step === 'otp' && (
        <form onSubmit={handleCompleteRegister} className="space-y-3.5">
          {/* Back button */}
          <button
            type="button"
            onClick={() => setStep('details')}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to account details</span>
          </button>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Verify Your Email</h3>
            <p className="text-xs text-muted-foreground mt-1">
              We&apos;ve sent a 6-digit verification code to <strong className="text-foreground">{email}</strong>.
            </p>
          </div>

          {/* OTP Code */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Verification Code</label>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Resend code
              </button>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs tracking-widest font-mono text-foreground placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium py-2.5 h-9 mt-3"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
            <span>{loading ? 'Verifying...' : 'Verify & Complete Registration'}</span>
          </Button>
        </form>
      )}
    </div>
  );
};
