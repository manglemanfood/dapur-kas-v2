import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './supabase';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Analysis from './pages/Analysis';
import Customers from './pages/Customers';
import BahanBaku from './pages/BahanBaku';
import KalkulatorHPP from './pages/KalkulatorHPP';
import Pengeluaran from './pages/Pengeluaran';
import Login from './pages/Login';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊', exact: true },
  { to: '/pos', label: 'POS Kasir', icon: '🛒' },
  { to: '/transaksi', label: 'Transaksi', icon: '📋' },
  { to: '/laporan', label: 'Laporan', icon: '📈' },
  { to: '/analisa', label: 'Analisa Bisnis', icon: '🧠' },
  { divider: true, label: 'MANAJEMEN' },
  { to: '/pelanggan', label: 'CRM Pelanggan', icon: '👥' },
  { to: '/bahan-baku', label: 'Bahan Baku', icon: '📦' },
  { to: '/hpp', label: 'Kalkulator HPP', icon: '🧮' },
  { to: '/pengeluaran', label: 'Pengeluaran', icon: '💸' },
];

function Layout({ session }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout berhasil');
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 20 }} />}

      <aside style={{
        width: 230, flexShrink: 0, background: '#1e293b', borderRight: '1px solid #334155',
        display: 'flex', flexDirection: 'column', zIndex: 30,
        position: window.innerWidth < 768 ? 'fixed' : 'static',
        left: 0, top: 0, bottom: 0,
        transform: window.innerWidth < 768 ? (open ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        transition: 'transform 0.3s'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 30 }}>🍽️</div>
            <div>
              <div style={{ color: '#f97316', fontWeight: 800, fontSize: 15 }}>Kedai MangLeman</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>Manajemen Bisnis FNB</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
          {navItems.map((item, idx) => {
            if (item.divider) return (
              <div key={idx} style={{ color: '#475569', fontSize: 10, fontWeight: 700, padding: '12px 12px 4px', letterSpacing: 1 }}>{item.label}</div>
            );
            return (
              <NavLink key={item.to} to={item.to} end={item.exact} onClick={() => setOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  borderRadius: 10, textDecoration: 'none', marginBottom: 2, fontSize: 13, fontWeight: 500,
                  background: isActive ? '#f97316' : 'transparent',
                  color: isActive ? '#fff' : '#94a3b8',
                })}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #334155' }}>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, wordBreak: 'break-all' }}>{session?.user?.email}</div>
          <button onClick={logout} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>🚪 Logout</button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#1e293b', borderBottom: '1px solid #334155' }}>
          <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>☰</button>
          <span style={{ color: '#f97316', fontWeight: 700 }}>Kedai MangLeman</span>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pos" element={<POS session={session} />} />
            <Route path="/transaksi" element={<Transactions />} />
            <Route path="/laporan" element={<Reports />} />
            <Route path="/analisa" element={<Analysis />} />
            <Route path="/pelanggan" element={<Customers />} />
            <Route path="/bahan-baku" element={<BahanBaku />} />
            <Route path="/hpp" element={<KalkulatorHPP />} />
            <Route path="/pengeluaran" element={<Pengeluaran />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>🍽️</div>
      <div style={{ color: '#f97316', fontWeight: 700, fontSize: 20 }}>Kedai MangLeman</div>
      <div style={{ color: '#64748b' }}>Memuat...</div>
    </div>
  );

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/*" element={session ? <Layout session={session} /> : <Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
