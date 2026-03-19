import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';
import { claimAPI, payoutAPI } from '../../utils/api';
import Layout from '../../components/dashboard/Layout';
import { format } from 'date-fns';

const STATUS_BG = {
  paid: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
  fraud_hold: 'bg-orange-100 text-orange-700',
};

export default function AdminClaims() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && !isAdmin) { router.push('/dashboard'); return; }
    if (user && isAdmin) fetchClaims();
  }, [user, authLoading, statusFilter]);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const res = await claimAPI.getAll({ status: statusFilter || undefined, limit: 50 });
      setClaims(res.data.claims);
    } catch {}
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    setActionLoading(id + status);
    try {
      await claimAPI.updateStatus(id, { status });
      fetchClaims();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setActionLoading('');
    }
  };

  const processPayout = async (claimId) => {
    setActionLoading(claimId + 'pay');
    try {
      await payoutAPI.process(claimId);
      fetchClaims();
    } catch (err) {
      alert(err.response?.data?.message || 'Payout failed');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <Layout>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Claims Management</h1>
        <button onClick={fetchClaims} className="bg-blue-50 text-blue-600 text-sm font-semibold px-3 py-2 rounded-xl">↻</button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {[['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['paid', 'Paid'], ['fraud_hold', 'Fraud Hold'], ['rejected', 'Rejected']].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              statusFilter === v ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading claims...</div>
      ) : (
        <div className="space-y-3">
          {claims.map(c => (
            <div key={c.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{c.full_name}</p>
                  <p className="text-xs text-slate-500">{c.claim_number} · {c.phone} · {c.platform}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.zone_name} · {c.trigger_type?.replace('_', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">₹{parseFloat(c.claim_amount).toFixed(0)}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BG[c.status]}`}>
                    {c.status === 'fraud_hold' ? 'Fraud Hold' : c.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span>{format(new Date(c.created_at), 'dd MMM, hh:mm a')}</span>
                {c.fraud_score > 0 && (
                  <span className={c.fraud_score > 5 ? 'text-orange-500 font-medium' : ''}>
                    Fraud: {parseFloat(c.fraud_score).toFixed(1)}/10
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {c.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(c.id, 'approved')}
                      disabled={!!actionLoading}
                      className="flex-1 bg-green-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                      ✓ Approve
                    </button>
                    <button onClick={() => updateStatus(c.id, 'rejected')}
                      disabled={!!actionLoading}
                      className="flex-1 bg-red-100 text-red-700 text-xs font-semibold py-2 rounded-lg hover:bg-red-200 transition disabled:opacity-50">
                      ✗ Reject
                    </button>
                  </>
                )}
                {c.status === 'fraud_hold' && (
                  <>
                    <button onClick={() => updateStatus(c.id, 'approved')}
                      disabled={!!actionLoading}
                      className="flex-1 bg-blue-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                      Override & Approve
                    </button>
                    <button onClick={() => updateStatus(c.id, 'rejected')}
                      disabled={!!actionLoading}
                      className="flex-1 bg-red-100 text-red-700 text-xs font-semibold py-2 rounded-lg hover:bg-red-200 transition disabled:opacity-50">
                      Reject
                    </button>
                  </>
                )}
                {c.status === 'approved' && !c.payout_number && (
                  <button onClick={() => processPayout(c.id)}
                    disabled={actionLoading === c.id + 'pay'}
                    className="flex-1 bg-purple-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50">
                    {actionLoading === c.id + 'pay' ? 'Processing...' : '💸 Process Payout'}
                  </button>
                )}
                {c.payout_number && (
                  <p className="text-xs text-green-600 font-medium py-2">✓ Paid: {c.payout_number}</p>
                )}
              </div>
            </div>
          ))}

          {claims.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
              <p className="text-slate-500">No claims found</p>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
