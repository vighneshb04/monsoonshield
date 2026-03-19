import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { zonesAPI } from '../utils/api';
import Layout from '../components/dashboard/Layout';

const RISK_COLOR = (score) => {
  if (score >= 8) return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' };
  if (score >= 6) return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' };
  return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' };
};

export default function ZonesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user) zonesAPI.getAll().then(r => { setZones(r.data.zones); setLoading(false); }).catch(() => setLoading(false));
  }, [user, authLoading]);

  if (authLoading || loading) {
    return <Layout><div className="flex items-center justify-center py-20"><div className="text-3xl animate-bounce">🗺️</div></div></Layout>;
  }

  return (
    <Layout>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Zone Risk Map</h1>
        <p className="text-slate-500 text-sm mt-1">Real-time flood risk for Mumbai Q-commerce zones</p>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-5 text-xs">
        {[['bg-red-400', 'High Risk (8+)'], ['bg-yellow-400', 'Medium (6-8)'], ['bg-green-400', 'Lower (<6)']].map(([c, l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${c}`} />
            <span className="text-slate-600">{l}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {zones.map(z => {
          const risk = parseFloat(z.flood_risk_score);
          const colors = RISK_COLOR(risk);
          const rainfall = parseFloat(z.latest_rainfall || 0);

          return (
            <div key={z.id} className={`rounded-2xl p-4 border ${colors.bg} ${colors.border}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800">{z.name}</h3>
                    {z.flood_alert && (
                      <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                        🚨 FLOOD
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-slate-600">
                    <span>👥 {z.rider_count || 0} riders</span>
                    <span>📋 {z.active_policies || 0} policies</span>
                    <span>🌧️ {rainfall.toFixed(1)}mm</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-black ${colors.text}`}>{risk.toFixed(1)}</div>
                  <p className="text-xs text-slate-400">/10 risk</p>
                </div>
              </div>

              {/* Risk bar */}
              <div className="mt-3">
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${
                    risk >= 8 ? 'bg-red-500' : risk >= 6 ? 'bg-yellow-500' : 'bg-green-500'
                  }`} style={{ width: `${(risk / 10) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>Zone multiplier: {z.zone_multiplier}x</span>
                  <span className={rainfall >= 60 ? 'text-red-600 font-bold' : ''}>
                    {rainfall >= 60 ? '⚠️ Trigger active' : rainfall >= 30 ? '⚠️ High rainfall' : 'Normal conditions'}
                  </span>
                </div>
              </div>

              {user?.zone_id === z.id && (
                <div className="mt-2 text-xs text-blue-600 font-semibold">
                  📍 Your zone
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
