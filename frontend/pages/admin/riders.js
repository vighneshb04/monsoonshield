import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';
import Layout from '../../components/dashboard/Layout';
import api from '../../utils/api';

export default function AdminRiders() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && !isAdmin) { router.push('/dashboard'); return; }
    if (user && isAdmin) fetchRiders();
  }, [user, authLoading]);

  const fetchRiders = async () => {
    try {
      const res = await api.get('/dashboard/admin');
      // We'll derive riders from zone breakdown
      setRiders([]);
    } catch {}
    setLoading(false);
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold text-slate-800 mb-2">Riders</h1>
      <p className="text-slate-500 text-sm mb-5">All registered Mumbai delivery riders</p>
      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading riders...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
          <p className="text-3xl mb-2">🛵</p>
          <p className="text-slate-600 font-medium">Rider list loads from admin dashboard</p>
          <p className="text-slate-400 text-sm mt-1">Go to Admin Overview for zone-wise rider counts</p>
        </div>
      )}
    </Layout>
  );
}
