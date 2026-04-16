import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import Layout from '../components/dashboard/Layout';

const LEVEL_STYLES = {
  elite:    { bg: 'from-purple-600 to-purple-800', badge: 'bg-purple-100 text-purple-800', ring: 'ring-purple-400' },
  trusted:  { bg: 'from-emerald-600 to-emerald-800', badge: 'bg-emerald-100 text-emerald-800', ring: 'ring-emerald-400' },
  good:     { bg: 'from-blue-600 to-blue-800', badge: 'bg-blue-100 text-blue-800', ring: 'ring-blue-400' },
  building: { bg: 'from-amber-500 to-amber-700', badge: 'bg-amber-100 text-amber-800', ring: 'ring-amber-400' },
  new:      { bg: 'from-slate-500 to-slate-700', badge: 'bg-slate-100 text-slate-600', ring: 'ring-slate-400' },
};

const REASON_LABELS = {
  claim_free_week:         { label: 'Claim-free week', icon: '🌟', color: 'text-green-600' },
  policy_renewed:          { label: 'Policy renewed', icon: '🔄', color: 'text-blue-600' },
  legitimate_claim_approved: { label: 'Legitimate claim', icon: '✅', color: 'text-green-600' },
  fraud_flag_detected:     { label: 'Suspicious activity', icon: '⚠️', color: 'text-orange-600' },
  claim_blocked_fraud:     { label: 'Fraud blocked', icon: '🚫', color: 'text-red-600' },
  suspicious_activity:     { label: 'Flagged activity', icon: '👁️', color: 'text-yellow-600' },
};

