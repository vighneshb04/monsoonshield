import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import Link from 'next/link';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.phone, form.password);
      router.push(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (type) => {
    if (type === 'rider') setForm({ phone: '9876543210', password: 'secret' });
else setForm({ phone: '9999999999', password: 'secret' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-sky-400 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">🌧️</div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">MonsoonShield AI</h1>
        <p className="text-blue-200 mt-1 text-sm">Weekly Income Protection for Mumbai Riders</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6">Welcome back</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Mobile Number</label>
            <input
              type="tel"
              placeholder="10-digit mobile number"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 mt-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center mb-3">Demo Credentials</p>
          <div className="flex gap-2">
            <button
              onClick={() => fillDemo('rider')}
              className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold py-2 rounded-lg transition"
            >
              🛵 Rider Demo
            </button>
            <button
              onClick={() => fillDemo('admin')}
              className="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold py-2 rounded-lg transition"
            >
              🛡️ Admin Demo
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          New rider?{' '}
          <Link href="/register" className="text-blue-600 font-semibold hover:underline">
            Register here
          </Link>
        </p>
      </div>

      <p className="text-blue-200 text-xs mt-6 text-center">
        Parametric insurance powered by real-time weather data
      </p>
    </div>
  );
}
