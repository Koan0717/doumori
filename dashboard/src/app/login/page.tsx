'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Leaf, User, Lock } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push(redirectTo);
        router.refresh();
      } else {
        setError(data.error || 'ログインに失敗しました');
      }
    } catch {
      setError('サーバーに接続できませんでした');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-leaf-50">
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-leaf-500 rounded-2xl shadow-lg shadow-leaf-500/20 mb-4">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-leaf-900">どう森BOT ダッシュボード</h1>
          <p className="text-leaf-600 mt-1 text-sm">管理者ログイン</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-leaf-200 rounded-2xl p-8 shadow-xl shadow-leaf-900/5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-leaf-700 mb-1.5">ユーザー名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-leaf-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full pl-10 pr-3 py-2.5 bg-leaf-50 border border-leaf-200 rounded-xl text-leaf-900 focus:outline-none focus:ring-2 focus:ring-leaf-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-leaf-700 mb-1.5">パスワード</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-leaf-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-3 py-2.5 bg-leaf-50 border border-leaf-200 rounded-xl text-leaf-900 focus:outline-none focus:ring-2 focus:ring-leaf-400"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-2.5 px-4 bg-leaf-600 hover:bg-leaf-700 disabled:bg-leaf-300 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center">読み込み中...</main>}>
      <LoginForm />
    </Suspense>
  );
}
