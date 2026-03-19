import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { dashboardAPI, claimAPI, payoutAPI } from '../utils/api';
import Layout from '../components/dashboard/Layout';
import StatCard from '../components/dashboard/StatCard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const STATUS_COLORS = {
  paid: '#22c55e', approved: '#3b82f6',
  pending: '#f59e0b', rejected: '#ef4444', fraud_hold: '#f97316'
};

export default function AdminDashboard() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && !isAdmin) { router.push('/dashboard'); return; }
    if (user && isAdmin) fetchData();
  }, [user, authLoading, isAdmin]);

  const fetchData = async () => {
    try {
      const res = await dashboardAPI.admin();
      setData(res.data.dashboard);
    } catch {}
    setLoading(false);
  };

  const handlePayClaim = async (claimId) => {
    try {
      await payoutAPI.process(claimId);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Payout failed');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center"><div className="text-4xl animate-bounce mb-3">🛡️</div>
          <p className="text-slate-500 text-sm">Loading admin panel...</p>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { overview: ov, zone_breakdown, recent_claims } = data;

  // Prepare chart data
  const zoneChartData = zone_breakdown.map(z => ({
    name: z.name.replace(' East', ''),
    claims: parseInt(z.claims),
    payouts: parseFloat(z.total_payouts),
    rainfall: parseFloat(z.latest_rainfall),
  }));

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm">MonsoonShield AI — Platform Overview</p>
        </div>
        <button onClick={fetchData}
          className="bg-blue-50 text-blue-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-100 transition">
          ↻ Refresh
        </button>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard icon="🛵" label="Total Riders" value={ov.total_riders} color="blue" />
        <StatCard icon="📋" label="Active Policies" value={ov.active_policies} color="green" />
        <StatCard icon="💰" label="Premiums Collected" value={`₹${ov.total_premiums.toLocaleString('en-IN', {maximumFractionDigits: 0})}`} color="purple" />
        <StatCard icon="💸" label="Total Payouts" value={`₹${ov.total_payouts.toLocaleString('en-IN', {maximumFractionDigits: 0})}`} color="orange" />
        <StatCard icon="📊" label="Claims Filed" value={ov.total_claims} color="blue" />
        <StatCard icon="🚫" label="Fraud Blocked" value={ov.fraud_blocked} color="red" />
      </div>

      {/* Loss ratio */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-5 text-white mb-5">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-slate-300 text-xs uppercase tracking-wider">Loss Ratio</p>
            <p className="text-3xl font-black mt-1">{ov.loss_ratio}</p>
            <p className="text-slate-400 text-xs mt-1">Payouts ÷ Premiums</p>
          </div>
          <div className="text-right">
            <p className="text-slate-300 text-xs">New this week</p>
            <p className="text-2xl font-bold text-blue-300">+{ov.new_this_week}</p>
            <p className="text-slate-400 text-xs">riders</p>
          </div>
        </div>
      </div>

      {/* Zone chart */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-5">
        <h2 className="font-bold text-slate-700 mb-4 text-sm">Claims by Zone</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={zoneChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v, n) => [n === 'payouts' ? `₹${v}` : v, n]} />
            <Bar dataKey="claims" fill="#3b82f6" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Zone risk table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-5 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-bold text-slate-700 text-sm">Zone Risk Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Zone', 'Riders', 'Policies', 'Risk', 'Rainfall', 'Alert'].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zone_breakdown.map(z => (
                <tr key={z.name} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{z.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{z.riders}</td>
                  <td className="px-4 py-2.5 text-slate-600">{z.active_policies}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-bold ${parseFloat(z.flood_risk_score) >= 8 ? 'text-red-600' : parseFloat(z.flood_risk_score) >= 6 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {z.flood_risk_score}/10
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{parseFloat(z.latest_rainfall).toFixed(1)}mm</td>
                  <td className="px-4 py-2.5">
                    {z.flood_alert
                      ? <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-semibold">🚨 FLOOD</span>
                      : <span className="text-green-600 text-xs">✓ Clear</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent claims */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold text-slate-700 text-sm">Recent Claims</h2>
          <a href="/admin/claims" className="text-blue-600 text-xs font-semibold">View all</a>
        </div>
        <div className="divide-y divide-slate-50">
          {recent_claims.slice(0, 8).map(c => (
            <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{c.full_name}</p>
                <p className="text-xs text-slate-500">{c.claim_number} · {c.zone_name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-slate-800 text-sm">₹{parseFloat(c.claim_amount).toFixed(0)}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize`}
                  style={{ background: STATUS_COLORS[c.status] + '22', color: STATUS_COLORS[c.status] }}>
                  {c.status === 'fraud_hold' ? 'Review' : c.status}
                </span>
              </div>
              {c.status === 'approved' && !c.payout_number && (
                <button onClick={() => handlePayClaim(c.id)}
                  className="ml-2 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 transition shrink-0">
                  Pay
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
