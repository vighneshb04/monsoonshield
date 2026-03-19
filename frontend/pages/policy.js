import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { policyAPI, premiumAPI, zonesAPI } from '../utils/api';
import Layout from '../components/dashboard/Layout';
import PolicyCard from '../components/dashboard/PolicyCard';

export default function PolicyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [policies, setPolicies] = useState([]);
  const [premium, setPremium] = useState(null);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [coverage, setCoverage] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user) init();
  }, [user, authLoading]);

  const init = async () => {
    try {
      const [polRes, zoneRes] = await Promise.all([policyAPI.getMy(), zonesAPI.getAll()]);
      setPolicies(polRes.data.policies);
      setZones(zoneRes.data.zones);
      const userZone = zoneRes.data.zones.find(z => z.id === user.zone_id);
      if (userZone) setSelectedZone(userZone.id);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (selectedZone && user) calcPremium();
  }, [selectedZone, coverage]);

  const calcPremium = async () => {
    try {
      const res = await premiumAPI.calculate({ zone_id: selectedZone, coverage_amount: coverage });
      setPremium(res.data.premium);
    } catch {}
  };

  const buyPolicy = async () => {
    if (!premium) return;
    setBuying(true);
    setError('');
    try {
      await policyAPI.create({ zone_id: selectedZone, coverage_amount: coverage, weekly_premium: premium.weekly_premium });
      setSuccess('Policy activated! You are now covered for 7 days.');
      init();
    } catch (err) {
      setError(err.response?.data?.message || 'Purchase failed');
    } finally {
      setBuying(false);
    }
  };

  const activePolicy = policies.find(p => p.status === 'active');

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="text-3xl animate-bounce">📋</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="text-xl font-bold text-slate-800 mb-5">Weekly Policy</h1>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 mb-4 text-sm">
          🎉 {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Active policy */}
      <div className="mb-6">
        <h2 className="font-bold text-slate-600 text-sm mb-2">Current Policy</h2>
        <PolicyCard policy={activePolicy} />
      </div>

      {/* Buy new policy */}
      {!activePolicy && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
          <h2 className="font-bold text-slate-800 mb-4">Get Weekly Coverage</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Zone</label>
              <select value={selectedZone} onChange={e => setSelectedZone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Select zone</option>
                {zones.map(z => (
                  <option key={z.id} value={z.id}>
                    {z.name} · Risk {z.flood_risk_score}/10
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Weekly Coverage: ₹{coverage.toLocaleString('en-IN')}
              </label>
              <input type="range" min={1000} max={5000} step={500} value={coverage}
                onChange={e => setCoverage(Number(e.target.value))}
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>₹1,000</span><span>₹5,000</span>
              </div>
            </div>

            {premium && (
              <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-blue-800 text-sm">Premium Breakdown (AI-Calculated)</h3>
                <div className="space-y-1 text-xs">
                  {[
                    ['Base Rate', `₹${premium.base_rate}`],
                    ['Flood Risk Component', `₹${premium.risk_component}`],
                    ['Safety Discount', `-₹${premium.safety_discount}`],
                    ['Zone', premium.zone_name],
                    ['Rainfall Signal', premium.rainfall_factor],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-slate-600">
                      <span>{k}</span><span className="font-medium">{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-blue-700 border-t border-blue-200 pt-2 mt-2 text-sm">
                    <span>Weekly Premium</span>
                    <span>₹{premium.weekly_premium}</span>
                  </div>
                </div>
                {premium.ml_powered && (
                  <p className="text-xs text-blue-500 mt-1">⚡ AI-powered calculation</p>
                )}
              </div>
            )}

            <button onClick={buyPolicy} disabled={buying || !premium || !selectedZone}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm">
              {buying ? 'Processing...' : `Activate for ₹${premium?.weekly_premium || '...'}`}
            </button>
          </div>
        </div>
      )}

      {/* Policy history */}
      {policies.length > 1 && (
        <div>
          <h2 className="font-bold text-slate-700 text-sm mb-3">Policy History</h2>
          <div className="space-y-2">
            {policies.filter(p => p.status !== 'active').slice(0, 5).map(p => (
              <div key={p.id} className="bg-white rounded-xl p-3 border border-slate-100 flex justify-between items-center text-sm">
                <span className="text-slate-700 font-medium">{p.policy_number}</span>
                <div className="text-right">
                  <span className="text-slate-500 text-xs block">{p.zone_name}</span>
                  <span className="text-slate-400 text-xs">{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
