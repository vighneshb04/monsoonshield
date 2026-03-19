import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role === 'admin') router.push('/admin');
      else router.push('/dashboard');
    }
  }, [user, loading]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-sky-400 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="text-5xl animate-bounce mb-3">🌧️</div>
        <p className="font-bold text-xl">MonsoonShield AI</p>
        <p className="text-blue-200 text-sm mt-1">Loading...</p>
      </div>
    </div>
  );
}
