import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { zonesAPI } from '../utils/api';
import Link from 'next/link';

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [zones, setZones] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', password: '',
    platform: '', zone_id: '', upi_id: '', aadhaar_last4: ''
  });

  useEffect(() => {
    zonesAPI.getAll().then(r => setZones(r.data.zones)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(form);
      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-sky-400 flex flex-col items-center justify-center px-4 py-10">
      <div className="text-center mb-6">
        <div className="text-4xl mb-1">🌧️</div>
        <h1 className="text-2xl font-extrabold text-white">MonsoonShield AI</h1>
        <p className="text-blue-200 text-sm">Create your rider account</p>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${step >= s ? 'bg-blue-600' : 'bg-slate-200'}`} />
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
            <>
              <h2 className="text-lg font-bold text-slate-800 mb-4">Personal Details</h2>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Full Name</label>
                <input value={form.full_name} onChange={e => upd('full_name', e.target.value)}
                  placeholder="Raju Sharma" required
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Mobile Number</label>
                <input value={form.phone} onChange={e => upd('phone', e.target.value)}
                  placeholder="10-digit number" type="tel" required
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
                <input value={form.password} onChange={e => upd('password', e.target.value)}
                  type="password" placeholder="Min 6 characters" required
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Platform</label>
                <select value={form.platform} onChange={e => upd('platform', e.target.value)} required
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Select platform</option>
                  <option value="blinkit">Blinkit</option>
                  <option value="zepto">Zepto</option>
                  <option value="swiggy">Swiggy Instamart</option>
                  <option value="dunzo">Dunzo</option>
                </select>
              </div>
              <button type="button" onClick={() => setStep(2)}
                disabled={!form.full_name || !form.phone || !form.password || !form.platform}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
                Next →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-bold text-slate-800 mb-4">Zone & Payment</h2>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Operating Zone</label>
                <select value={form.zone_id} onChange={e => upd('zone_id', e.target.value)} required
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Select your zone</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>
                      {z.name} (Risk: {z.flood_risk_score}/10)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">UPI ID (for payouts)</label>
                <input value={form.upi_id} onChange={e => upd('upi_id', e.target.value)}
                  placeholder="yourname@upi" required
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Aadhaar Last 4 Digits</label>
                <input value={form.aadhaar_last4} onChange={e => upd('aadhaar_last4', e.target.value)}
                  placeholder="XXXX" maxLength={4}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition text-sm">
                  ← Back
                </button>
                <button type="submit" disabled={loading || !form.zone_id || !form.upi_id}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm">
                  {loading ? 'Creating...' : 'Register'}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already registered?{' '}
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
