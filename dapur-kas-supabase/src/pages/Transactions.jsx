import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatRupiah } from '../data/menuData';
import toast from 'react-hot-toast';

export default function Transactions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchData(); }, [date]);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('tanggal', date)
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else setData(rows || []);
    setLoading(false);
  };

  const hapus = async (id) => {
    if (!window.confirm('Hapus transaksi ini?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Dihapus!'); setData(prev => prev.filter(t => t.id !== id)); }
  };

  const changeDate = (d) => {
    const dt = new Date(date);
    dt.setDate(dt.getDate() + d);
    setDate(dt.toISOString().split('T')[0]);
  };

  const filtered = data.filter(t =>
    (t.nama || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.item || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.keterangan || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalOmset = filtered.reduce((s, t) => s + (t.total || 0), 0);
  const totalProfit = filtered.reduce((s, t) => s + (t.profit || 0), 0);

  const S = {
    input: { padding: '10px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none' },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>📋 Transaksi</h1>
        <button onClick={fetchData} style={{ ...S.input, cursor: 'pointer' }}>🔄 Refresh</button>
      </div>

      {/* Date nav */}
      <div style={{ background: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => changeDate(-1)} style={{ ...S.input, cursor: 'pointer', padding: '8px 14px' }}>‹</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.input} />
        <button onClick={() => changeDate(1)} style={{ ...S.input, cursor: 'pointer', padding: '8px 14px' }}>›</button>
        <button onClick={() => setDate(new Date().toISOString().split('T')[0])} style={{ ...S.input, cursor: 'pointer', color: '#f97316' }}>Hari Ini</button>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: '#f97316' }}>{formatRupiah(totalOmset)}</div>
          <div style={{ fontSize: 12, color: '#10b981' }}>Profit: {formatRupiah(totalProfit)}</div>
        </div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari nama, item, lokasi..." style={{ ...S.input, width: '100%', marginBottom: 14 }} />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Transaksi', val: filtered.length, color: '#fff' },
          { label: 'Omset', val: formatRupiah(totalOmset), color: '#f97316' },
          { label: 'Profit', val: formatRupiah(totalProfit), color: '#10b981' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: '#1e293b', borderRadius: 12, padding: 12, textAlign: 'center', border: '1px solid #334155' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⚙️ Memuat...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#1e293b', borderRadius: 16, color: '#64748b' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <div>Tidak ada transaksi</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(t => (
            <div key={t.id} style={{ background: '#1e293b', borderRadius: 14, padding: 14, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                    {t.item}
                    {t.qty > 1 && <span style={{ background: '#f97316', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 11, marginLeft: 6 }}>×{t.qty}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
                    {t.nama && t.nama !== 'Pelanggan' && <span>👤 {t.nama}</span>}
                    {t.keterangan && <span>📍 {t.keterangan}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ background: '#1d4ed8', color: '#bfdbfe', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>{t.tf}</span>
                    <span style={{ background: '#065f46', color: '#6ee7b7', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>{t.status}</span>
                    {t.created_at && <span style={{ fontSize: 11, color: '#475569' }}>{new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: '#f97316', fontWeight: 700 }}>{formatRupiah(t.total)}</div>
                  {t.profit > 0 && <div style={{ color: '#10b981', fontSize: 12 }}>+{formatRupiah(t.profit)}</div>}
                  {t.hpp > 0 && <div style={{ color: '#475569', fontSize: 11 }}>HPP: {formatRupiah(t.hpp)}</div>}
                  <button onClick={() => hapus(t.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, marginTop: 4 }}>Hapus</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
