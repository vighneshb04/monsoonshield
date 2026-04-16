import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import Layout from '../../components/dashboard/Layout';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const RISK_COLORS = { EXTREME: '#dc2626', HIGH: '#ea580c', MEDIUM: '#d97706', LOW: '#16a34a' };
const TRUST_COLORS = ['#7c3aed', '#059669', '#2563eb', '#d97706', '#6b7280'];

export default function AdminAnalytics() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simMsg, setSimMsg] = useState('');

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && !isAdmin) { router.push('/dashboard'); return; }
    if (user && isAdmin) fetchAnalytics();
  }, [user, authLoading]);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/trust/admin-analytics');
      setAnalytics(res.data.analytics);
    } catch {}
    setLoading(false);
  };

  const simulateWeek = async () => {
    setSimulating(true);
    try {
      await api.post('/trust/simulate-week');
      setSimMsg('✅ Weekly trust scores updated for all riders!');
      fetchAnalytics();
    } catch {
      setSimMsg('❌ Simulation failed');
    } finally {
      setSimulating(false);
      setTimeout(() => setSimMsg(''), 3000);
    }
  };

  if (authLoading || loading) {
    return <Layout><div className="flex items-center justify-center py-20"><div className="text-4xl animate-bounce">🔮</div></div></Layout>;
  }

  if (!analytics) return <Layout><p className="text-center py-10">Failed to load analytics</p></Layout>;

  const totalExposure = analytics.zone_risk_map?.reduce((s, z) => s + parseFloat(z.total_exposure || 0), 0) || 0;
  const totalPredictedPayout = analytics.predicted_claims_tomorrow?.reduce((s, z) => s + parseFloat(z.predicted_payout || 0), 0) || 0;

  return (
    <Layout>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">🔮 Predictive Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">AI-powered risk intelligence for next 48 hours</p>
        </div>
        <button onClick={fetchAnalytics} className="bg-blue-50 text-blue-600 text-sm font-semibold px-3 py-2 rounded-xl">↻</button>
      </div>

      {simMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-sm text-green-700 font-medium">
          {simMsg}
        </div>
      )}

      {/* Key prediction metrics */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Exposure</p>
          <p className="text-2xl font-black text-slate-800 mt-1">
            ₹{(totalExposure / 100000).toFixed(1)}L
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Active policy coverage</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100 shadow-sm">
          <p className="text-xs text-red-500 uppercase tracking-wide">Predicted Payouts Tomorrow</p>
          <p className="text-2xl font-black text-red-700 mt-1">
            ₹{(totalPredictedPayout / 1000).toFixed(1)}K
          </p>
          <p className="text-xs text-red-400 mt-0.5">Based on weather forecast</p>
        </div>
      </div>

      {/* Predicted claims tomorrow */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-5 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold text-slate-700 text-sm">🌧️ Tomorrow's Claim Predictions</h2>
          <span className="text-xs text-slate-400">AI forecast</span>
        </div>
        <div className="divide-y divide-slate-50">
          {analytics.predicted_claims_tomorrow?.map((z, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: RISK_COLORS[z.risk_level] || '#6b7280' }} />
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{z.zone_name}</p>
                  <p className="text-xs text-slate-500">
                    {parseFloat(z.predicted_rainfall_mm).toFixed(0)}mm · {Math.round(parseFloat(z.disruption_probability) * 100)}% disruption chance
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-800 text-sm">{z.predicted_claims || 0} claims</p>
                <p className="text-xs text-red-500">₹{parseFloat(z.predicted_payout || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone risk chart */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-5">
        <h2 className="font-bold text-slate-700 text-sm mb-4">Zone Risk vs Active Policies</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={analytics.zone_risk_map?.map(z => ({
            name: z.name.replace(' East', '').substring(0, 8),
            policies: parseInt(z.active_policies),
            risk: parseFloat(z.flood_risk_score)
          }))} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip />
            <Bar dataKey="policies" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Policies" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Trust distribution */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-5">
        <h2 className="font-bold text-slate-700 text-sm mb-4">Rider Trust Distribution</h2>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="50%" height={140}>
            <PieChart>
              <Pie
                data={analytics.trust_distribution?.map(t => ({ name: t.trust_band, value: parseInt(t.rider_count) }))}
                cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                paddingAngle={3} dataKey="value">
                {analytics.trust_distribution?.map((_, i) => (
                  <Cell key={i} fill={TRUST_COLORS[i % TRUST_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5">
            {analytics.trust_distribution?.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: TRUST_COLORS[i % TRUST_COLORS.length] }} />
                  <span className="text-slate-600">{t.trust_band.split(' ')[0]}</span>
                </div>
                <span className="font-bold text-slate-700">{t.rider_count} riders</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fraud risk summary */}
        {analytics.fraud_risk_summary && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-xl font-bold text-red-600">{analytics.fraud_risk_summary.high_risk_riders}</p>
              <p className="text-slate-500">High Risk</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-600">{analytics.fraud_risk_summary.medium_risk_riders}</p>
              <p className="text-slate-500">Medium Risk</p>
            </div>
            <div>
              <p className="text-xl font-bold text-green-600">{analytics.fraud_risk_summary.platform_avg_trust}</p>
              <p className="text-slate-500">Avg Trust</p>
            </div>
          </div>
        )}
      </div>

      {/* Simulate weekly trust update */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-4">
        <h3 className="font-bold text-purple-800 text-sm mb-2">⚡ Trust Engine Controls</h3>
        <p className="text-purple-700 text-xs mb-3">
          Simulate weekly trust score processing — rewards claim-free riders, penalizes fraud patterns
        </p>
        <button onClick={simulateWeek} disabled={simulating}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition">
          {simulating ? '⏳ Processing...' : '▶ Run Weekly Trust Update'}
        </button>
      </div>
    </Layout>
  );
}