export default function TrustPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trust, setTrust] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('score');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user) fetchData();
  }, [user, authLoading]);

  const fetchData = async () => {
    try {
      const [tRes, lRes] = await Promise.all([
        api.get('/trust/my'),
        api.get('/trust/leaderboard'),
      ]);
      setTrust(tRes.data.trust);
      setLeaderboard(lRes.data.leaderboard);

      // Fetch forecast for user's zone
      if (user?.zone_id) {
        const fRes = await api.get(`/trust/forecast/${user.zone_id}`);
        setForecast(fRes.data);
      }
    } catch {}
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-5xl animate-bounce mb-3">🏆</div>
          <p className="text-slate-500 text-sm">Loading your trust profile...</p>
        </div>
      </Layout>
    );
  }

  if (!trust) return <Layout><p className="text-center py-10 text-slate-500">Could not load trust profile</p></Layout>;

  const levelKey = trust.level?.label?.toLowerCase() || 'new';
  const styles = LEVEL_STYLES[levelKey] || LEVEL_STYLES.new;
  const scorePercent = Math.min(trust.score, 100);

  const ALERT_STYLES = {
    EXTREME: 'bg-red-50 border-red-300 text-red-800',
    HIGH:    'bg-orange-50 border-orange-300 text-orange-800',
    MEDIUM:  'bg-yellow-50 border-yellow-300 text-yellow-700',
    LOW:     'bg-green-50 border-green-300 text-green-700',
  };

  return (
    <Layout>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">🏆 Trust Score</h1>
        <p className="text-slate-500 text-sm mt-1">Your trustworthiness score determines your premium discounts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {[['score', '🏆 My Score'], ['forecast', '🔮 Risk Forecast'], ['leaderboard', '🥇 Leaderboard']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* SCORE TAB */}
      {tab === 'score' && (
        <>
          {/* Score Hero Card */}
          <div className={`bg-gradient-to-br ${styles.bg} rounded-3xl p-6 text-white mb-5 shadow-xl`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-xs uppercase tracking-widest">Trust Level</p>
                <p className="text-2xl font-black mt-1">
                  {trust.level?.emoji} {trust.level?.label}
                </p>
              </div>
              <div className="text-right">
                <div className="text-6xl font-black">{trust.score}</div>
                <p className="text-white/60 text-xs">out of 100</p>
              </div>
            </div>

            {/* Score bar */}
            <div className="mb-4">
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-1000"
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
              {trust.next_milestone && (
                <p className="text-white/60 text-xs mt-1.5">
                  {trust.next_milestone.points_needed} points to {trust.next_milestone.emoji} {trust.next_milestone.level}
                </p>
              )}
            </div>

            {/* Discount badge */}
            {trust.discount_pct > 0 && (
              <div className="bg-white/20 rounded-xl px-4 py-2 inline-flex items-center gap-2">
                <span className="text-lg">💸</span>
                <span className="font-bold text-sm">{trust.discount_pct}% premium discount active</span>
              </div>
            )}
          </div>

          {/* Income Recovery Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-4">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <span>📊</span> Income Recovery Report
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <p className="text-2xl font-black text-red-500">
                  ₹{(trust.income_stats?.total_lost || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Income Lost</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-green-600">
                  ₹{(trust.income_stats?.total_recovered || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Recovered</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-blue-600">
                  {trust.income_stats?.recovery_rate || 0}%
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Recovery Rate</p>
              </div>
            </div>
            {/* Recovery bar */}
            <div className="h-2.5 bg-red-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-1000"
                style={{ width: `${trust.income_stats?.recovery_rate || 0}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              MonsoonShield has recovered {trust.income_stats?.recovery_rate || 0}% of your flood-related income loss
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
              <p className="text-2xl font-bold text-blue-600">{trust.claim_free_weeks}</p>
              <p className="text-xs text-slate-500">Safe Weeks</p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
              <p className="text-2xl font-bold text-green-600">{trust.paid_claims}</p>
              <p className="text-xs text-slate-500">Claims Paid</p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
              <p className="text-2xl font-bold text-purple-600">{trust.total_policies}</p>
              <p className="text-xs text-slate-500">Policies</p>
            </div>
          </div>

          {/* Perks */}
          {trust.perks?.length > 0 && (
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl p-4 mb-4 border border-blue-100">
              <h3 className="font-bold text-slate-700 text-sm mb-3">✨ Your Current Perks</h3>
              <div className="space-y-1.5">
                {trust.perks.map((perk, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500 font-bold">✓</span> {perk}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trust History */}
          {trust.history?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-700 text-sm">Score History</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {trust.history.map((h, i) => {
                  const info = REASON_LABELS[h.reason] || { label: h.reason, icon: '📝', color: 'text-slate-600' };
                  return (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{info.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{info.label}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(h.created_at).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold text-sm ${h.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {h.change > 0 ? '+' : ''}{h.change}
                        </span>
                        <p className="text-xs text-slate-400">{h.old_score} → {h.new_score}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* FORECAST TAB */}
      {tab === 'forecast' && forecast && (
        <>
          {/* Alert banner */}
          <div className={`rounded-2xl p-4 border mb-5 ${ALERT_STYLES[forecast.alert_level]}`}>
            <p className="font-bold text-sm">{forecast.alert_message}</p>
            {forecast.surge_warning && (
              <p className="text-xs mt-1 font-medium">
                ⚡ Coverage prices may increase. Buy now to lock in current rates.
              </p>
            )}
          </div>

          {/* 48hr forecast cards */}
          <h3 className="font-bold text-slate-700 mb-3">48-Hour Forecast — {forecast.zone_name}</h3>
          <div className="space-y-3 mb-5">
            {forecast.forecasts?.map((f, i) => {
              const riskEmoji = { LOW: '☀️', MEDIUM: '🌧️', HIGH: '⛈️', EXTREME: '🌊' };
              const riskBg = { LOW: 'bg-green-50 border-green-200', MEDIUM: 'bg-yellow-50 border-yellow-200', HIGH: 'bg-orange-50 border-orange-200', EXTREME: 'bg-red-50 border-red-200' };

              return (
                <div key={i} className={`rounded-2xl p-4 border ${riskBg[f.risk_level]}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{riskEmoji[f.risk_level]}</span>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          {i === 0 ? 'Tomorrow' : 'Day after tomorrow'}
                        </p>
                        <p className="text-xs text-slate-500">{new Date(f.forecast_date).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-black text-sm px-3 py-1 rounded-full ${
                        f.risk_level === 'EXTREME' ? 'bg-red-200 text-red-800' :
                        f.risk_level === 'HIGH' ? 'bg-orange-200 text-orange-800' :
                        f.risk_level === 'MEDIUM' ? 'bg-yellow-200 text-yellow-800' :
                        'bg-green-200 text-green-800'
                      }`}>{f.risk_level}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                    <div>
                      <p className="text-slate-400">Rainfall</p>
                      <p className="font-bold">{parseFloat(f.predicted_rainfall_mm).toFixed(0)}mm</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Confidence</p>
                      <p className="font-bold">{f.confidence_pct}%</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Disruption</p>
                      <p className="font-bold">{Math.round(parseFloat(f.disruption_probability) * 100)}%</p>
                    </div>
                  </div>
                  {f.recommended_coverage !== 'none' && (
                    <div className="mt-2 bg-white/70 rounded-xl px-3 py-1.5 text-xs font-semibold text-blue-700">
                      💡 Recommended: {f.recommended_coverage === 'demand' ? '⚡ On-Demand Coverage' : '📋 Weekly Policy'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Current conditions */}
          <div className="bg-slate-800 rounded-2xl p-4 text-white">
            <p className="text-slate-300 text-xs uppercase tracking-wider mb-2">Current Conditions</p>
            <div className="flex justify-between">
              <div>
                <p className="font-bold">{forecast.zone_name}</p>
                <p className="text-slate-400 text-xs">Live rainfall: {forecast.current_rainfall_mm}mm</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-blue-300">{forecast.alert_level}</p>
                <p className="text-slate-400 text-xs">Risk level</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* LEADERBOARD TAB */}
      {tab === 'leaderboard' && (
        <>
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <p className="text-amber-800 font-bold text-sm">🏅 Platform Trust Leaderboard</p>
            <p className="text-amber-700 text-xs mt-1">Top trusted riders earn the best premium discounts</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {leaderboard.map((rider, i) => {
              const isMe = rider.full_name === user?.full_name;
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={i} className={`px-4 py-3 flex items-center gap-3 border-b border-slate-50 last:border-0 ${isMe ? 'bg-blue-50' : ''}`}>
                  <div className="w-8 text-center font-black text-slate-600">
                    {i < 3 ? medals[i] : `#${i + 1}`}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 text-sm">
                      {isMe ? '⭐ ' : ''}{rider.full_name}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">
                      {rider.platform} · {rider.zone_name} · {rider.claim_free_weeks} safe weeks
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg text-slate-800">{rider.trust_score}</p>
                    <p className="text-xs text-slate-500 capitalize">{rider.trust_level}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Layout>
  );
}
