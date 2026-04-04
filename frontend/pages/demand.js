import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import Layout from '../components/dashboard/Layout';

export default function DemandPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('activate');
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user) fetchData();
  }, [user, authLoading]);

  // Countdown timer for active coverage
  useEffect(() => {
    if (!pricing?.active_coverage) return;
    const interval = setInterval(() => {
      const expires = new Date(pricing.active_coverage.expires_at);
      const now = new Date();
      const diff = expires - now;
      if (diff <= 0) { setCountdown('Expired'); fetchData(); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [pricing?.active_coverage]);

  const fetchData = async () => {
    try {
      const [pRes, hRes] = await Promise.all([
        api.get('/demand/pricing'),
        api.get('/demand/my')
      ]);
      setPricing(pRes.data);
      setHistory(hRes.data.coverages);
    } catch {}
    setLoading(false);
  };

  const activate = async (hours) => {
    setActivating(true);
    setError('');
    try {
      const res = await api.post('/demand/activate', { hours });
      setSuccess(res.data);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Activation failed');
    } finally {
      setActivating(false);
    }
  };

  const RISK_COLORS = {
    HIGH: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-500' },
    MEDIUM: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    LOW: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-500' }
  };

  const STATUS_COLORS = {
    active: 'bg-green-100 text-green-700',
    expired: 'bg-slate-100 text-slate-500',
    triggered: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700'
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-5xl animate-bounce mb-3">⚡</div>
          <p className="text-slate-500 text-sm">Loading coverage options...</p>
        </div>
      </Layout>
    );
  }

  const risk = pricing?.storm_risk || 'LOW';
  const riskColors = RISK_COLORS[risk];

  return (
    <Layout>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">⚡ Coverage on Demand</h1>
        <p className="text-slate-500 text-sm mt-1">Activate storm protection for 1, 3, or 6 hours instantly</p>
      </div>

      {/* Storm Risk Banner */}
      {pricing && (
        <div className={`rounded-2xl p-4 mb-5 border ${riskColors.bg} ${riskColors.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${riskColors.dot} animate-pulse`} />
              <div>
                <p className={`font-bold text-sm ${riskColors.text}`}>
                  {risk} STORM RISK — {pricing.zone_name}
                </p>
                <p className={`text-xs mt-0.5 ${riskColors.text}`}>
                  Current rainfall: {pricing.current_rainfall_mm}mm
                  {pricing.weather_surcharge && ` · ${pricing.weather_surcharge}`}
                </p>
              </div>
            </div>
            <div className={`text-2xl font-black ${riskColors.text}`}>
              {risk === 'HIGH' ? '🌊' : risk === 'MEDIUM' ? '🌧️' : '☀️'}
            </div>
          </div>
        </div>
      )}

      {/* Active coverage card */}
      {pricing?.active_coverage && (
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-5 text-white mb-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-green-200 text-xs font-medium uppercase tracking-wider">Active Storm Coverage</p>
              <p className="font-bold text-xl mt-1">
                {pricing.active_coverage.duration_hours}-Hour Protection
              </p>
            </div>
            <div className="bg-green-400 text-green-900 text-xs font-bold px-3 py-1 rounded-full">
              ACTIVE
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-green-200 text-xs">Coverage Amount</p>
              <p className="font-bold text-lg">₹{parseFloat(pricing.active_coverage.coverage_amount).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-green-200 text-xs">Time Remaining</p>
              <p className="font-bold text-lg font-mono">{countdown}</p>
            </div>
          </div>
          <div className="bg-green-500 bg-opacity-40 rounded-xl px-3 py-2 text-xs text-green-100">
            🛡️ You're protected until {new Date(pricing.active_coverage.expires_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. If rainfall exceeds 60mm, payout is automatic.
          </div>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5">
          <p className="font-bold text-green-800 text-sm">{success.message}</p>
          <p className="text-green-600 text-xs mt-1">{success.payout_trigger}</p>
          <p className="text-green-600 text-xs">Estimated payout: {success.estimated_payout}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[['activate', '⚡ Activate'], ['history', '📋 History']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'activate' && (
        <>
          {/* Packages */}
          {!pricing?.active_coverage && (
            <div className="space-y-3">
              {pricing?.packages?.map(pkg => (
                <div key={pkg.hours}
                  className={`bg-white rounded-2xl p-5 border-2 transition ${
                    pkg.popular ? 'border-blue-400 shadow-md' : 'border-slate-100'
                  }`}>
                  {pkg.popular && (
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-3 inline-block">
                      MOST POPULAR
                    </span>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{pkg.emoji}</span>
                      <div>
                        <p className="font-bold text-slate-800">{pkg.label} Coverage</p>
                        <p className="text-xs text-slate-500">{pkg.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-2xl text-blue-700">₹{pkg.premium}</p>
                      <p className="text-xs text-slate-400">covers ₹{pkg.coverage.toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {/* Value bar */}
                  <div className="bg-slate-50 rounded-xl p-3 mb-3 flex justify-between text-xs text-slate-600">
                    <span>Pay ₹{pkg.premium}</span>
                    <span>→</span>
                    <span className="font-bold text-green-600">Get ₹{pkg.coverage} if it floods</span>
                    <span>→</span>
                    <span className="font-bold text-blue-600">{(pkg.coverage / pkg.premium).toFixed(0)}x return</span>
                  </div>

                  <button
                    onClick={() => activate(pkg.hours)}
                    disabled={activating || !!pricing?.active_coverage}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition ${
                      pkg.popular
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    } disabled:opacity-50`}>
                    {activating ? '⏳ Activating...' : `Activate ${pkg.label} for ₹${pkg.premium}`}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* How it works */}
          <div className="bg-slate-50 rounded-2xl p-4 mt-5">
            <h3 className="font-bold text-slate-700 text-sm mb-3">How Coverage on Demand Works</h3>
            <div className="space-y-2">
              {[
                ['1', '⚡', 'Tap to activate coverage for 1, 3, or 6 hours'],
                ['2', '🌧️', 'We monitor real-time rainfall in your zone'],
                ['3', '🚨', 'If rainfall crosses 60mm → claim auto-generated'],
                ['4', '💸', 'Instant UPI payout — no forms, no waiting'],
              ].map(([step, icon, text]) => (
                <div key={step} className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                    {step}
                  </div>
                  <span>{icon} {text}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
              <p className="text-3xl mb-2">⚡</p>
              <p className="text-slate-500 text-sm">No on-demand coverage yet</p>
              <p className="text-slate-400 text-xs mt-1">Activate your first storm coverage above</p>
            </div>
          ) : (
            history.map(c => (
              <div key={c.id} className="bg-white rounded-2xl p-4 border border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {c.duration_hours}-Hour Coverage · {c.zone_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(c.activated_at).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Expired: {new Date(c.expires_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-700">₹{parseFloat(c.premium_paid).toFixed(0)} paid</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[c.status]}`}>
                      {c.status}
                    </span>
                    {c.triggered && (
                      <p className="text-xs text-green-600 font-bold mt-1">
                        ✓ Paid out ₹{parseFloat(c.payout_amount).toFixed(0)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Layout>
  );
}
