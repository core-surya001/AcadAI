'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { login, register, googleLogin } from '@/lib/api';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

type Tab = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'admin'>('teacher');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [toast, setToast] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const gsiScriptLoaded = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Handle Google credential response
  const handleGoogleResponse = useCallback(async (response: { credential: string }) => {
    setGoogleLoading(true);
    setError('');
    try {
      await googleLogin(response.credential);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed. Try again.';
      setError(message);
    } finally {
      setGoogleLoading(false);
    }
  }, [router]);

  // Load Google GSI script
  useEffect(() => {
    if (gsiScriptLoaded.current || !GOOGLE_CLIENT_ID) return;
    gsiScriptLoaded.current = true;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
    };
    document.body.appendChild(script);

    return () => {
      // cleanup not strictly needed but good practice
    };
  }, [handleGoogleResponse]);

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      showToast('Google Client ID not configured. Check .env.local');
      return;
    }
    if (window.google) {
      window.google.accounts.id.prompt();
    } else {
      showToast('Google Sign-In is loading, please try again...');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (tab === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'signup') {
        await register(name || email.split('@')[0], email, password, role);
      } else {
        await login(email, password);
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e8eaf0] flex items-center justify-center p-6 overflow-x-hidden relative">
      {/* Decorative blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[35%] h-[35%] rounded-full bg-indigo-200/40 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[35%] h-[35%] rounded-full bg-purple-200/40 blur-[120px] pointer-events-none" />

      <main className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
        {/* Left: branding */}
        <div className="hidden md:flex flex-col space-y-8 pr-12">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl neo-raised flex items-center justify-center bg-[#e8eaf0]">
              <span className="material-symbols-outlined icon-filled text-indigo-600 text-3xl">school</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">AcadAI</h1>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl font-bold text-slate-800 leading-tight">
              Intelligence for the <br />
              <span className="text-indigo-600">Next Generation</span> of Educators.
            </h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Streamline administrative tasks and gain AI-powered student insights. Designed for modern institutions.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: 'analytics',     label: 'Smart Reports',   color: 'text-purple-600' },
              { icon: 'cloud_upload',  label: 'Data Sync',       color: 'text-indigo-600' },
              { icon: 'psychology',    label: 'AI Predictions',  color: 'text-indigo-600' },
              { icon: 'group',         label: 'Student Insights', color: 'text-purple-600' },
            ].map(({ icon, label, color }) => (
              <div key={label} className="p-4 rounded-xl neo-raised flex flex-col space-y-2 hover:-translate-y-1 transition-transform">
                <span className={`material-symbols-outlined ${color}`}>{icon}</span>
                <span className="text-sm font-semibold text-slate-700">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: auth card */}
        <div className="w-full">
          {/* Tab switch */}
          <div className="flex items-center justify-center mb-8">
            <div className="neo-inset p-2 rounded-xl flex space-x-2 bg-[#e8eaf0]">
              {(['login', 'signup'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); }}
                  className={`px-8 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                    tab === t ? 'neo-raised text-indigo-600' : 'text-slate-500 hover:text-indigo-500'
                  }`}
                >
                  {t === 'login' ? 'Login' : 'Sign Up'}
                </button>
              ))}
            </div>
          </div>

          <div className="neo-raised rounded-3xl p-8 md:p-10 space-y-8 bg-[#e8eaf0]">
            <div className="space-y-1 text-center">
              <h3 className="text-2xl font-bold text-slate-800">
                {tab === 'login' ? 'Welcome Back' : 'Create Account'}
              </h3>
              <p className="text-slate-500 text-sm">
                {tab === 'login'
                  ? 'Please enter your details to access your dashboard.'
                  : 'Fill in your details to set up your institutional account.'}
              </p>
            </div>

            {error && (
              <div className="neo-inset rounded-xl px-4 py-3 bg-red-50 flex items-center gap-3">
                <span className="material-symbols-outlined text-red-500 text-base">error</span>
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Role selector (signup only) */}
              {tab === 'signup' && (
                <div className="grid grid-cols-2 gap-4">
                  {(['teacher', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`p-4 rounded-xl flex flex-col space-y-2 transition-all border-2 ${
                        role === r
                          ? 'neo-inset border-indigo-400 text-indigo-600'
                          : 'neo-raised border-transparent text-slate-500 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="material-symbols-outlined">{r === 'teacher' ? 'person' : 'admin_panel_settings'}</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${role === r ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                          {role === r && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <span className="text-sm font-bold capitalize">{r}</span>
                      <span className="text-xs text-left">{r === 'teacher' ? 'Manage classes & students' : 'Full system oversight'}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Full Name (signup only) */}
              {tab === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                  <div className="relative flex items-center neo-inset rounded-xl">
                    <span className="material-symbols-outlined absolute left-4 text-slate-400">badge</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Your full name"
                      className="w-full bg-transparent border-none outline-none py-4 pl-12 pr-4 text-sm text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
                <div className="relative flex items-center neo-inset rounded-xl">
                  <span className="material-symbols-outlined absolute left-4 text-slate-400">mail</span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="student@acadai.edu"
                    className="w-full bg-transparent border-none outline-none py-4 pl-12 pr-4 text-sm text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                  {tab === 'login' && (
                    <button type="button" className="text-xs font-semibold text-indigo-600 hover:underline">Forgot password?</button>
                  )}
                </div>
                <div className="relative flex items-center neo-inset rounded-xl">
                  <span className="material-symbols-outlined absolute left-4 text-slate-400">lock</span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-transparent border-none outline-none py-4 pl-12 pr-12 text-sm text-slate-700 placeholder:text-slate-400"
                  />
                  <button type="button" className="absolute right-4 text-slate-400 hover:text-indigo-600 transition-colors" onClick={() => setShowPassword(!showPassword)}>
                    <span className="material-symbols-outlined text-base">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {/* Confirm password (signup only) */}
              {tab === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm Password</label>
                  <div className="relative flex items-center neo-inset rounded-xl">
                    <span className="material-symbols-outlined absolute left-4 text-slate-400">lock_reset</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-transparent border-none outline-none py-4 pl-12 pr-4 text-sm text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              {/* Remember me */}
              {tab === 'login' && (
                <div className="flex items-center space-x-3 px-1">
                  <button
                    type="button"
                    onClick={() => setRemember(!remember)}
                    className={`w-5 h-5 neo-inset rounded flex items-center justify-center transition-all ${remember ? 'bg-indigo-100' : ''}`}
                  >
                    {remember && <span className="material-symbols-outlined text-indigo-600 text-[14px]">check</span>}
                  </button>
                  <span className="text-sm text-slate-500 font-medium">Remember me for 30 days</span>
                </div>
              )}

              {/* Submit */}
              <button
                id="submit-auth"
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl neo-raised text-indigo-600 font-bold text-base hover:neo-inset active:scale-[0.98] transition-all flex items-center justify-center space-x-2 group disabled:opacity-60"
              >
                <span>{loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}</span>
                {!loading && (
                  <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">arrow_forward</span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#e8eaf0] px-4 text-slate-400 font-medium tracking-widest">Or continue with</span>
              </div>
            </div>

            {/* Google OAuth */}
            <button
              id="google-signin-btn"
              type="button"
              onClick={handleGoogleClick}
              disabled={googleLoading}
              className="w-full flex items-center justify-center space-x-3 py-3.5 rounded-xl neo-raised hover:-translate-y-0.5 transition-all disabled:opacity-60"
            >
              {googleLoading ? (
                <span className="text-sm font-semibold text-slate-500">Signing in…</span>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  <span className="text-sm font-semibold text-slate-700">Continue with Google</span>
                </>
              )}
            </button>

            <p className="text-center text-slate-500 text-sm">
              {tab === 'login' ? "New to AcadAI? " : "Already have an account? "}
              <button className="text-indigo-600 font-bold hover:underline" onClick={() => setTab(tab === 'login' ? 'signup' : 'login')}>
                {tab === 'login' ? 'Create an institutional account' : 'Sign in instead'}
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="neo-raised rounded-xl px-6 py-3 flex items-center gap-3 bg-[#e8eaf0] shadow-lg">
            <span className="material-symbols-outlined text-indigo-600">info</span>
            <span className="text-sm font-semibold text-slate-700">{toast}</span>
            <button onClick={() => setToast('')} className="text-slate-400 hover:text-slate-600 ml-2">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      )}

      <footer className="fixed bottom-6 left-0 w-full text-center px-6 pointer-events-none">
        <p className="text-slate-400 text-xs font-medium tracking-wide">
          © 2024 AcadAI Educational Technologies.{' '}
          <span className="hidden md:inline mx-2">•</span>
          <a className="hover:text-indigo-600 pointer-events-auto" href="#">Privacy Policy</a>
          <span className="mx-2">•</span>
          <a className="hover:text-indigo-600 pointer-events-auto" href="#">Terms of Service</a>
        </p>
      </footer>
    </div>
  );
}
