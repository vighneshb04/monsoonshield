import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { dashboardAPI } from '../utils/api';
import Layout from '../components/dashboard/Layout';
import StatCard from '../components/dashboard/StatCard';
import PolicyCard from '../components/dashboard/PolicyCard';
import ClaimCard from '../components/dashboard/ClaimCard';
import WeatherBanner from '../components/dashboard/WeatherBanner';
import Link from 'next/link';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && user?.role === 'admin') { router.push('/admin'); return; }
    if (user) fetchDashboard();
  }, [user, authLoading]);

  const fetchDashboard = async () => {
    try {
      const res = await dashboardAPI.worker();
      setData(res.data.dashboard);
    } catch (err) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-3">🌧️</div>
          <p className="text-slate-500 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { user: u, active_policy, claims_summary, recent_claims, weather, total_premiums_paid } = data;

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg">
            {u.full_name?.[0]}
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight">
              Hi, {u.full_name?.split(' ')[0]} 👋
            </h1>
            <p className="text-slate-500 text-xs capitalize">{u.platform} · {u.zone_name}</p>
          </div>
        </div>
        {!u.is_verified && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl px-4 py-2 text-xs">
            ⏳ KYC verification pending. Policy activation may be limited.
          </div>
        )}
      </div>

      {/* Weather banner */}
      <WeatherBanner weather={weather} />

      {/* Active policy */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-700">Your Policy</h2>
          {!active_policy && (
            <Link href="/policy" className="text-sm text-blue-600 font-semibold">
              + Get Covered
            </Link>
          )}
        </div>
        <PolicyCard policy={active_policy} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard icon="💰" label="Total Received" value={`₹${claims_summary.total_received.toLocaleString('en-IN')}`} color="green" />
        <StatCard icon="📋" label="Claims Filed" value={claims_summary.paid + claims_summary.approved + claims_summary.pending} color="blue" />
        <StatCard icon="✅" label="Paid Claims" value={claims_summary.paid} color="green" />
        <StatCard icon="💳" label="Premiums Paid" value={`₹${total_premiums_paid.toFixed(0)}`} color="purple" />
      </div>

      {/* Zone risk info */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-4 mb-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-300 text-xs">Your Zone Risk</p>
            <p className="font-bold text-lg">{u.zone_name}</p>
            <p className="text-slate-300 text-xs mt-1">
              Flood Risk: {u.flood_risk_score}/10
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-blue-300">{u.flood_risk_score}</div>
            <p className="text-slate-400 text-xs">/10 risk score</p>
            {weather && (
              <p className="text-xs mt-1 text-slate-300">
                🌧 {parseFloat(weather.rainfall_mm).toFixed(1)}mm now
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent claims */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-700">Recent Claims</h2>
          <Link href="/claims" className="text-sm text-blue-600 font-semibold">View all</Link>
        </div>
        {recent_claims.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-100">
            <p className="text-3xl mb-2">☀️</p>
            <p className="text-slate-500 text-sm">No claims yet. Stay safe!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recent_claims.map(c => <ClaimCard key={c.id} claim={c} />)}
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
    </Layout>
  );
}
