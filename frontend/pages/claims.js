import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { claimAPI, payoutAPI } from '../utils/api';
import Layout from '../components/dashboard/Layout';
import ClaimCard from '../components/dashboard/ClaimCard';

export default function ClaimsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [claims, setClaims] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('claims');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user) fetchData();
  }, [user, authLoading]);

  const fetchData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([claimAPI.getMy(), payoutAPI.getMy()]);
      setClaims(cRes.data.claims);
      setPayouts(pRes.data.payouts);
    } catch {}
    setLoading(false);
  };

  const totalReceived = payouts
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="text-3xl animate-bounce">💰</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="text-xl font-bold text-slate-800 mb-2">Claims & Payouts</h1>
      <p className="text-slate-500 text-sm mb-5">Automatic parametric claims from weather triggers</p>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-slate-800">{claims.length}</p>
          <p className="text-xs text-slate-500">Total Claims</p>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-green-600">{claims.filter(c => c.status === 'paid').length}</p>
          <p className="text-xs text-slate-500">Paid</p>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
          <p className="text-lg font-bold text-blue-600">₹{totalReceived.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500">Received</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[['claims', `Claims (${claims.length})`], ['payouts', `Payouts (${payouts.length})`]].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'claims' && (
        <div className="space-y-3">
          {claims.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
              <p className="text-3xl mb-2">☀️</p>
              <p className="text-slate-500 text-sm">No claims yet</p>
              <p className="text-slate-400 text-xs mt-1">Claims are generated automatically when rain exceeds 60mm</p>
            </div>
          ) : (
            claims.map(c => <ClaimCard key={c.id} claim={c} />)
          )}
        </div>
      )}

      {tab === 'payouts' && (
        <div className="space-y-3">
          {payouts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
              <p className="text-slate-500 text-sm">No payouts yet</p>
            </div>
          ) : (
            payouts.map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-4 border border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{p.payout_number}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.claim_number} · {p.zone_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">UPI: {p.upi_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">₹{parseFloat(p.amount).toFixed(0)}</p>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {p.status}
                    </span>
                  </div>
                </div>
                {p.completed_at && (
                  <p className="text-xs text-slate-400 mt-2">
                    Paid: {new Date(p.completed_at).toLocaleString('en-IN')}
                    {p.is_simulated && ' (Simulated)'}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </Layout>
  );
}
