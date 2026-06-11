import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Lock, User, AlertCircle, Train } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg-page)' }}>
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}
      >
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)' }}
          >
            <Train className="w-7 h-7 text-accent-purple" />
          </div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>RailTwin Operations</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Sign in to access the control center</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full rounded-lg text-sm pl-10 pr-3 py-2.5 outline-none transition-colors"
                style={{
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)'
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent-purple)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-lg text-sm pl-10 pr-3 py-2.5 outline-none transition-colors"
                style={{
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)'
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent-purple)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-accent-red)' }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full rounded-lg text-sm font-medium py-2.5 transition-all duration-200 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-accent-purple)',
              color: 'white',
              boxShadow: '0 0 12px rgba(168,85,247,0.3)'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--color-border-default)' }}>
          <p className="text-center text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            Demo credentials: <span className="font-mono">admin</span> / <span className="font-mono">admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
};
