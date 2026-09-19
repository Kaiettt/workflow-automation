import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authApi } from '../api/auth.api';
import { PasswordStrengthMeter, getPasswordValidation } from './PasswordStrengthMeter';
import {
  Mail,
  Lock,
  KeyRound,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  onBackToLogin: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onSuccess,
  onBackToLogin,
}) => {
  const [step, setStep] = useState<'request-otp' | 'reset' | 'success'>('request-otp');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.forgotPassword({ email });
      setStep('reset');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send verification code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = getPasswordValidation(newPassword);
    if (!validation.isStrong) {
      setError('New password is too weak. Please meet all complexity requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword({
        email,
        otp: otp.trim(),
        newPassword,
      });
      setStep('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        type="button"
        onClick={onBackToLogin}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        <span>Back to Sign In</span>
      </button>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Request OTP */}
      {step === 'request-otp' && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Reset Password</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your registered email address to receive a 6-digit verification code.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@flowpilot.local"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium py-2.5 h-9"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
            <span>{loading ? 'Sending Code...' : 'Send Verification Code'}</span>
          </Button>
        </form>
      )}

      {/* STEP 2: Enter OTP & New Password */}
      {step === 'reset' && (
        <form onSubmit={handleResetPassword} className="space-y-3.5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Set New Password</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Enter the 6-digit code sent to <strong className="text-foreground">{email}</strong>.
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

          {/* New Password */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, 1 uppercase, 1 special..."
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <PasswordStrengthMeter password={newPassword} />
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Confirm New Password</label>
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
                placeholder="Re-enter your new password"
                className={`w-full rounded-lg border py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 ${
                  passwordsMismatch
                    ? 'border-destructive focus:border-destructive focus:ring-destructive'
                    : 'border-border bg-background focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium py-2.5 h-9 mt-3"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
            <span>{loading ? 'Resetting Password...' : 'Reset Password'}</span>
          </Button>
        </form>
      )}

      {/* STEP 3: Success State */}
      {step === 'success' && (
        <div className="space-y-4 text-center py-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Password Reset Successfully</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Your password has been updated. You can now sign in with your new credentials.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              onSuccess?.();
              onBackToLogin();
            }}
            className="w-full rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium py-2 h-9"
          >
            Sign In Now
          </Button>
        </div>
      )}
    </div>
  );
};
