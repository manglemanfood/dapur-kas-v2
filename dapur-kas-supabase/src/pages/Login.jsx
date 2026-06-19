import React, { useState } from 'react';
import { supabase } from '../supabase';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const S = {
    page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#0f172a' },
    card: { width: '100%', maxWidth: 400, background: '#1e293b', borderRadius: 20, padding: 32, border: '1px solid #334155' },
    input: { width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', marginTop: 6 },
    btn: { width: '100%', padding: '14px', background: '#f97316', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginTop: 8 },
    label: { fontSize: 13, color: '#94a3b8', display: 'block', marginTop: 14 },
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success('Akun dibuat! Silakan login.');
        setIsRegister(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Login berhasil!');
      }
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🍽️</div>
          <div style={{ color: '#f97316', fontWeight: 700, fontSize: 24 }}>Kedai MangLeman</div>
          <div style={{ color: '#64748b', fontSize: 14 }}>Sistem Kasir & Laporan</div>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@contoh.com" required />
          <label style={S.label}>Password</label>
          <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 6 karakter" required />
          <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} type="submit" disabled={loading}>
            {loading ? '⏳ Memproses...' : isRegister ? '✅ Daftar' : '🔑 Masuk'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#64748b' }}>
          {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
          <button onClick={() => setIsRegister(!isRegister)} style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontWeight: 600 }}>
            {isRegister ? 'Masuk' : 'Daftar'}
          </button>
        </div>
      </div>
    </div>
  );
}
