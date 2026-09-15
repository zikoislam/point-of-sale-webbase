'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useBranding } from '../../hooks/useBranding';
import {
  Store,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  KeyRound,
  Mail,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';
import { apiClient } from '../../lib/api-client';
import { SOFTWARE_CREDIT } from '../../lib/constants';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const branding = useBranding();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  // Forgot-password flow: ask for a code, then exchange it for a new password
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'done'>('request');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');

  // Redirect once auth check is done and user is already logged in
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && user) {
      if (user.role === 'CASHIER') {
        router.replace('/pos');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  // While session is being verified, show a clean loading screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-center items-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" color="primary" />
          <p className="text-slate-400 text-sm font-medium animate-pulse">Checking session...</p>
        </div>
      </div>
    );
  }

  // Already authenticated — show nothing while redirecting
  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const loggedUser = await login(username.trim(), password, rememberMe);
      if (loggedUser.role === 'CASHIER') {
        router.replace('/pos');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      if (err.statusCode === 429 || err.code === 'RATE_LIMIT_EXCEEDED') {
        setErrorMsg('Too many attempts. Please try again later.');
      } else if (
        err.statusCode === 401 ||
        err.code === 'UNAUTHORIZED' ||
        err.code === 'INVALID_CREDENTIALS'
      ) {
        setErrorMsg('Invalid username or password.');
      } else if (err.code === 'TIMEOUT' || err.code === 'NETWORK_ERROR') {
        setErrorMsg('Cannot connect to server. Please check your connection.');
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const openForgotHelp = () => {
    setForgotStep('request');
    setForgotUsername(username); // whatever they already typed on the form
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotError('');
    setForgotMaskedEmail('');
    setShowForgotHelp(true);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) {
      setForgotError('Enter your username or email.');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    try {
      const res = await apiClient<{ sent: boolean; maskedEmail: string }>(
        '/auth/forgot-password',
        { method: 'POST', body: JSON.stringify({ username: forgotUsername.trim() }) }
      );
      setForgotMaskedEmail(res.data?.maskedEmail || '');
      setForgotStep('verify');
    } catch (err: any) {
      setForgotError(err?.message || 'Could not send the reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(forgotOtp.trim())) {
      setForgotError('The reset code is 6 digits.');
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotError('Password must be at least 6 characters.');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    try {
      await apiClient('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          username: forgotUsername.trim(),
          otp: forgotOtp.trim(),
          newPassword: forgotNewPassword,
        }),
      });
      setForgotStep('done');
    } catch (err: any) {
      setForgotError(err?.message || 'Could not reset the password.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Dynamic Background Glow Elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.shopName}
              className="inline-block w-16 h-16 rounded-2xl object-contain bg-white p-1.5 shadow-xl mb-4 ring-4 ring-blue-500/20"
            />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-xl shadow-blue-600/25 mb-4 ring-4 ring-blue-500/20">
              <Store className="w-8 h-8" />
            </div>
          )}
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{branding.shopName || 'Smart Retail POS'}</h1>
          <p className="text-sm text-slate-400 mt-1">Enterprise Cloud Shop &amp; Inventory Management</p>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Sign In</h2>
            <p className="text-xs text-slate-400 mt-0.5">Enter your credentials to access the terminal</p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                />
                <span>Remember me on this terminal (30 days)</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" color="white" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Passwords are reset by a manager or admin — no self-service here */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={openForgotHelp}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Forgot password?
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 mt-6">
          🔒 Secure 256-bit TLS encrypted session · Multi-Document ACID compliant
        </p>

        {/* Software credit */}
        <div className="text-center mt-4 space-y-1">
          <p className="text-xs text-slate-400">
            Software by{' '}
            <span className="font-semibold text-slate-300">{SOFTWARE_CREDIT.company}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            Developer: <span className="text-slate-400">{SOFTWARE_CREDIT.developer}</span>
            {' · '}
            <a
              href={`tel:${SOFTWARE_CREDIT.phone}`}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              {SOFTWARE_CREDIT.phone}
            </a>
          </p>
        </div>
      </div>

      {/* Forgot password */}
      {showForgotHelp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-400" />
                {forgotStep === 'done' ? 'Password updated' : 'Forgot password?'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotHelp(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotError && (
              <div className="mx-5 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotStep === 'request' && (
              <form onSubmit={handleRequestOtp} className="p-5 space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  We will email a 6-digit code to the recovery address. Enter that code on
                  the next screen to set a new password.
                </p>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Username or Email
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition flex items-center justify-center gap-2"
                >
                  {forgotLoading ? <Spinner size="sm" color="white" /> : <Mail className="w-4 h-4" />}
                  <span>{forgotLoading ? 'Sending...' : 'Send reset code'}</span>
                </button>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  No access to that email? Ask your manager or the administrator — they can
                  set a new password for you from{' '}
                  <span className="text-slate-400">Users</span>. Or call{' '}
                  <a
                    href={`tel:${SOFTWARE_CREDIT.phone}`}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {SOFTWARE_CREDIT.phone}
                  </a>
                  .
                </p>
              </form>
            )}

            {forgotStep === 'verify' && (
              <form onSubmit={handleResetPassword} className="p-5 space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  {forgotMaskedEmail ? (
                    <>
                      A 6-digit code was sent to{' '}
                      <span className="text-slate-200 font-semibold">{forgotMaskedEmail}</span>
                      . It expires in 10 minutes.
                    </>
                  ) : (
                    <>If that account exists, a 6-digit code has been sent. It expires in 10 minutes.</>
                  )}
                </p>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Reset code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.5em] font-mono text-lg px-3 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    New password
                  </label>
                  <input
                    type="password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition flex items-center justify-center gap-2"
                >
                  {forgotLoading ? <Spinner size="sm" color="white" /> : <KeyRound className="w-4 h-4" />}
                  <span>{forgotLoading ? 'Saving...' : 'Set new password'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setForgotStep('request');
                    setForgotError('');
                  }}
                  className="w-full text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Use a different account
                </button>
              </form>
            )}

            {forgotStep === 'done' && (
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-300 leading-relaxed">
                    Your password has been changed. Sign in with the new one.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotHelp(false);
                    setPassword('');
                  }}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
                >
                  Back to sign in
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
