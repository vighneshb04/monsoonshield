import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';
import { zonesAPI, triggerAPI, weatherAPI } from '../../utils/api';
import Layout from '../../components/dashboard/Layout';

export default function SimulatePage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && !isAdmin) { router.push('/dashboard'); return; }
    if (user) zonesAPI.getAll().then(r => { setZones(r.data.zones); if (r.data.zones[0]) setSelectedZone(r.data.zones[0].id); });
  }, [user, authLoading]);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-IN');
    setLog(l => [{ time, msg, type }, ...l].slice(0, 20));
  };

  const runSimulation = async () => {
    if (!selectedZone) return;
    setLoading(true);
    setResult(null);
    const zoneName = zones.find(z => z.id === selectedZone)?.name || 'Zone';

    try {
      addLog(`🌧️ Injecting flood event for ${zoneName}...`, 'info');
      const res = await triggerAPI.simulateFlood(selectedZone);
      setResult(res.data);
      addLog(`✅ Weather injected: ${res.data.rainfall_injected}`, 'success');
      addLog(`📦 Volume drop: ${res.data.volume_drop}`, 'success');
      addLog(`📋 Claims generated: ${res.data.claims_generated}`, 'success');
      res.data.claims?.forEach(c => {
        addLog(`  ↳ ${c.claim_number} — ₹${parseFloat(c.claim_amount).toFixed(0)} — ${c.status}`, 'claim');
      });
      addLog('💸 Instant payouts initiated for approved claims', 'payout');
    } catch (err) {
      addLog(`❌ Simulation failed: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkTrigger = async () => {
    if (!selectedZone) return;
    try {
      const res = await triggerAPI.check(selectedZone);
      const t = res.data.trigger_status;
      addLog(`🔍 Trigger check for ${res.data.zone}:`, 'info');
      addLog(`  Rainfall: ${t.rainfall_mm}mm (threshold: ${t.rainfall_threshold}mm) — ${t.rainfall_triggered ? '🔴 TRIGGERED' : '🟢 OK'}`, t.rainfall_triggered ? 'error' : 'success');
      addLog(`  Volume drop: ${t.volume_drop_pct}% (threshold: ${t.volume_threshold}%) — ${t.volume_triggered ? '🔴 TRIGGERED' : '🟢 OK'}`, t.volume_triggered ? 'error' : 'success');
    } catch (err) {
      addLog(`❌ Check failed: ${err.message}`, 'error');
    }
  };

  const logColors = { info: 'text-slate-500', success: 'text-green-600', error: 'text-red-500', claim: 'text-blue-600', payout: 'text-purple-600' };

  return (
    <Layout>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Simulation Console</h1>
        <p className="text-slate-500 text-sm mt-1">Simulate flood events and test the parametric trigger engine</p>
      </div>

      {/* Config */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-5">
        <h2 className="font-bold text-slate-700 mb-4">Simulation Settings</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-600 mb-1">Target Zone</label>
          <select value={selectedZone} onChange={e => setSelectedZone(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.name} (Risk: {z.flood_risk_score}/10)</option>
            ))}
          </select>
        </div>

        {/* Trigger info */}
        <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm space-y-2">
          <p className="font-semibold text-slate-700">Parametric Trigger Thresholds</p>
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
            <div className="bg-white rounded-lg p-2.5">
              <p className="font-semibold text-blue-700">🌧️ Rainfall Trigger</p>
              <p className="mt-0.5">≥ 60mm in 3 hours</p>
              <p className="text-slate-400">Payout: 75% of coverage</p>
            </div>
            <div className="bg-white rounded-lg p-2.5">
              <p className="font-semibold text-orange-700">📦 Volume Trigger</p>
              <p className="mt-0.5">≥ 40% order drop</p>
              <p className="text-slate-400">Payout: 50% of coverage</p>
            </div>
            <div className="bg-white rounded-lg p-2.5 col-span-2">
              <p className="font-semibold text-purple-700">⛈️ Combined Trigger</p>
              <p className="mt-0.5">Both conditions met simultaneously</p>
              <p className="text-slate-400">Payout: 100% of coverage</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={checkTrigger} disabled={loading || !selectedZone}
            className="flex-1 border border-blue-300 text-blue-700 font-semibold py-3 rounded-xl hover:bg-blue-50 transition text-sm">
            🔍 Check Status
          </button>
          <button onClick={runSimulation} disabled={loading || !selectedZone}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm">
            {loading ? '⏳ Simulating...' : '⚡ Simulate Flood'}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5">
          <h3 className="font-bold text-green-800 mb-2">✅ Simulation Complete</h3>
          <div className="text-sm space-y-1 text-green-700">
            <p>Zone: <strong>{zones.find(z => z.id === selectedZone)?.name}</strong></p>
            <p>Rainfall injected: <strong>{result.rainfall_injected}</strong></p>
            <p>Volume drop: <strong>{result.volume_drop}</strong></p>
            <p>Claims generated: <strong>{result.claims_generated}</strong></p>
          </div>
          {result.claims?.length > 0 && (
            <div className="mt-3 space-y-1">
              {result.claims.map(c => (
                <div key={c.id} className="bg-white rounded-lg px-3 py-2 text-xs flex justify-between">
                  <span className="font-medium">{c.full_name || c.claim_number}</span>
                  <span className="text-blue-700 font-bold">₹{parseFloat(c.claim_amount).toFixed(0)}</span>
                  <span className={`capitalize font-medium ${c.status === 'paid' ? 'text-green-600' : c.status === 'fraud_hold' ? 'text-orange-600' : 'text-slate-500'}`}>{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log console */}
      <div className="bg-slate-900 rounded-2xl p-4">
        <p className="text-slate-400 text-xs font-mono mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
          Simulation Log
        </p>
        <div className="space-y-1 font-mono text-xs max-h-64 overflow-y-auto">
          {log.length === 0 ? (
            <p className="text-slate-600">Waiting for simulation...</p>
          ) : (
            log.map((l, i) => (
              <div key={i} className={`${logColors[l.type]} flex gap-2`}>
                <span className="text-slate-600 shrink-0">{l.time}</span>
                <span>{l.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
