// pages/login.js — Sign in / Sign up / Forgot password

import { useState } from 'react';
import { useRouter } from 'next/router';
import { Cloud, Eye, EyeOff, Loader2 } from 'lucide-react';
import { signIn, signUp, confirmSignUp, forgotPassword, confirmForgotPassword } from '../utils/auth';
import toast, { Toaster } from 'react-hot-toast';

const VIEWS = { LOGIN: 'login', SIGNUP: 'signup', CONFIRM: 'confirm', FORGOT: 'forgot', RESET: 'reset' };

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState(VIEWS.LOGIN);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', code: '', newPassword: '' });

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(form.email, form.password);
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await signUp(form.email, form.password, form.name);
      toast.success('Check your email for a verification code');
      setView(VIEWS.CONFIRM);
    } catch (err) {
      toast.error(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await confirmSignUp(form.email, form.code);
      toast.success('Email verified! Please log in.');
      setView(VIEWS.LOGIN);
    } catch (err) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(form.email);
      toast.success('Reset code sent to your email');
      setView(VIEWS.RESET);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await confirmForgotPassword(form.email, form.code, form.newPassword);
      toast.success('Password reset! Please log in.');
      setView(VIEWS.LOGIN);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1f2937', color: '#fff' } }} />

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-2xl mb-3">
            <Cloud className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">CloudDrive</h1>
          <p className="text-gray-400 text-sm mt-1">Secure cloud storage</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-xl">

          {/* LOGIN */}
          {view === VIEWS.LOGIN && (
            <form onSubmit={handleLogin} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Welcome back</h2>
              <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
              <PasswordInput label="Password" value={form.password} onChange={set('password')}
                show={showPw} onToggle={() => setShowPw(!showPw)} />
              <button type="button" onClick={() => setView(VIEWS.FORGOT)}
                className="text-xs text-blue-400 hover:text-blue-300">
                Forgot password?
              </button>
              <SubmitButton loading={loading}>Sign in</SubmitButton>
              <p className="text-center text-sm text-gray-400">
                No account?{' '}
                <button type="button" onClick={() => setView(VIEWS.SIGNUP)} className="text-blue-400 hover:text-blue-300">
                  Sign up
                </button>
              </p>
            </form>
          )}

          {/* SIGN UP */}
          {view === VIEWS.SIGNUP && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Create account</h2>
              <Input label="Full name" value={form.name} onChange={set('name')} required />
              <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
              <PasswordInput label="Password (min 8 chars)" value={form.password} onChange={set('password')}
                show={showPw} onToggle={() => setShowPw(!showPw)} />
              <SubmitButton loading={loading}>Create account</SubmitButton>
              <p className="text-center text-sm text-gray-400">
                Already have an account?{' '}
                <button type="button" onClick={() => setView(VIEWS.LOGIN)} className="text-blue-400 hover:text-blue-300">
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* CONFIRM EMAIL */}
          {view === VIEWS.CONFIRM && (
            <form onSubmit={handleConfirm} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Verify your email</h2>
              <p className="text-sm text-gray-400">Enter the 6-digit code sent to <strong className="text-white">{form.email}</strong></p>
              <Input label="Verification code" value={form.code} onChange={set('code')}
                placeholder="123456" maxLength={6} required />
              <SubmitButton loading={loading}>Verify email</SubmitButton>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {view === VIEWS.FORGOT && (
            <form onSubmit={handleForgot} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Reset password</h2>
              <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
              <SubmitButton loading={loading}>Send reset code</SubmitButton>
              <button type="button" onClick={() => setView(VIEWS.LOGIN)}
                className="w-full text-center text-sm text-gray-400 hover:text-white">
                Back to login
              </button>
            </form>
          )}

          {/* RESET PASSWORD */}
          {view === VIEWS.RESET && (
            <form onSubmit={handleReset} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Set new password</h2>
              <Input label="Reset code" value={form.code} onChange={set('code')} required />
              <PasswordInput label="New password" value={form.newPassword} onChange={set('newPassword')}
                show={showPw} onToggle={() => setShowPw(!showPw)} />
              <SubmitButton loading={loading}>Reset password</SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared input components ────────────────

function Input({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        {...props}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white
          placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  );
}

function PasswordInput({ label, value, onChange, show, onToggle }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white
            placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors pr-10"
        />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-2.5 text-gray-400 hover:text-white">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function SubmitButton({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed
        text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
