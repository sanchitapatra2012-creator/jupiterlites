import React, { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { EcoDnaLogo } from '../components/EcoDnaLogo';
import { useAuth } from '../context/AuthContext';

interface AuthPageProps {
  initialMode: 'login' | 'register';
  onBackHome: () => void;
  onSuccess: () => void;
}

function mapFirebaseAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in Firebase Console -> Authentication -> Sign-in method. Please enable Email/Password there, or use Google Sign-In below.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
    return 'Invalid email or password. Please verify your credentials.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Password must be at least 6 characters long.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in window was closed before completion.';
  }
  return msg;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode, onBackHome, onSuccess }) => {
  const { loginWithEmail, loginWithGoogle, registerWithEmail, sendResetEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'reset') {
      if (!email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      setBusy(true);
      try {
        await sendResetEmail(email);
        setNotice('Password reset instructions have been sent to your email.');
      } catch (err) {
        setError(mapFirebaseAuthError(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'register') {
      if (fullName.trim().length < 2) {
        setError('Please enter your full name.');
        return;
      }
      if (!email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!acceptTerms) {
        setError('You must accept the terms and scientific data policy to register.');
        return;
      }
      setBusy(true);
      try {
        await registerWithEmail({ fullName, email, password });
        onSuccess();
      } catch (err) {
        setError(mapFirebaseAuthError(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    // Login mode
    if (!email.includes('@') || !password) {
      setError('Email and password are required.');
      return;
    }
    setBusy(true);
    try {
      await loginWithEmail({ email, password, rememberMe });
      onSuccess();
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await loginWithGoogle(rememberMe);
      onSuccess();
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAF9] flex flex-col lg:flex-row">
      {/* Left Scientific Brand Column */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#061B14] text-white p-12 flex-col justify-between">
        <div>
          <button type="button" onClick={onBackHome} className="cursor-pointer">
            <EcoDnaLogo variant="light" size="lg" />
          </button>
        </div>

        <div className="space-y-5 max-w-md">
          <p className="text-xs font-mono text-teal-300">Researcher Authentication · Problem Statement 25042</p>
          <h1 className="font-display text-3xl font-bold leading-tight">
            Secure workspace for environmental DNA taxonomy and biodiversity indexing
          </h1>
          <p className="text-sm text-emerald-100/80 leading-relaxed">
            Every uploaded FASTA, FASTQ, and CSV dataset is stored privately under your verified researcher UID,
            processed through deterministic QC, and archived for reproducible reporting.
          </p>
        </div>

        <p className="text-xs text-emerald-300/70">
          Firebase Authentication · Cloud Firestore · Private Dataset Storage
        </p>
      </div>

      {/* Right Auth Form Column */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#061B14] cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Home</span>
            </button>
            <div className="lg:hidden">
              <EcoDnaLogo variant="dark" size="sm" />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="font-display text-2xl font-bold text-[#061B14]">
              {mode === 'login'
                ? 'Researcher Sign In'
                : mode === 'register'
                  ? 'Create Researcher Account'
                  : 'Reset Password'}
            </h2>
            <p className="text-sm text-slate-600">
              {mode === 'login'
                ? 'Access your eDNA datasets, taxonomic tables, and reports.'
                : mode === 'register'
                  ? 'Register to upload eDNA sequence files and run biodiversity analyses.'
                  : 'Enter your registered email address to receive a password reset link.'}
            </p>
          </div>

          {mode !== 'reset' && (
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setNotice(null);
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'login' ? 'bg-white text-[#061B14] shadow-sm' : 'text-slate-600'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setNotice(null);
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'register' ? 'bg-white text-[#061B14] shadow-sm' : 'text-slate-600'
                }`}
              >
                Register
              </button>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 leading-relaxed">
              {error}
            </div>
          )}

          {notice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 leading-relaxed">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Maya Lin"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@university.edu"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            )}

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>
                    I accept the EcoDNA Terms of Service and confirm uploaded genetic datasets comply with biodiversity
                    research ethics.
                  </span>
                </label>
              </>
            )}

            {mode === 'login' && (
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    setError(null);
                    setNotice(null);
                  }}
                  className="text-emerald-700 font-medium hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                    ? 'Create Account'
                    : 'Send Password Reset Email'}
              </span>
            </button>
          </form>

          {mode === 'reset' ? (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setNotice(null);
              }}
              className="w-full text-center text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
            >
              Return to Sign In
            </button>
          ) : (
            <>
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200" />
                <span className="shrink mx-3 text-xs text-slate-400">or continue with</span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleGoogleSignIn()}
                className="w-full py-2.5 bg-white border border-slate-300 text-slate-800 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2.5"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Google Sign-In</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
