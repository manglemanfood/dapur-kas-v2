// src/pages/Customers.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { formatRupiah } from '../data/menuData';
import toast from 'react-hot-toast';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Semua');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [detailTrx, setDetailTrx] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const [form, setForm] = useState({ nama: '', no_hp: '', lokasi: '', email: '', catatan: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('total_belanja', { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  };

  // Sync customers from transactions
  const syncFromTransactions = async () => {
    setSyncing(true);
    const { data: trxData } = await supabase.from('transactions').select('nama, keterangan, tanggal, total').neq('nama', 'Pelanggan').not('nama', 'is', null);

    const custMap = {};
    (trxData || []).forEach(t => {
      const n = t.nama?.trim();
      if (!n || n === 'nan' || n === '') return;
      if (!custMap[n]) custMap[n] = { nama: n, total_belanja: 0, total_transaksi: 0, last_order: null, lokasi: t.keterangan || '' };
      custMap[n].total_belanja += t.total || 0;
      custMap[n].total_transaksi += 1;
      if (!custMap[n].last_order || t.tanggal > custMap[n].last_order) custMap[n].last_order = t.tanggal;
    });

    let synced = 0;
    for (const [nama, data] of Object.entries(custMap)) {
      const segmen = data.total_transaksi >= 10 ? 'VIP' : data.total_transaksi >= 5 ? 'Loyal' : data.total_transaksi >= 2 ? 'Regular' : 'Baru';
      const existing = customers.find(c => c.nama === nama);
      if (existing) {
        await supabase.from('customers').update({ total_belanja: data.total_belanja, total_transaksi: data.total_transaksi, last_order: data.last_order, segmen }).eq('id', existing.id);
      } else {
        await supabase.from('customers').insert({ ...data, segmen });
        synced++;
      }
    }
    toast.success(`Sinkronisasi selesai! ${synced} pelanggan baru ditemukan.`);
    setSyncing(false);
    fetchData();
  };

  const fetchDetail = async (customerId, nama) => {
    const { data } = await supabase.from('transactions').select('*').eq('nama', nama).order('tanggal', { ascending: false });
    setDetailTrx(data || []);
    setShowDetail(customerId);
  };

  const handleSave = async () => {
    if (!form.nama) return toast.error('Nama wajib diisi!');
    const payload = { ...form };
    if (editItem) {
      await supabase.from('customers').update(payload).eq('id', editItem.id);
      toast.success('Data diupdate!');
    } else {
      await supabase.from('customers').insert({ ...payload, segmen: 'Baru' });
      toast.success('Pelanggan ditambahkan!');
    }
    setShowForm(false);
    setEditItem(null);
    setForm({ nama: '', no_hp: '', lokasi: '', email: '', catatan: '' });
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus pelanggan ini?')) return;
    await supabase.from('customers').delete().eq('id', id);
    toast.success('Dihapus!');
    fetchData();
  };

  const filtered = useMemo(() => customers.filter(c =>
    (c.nama?.toLowerCase().includes(search.toLowerCase()) || c.lokasi?.toLowerCase().includes(search.toLowerCase())) &&
    (filter === 'Semua' || c.segmen === filter)
  ), [customers, search, filter]);

  const segmenColor = (s) => ({
    'VIP': { bg: '#065f46', color: '#6ee7b7', label: '⭐ VIP' },
    'Loyal': { bg: '#1d4ed8', color: '#bfdbfe', label: '🔥 Loyal' },
    'Regular': { bg: '#92400e', color: '#fde68a', label: '👤 Regular' },
    'Baru': { bg: '#374151', color: '#94a3b8', label: '🆕 Baru' },
  }[s] || { bg: '#374151', color: '#94a3b8', label: s });

  const stats = useMemo(() => ({
    total: customers.length,
    vip: customers.filter(c => c.segmen === 'VIP').length,
    loyal: customers.filter(c => c.segmen === 'Loyal').length,
    totalBelanja: customers.reduce((s, c) => s + (c.total_belanja || 0), 0),
  }), [customers]);

  const S = {
    input: { width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none' },
    label: { fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' },
  };

  const Modal = ({ title, onClose, children, wide }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#1e293b', borderRadius: 16, width: '100%', maxWidth: wide ? 600 : 480, border: '1px solid #334155', marginTop: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>👥 CRM Pelanggan</h1>
          <p style={{ color: '#64748b', fontSize: 13 }}>{customers.length} pelanggan terdaftar</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={syncFromTransactions} disabled={syncing} style={{ padding: '9px 16px', background: '#10b981', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            {syncing ? '⏳ Sync...' : '🔄 Sync dari Transaksi'}
          </button>
          <button onClick={() => { setShowForm(true); setEditItem(null); setForm({ nama: '', no_hp: '', lokasi: '', email: '', catatan: '' }); }} style={{ padding: '9px 16px', background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>+ Tambah</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Pelanggan', val: stats.total, color: '#fff' },
          { label: '⭐ VIP', val: stats.vip, color: '#10b981' },
          { label: '🔥 Loyal', val: stats.loyal, color: '#3b82f6' },
          { label: 'Total Omset', val: formatRupiah(stats.totalBelanja), color: '#f97316' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: '#1e293b', borderRadius: 12, padding: 12, border: '1px solid #334155', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari nama, lokasi..." style={{ ...S.input, flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {['Semua', 'VIP', 'Loyal', 'Regular', 'Baru'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ flexShrink: 0, padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: filter === f ? '#f97316' : '#1e293b', color: filter === f ? '#fff' : '#94a3b8' }}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⚙️ Memuat...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#1e293b', borderRadius: 16, color: '#64748b' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
          <div>Belum ada pelanggan</div>
          <button onClick={syncFromTransactions} style={{ marginTop: 12, padding: '10px 20px', background: '#10b981', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>🔄 Sync dari Transaksi</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const seg = segmenColor(c.segmen);
            return (
              <div key={c.id} style={{ background: '#1e293b', borderRadius: 14, padding: 16, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 15 }}>{c.nama}</span>
                      <span style={{ background: seg.bg, color: seg.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{seg.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                      <span style={{ color: '#f97316', fontWeight: 700 }}>{formatRupiah(c.total_belanja)}</span>
                      <span style={{ color: '#64748b' }}>{c.total_transaksi || 0}x transaksi</span>
                      {c.lokasi && <span style={{ color: '#64748b' }}>📍 {c.lokasi}</span>}
                      {c.no_hp && <span style={{ color: '#64748b' }}>📱 {c.no_hp}</span>}
                    </div>
                    {c.last_order && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Terakhir order: {new Date(c.last_order).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                    {c.catatan && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>💬 {c.catatan}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => fetchDetail(c.id, c.nama)} style={{ padding: '6px 12px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📋 Detail</button>
                    <button onClick={() => { setEditItem(c); setForm({ nama: c.nama, no_hp: c.no_hp || '', lokasi: c.lokasi || '', email: c.email || '', catatan: c.catatan || '' }); setShowForm(true); }} style={{ padding: '6px 12px', background: '#334155', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12 }}>✏️ Edit</button>
                    <button onClick={() => handleDelete(c.id)} style={{ padding: '6px 12px', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <Modal title={editItem ? '✏️ Edit Pelanggan' : '+ Tambah Pelanggan'} onClose={() => { setShowForm(false); setEditItem(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={S.label}>Nama *</label><input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Nama pelanggan" style={S.input} /></div>
            <div><label style={S.label}>No. HP / WhatsApp</label><input value={form.no_hp} onChange={e => setForm({ ...form, no_hp: e.target.value })} placeholder="08xx" style={S.input} /></div>
            <div><label style={S.label}>Lokasi / Gedung</label><input value={form.lokasi} onChange={e => setForm({ ...form, lokasi: e.target.value })} placeholder="cth: Gd. A Lt. 2" style={S.input} /></div>
            <div><label style={S.label}>Email</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@contoh.com" style={S.input} /></div>
            <div><label style={S.label}>Catatan</label><textarea value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} placeholder="Preferensi, alergi, catatan khusus..." style={{ ...S.input, height: 80, resize: 'vertical' }} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowForm(false); setEditItem(null); }} style={{ flex: 1, padding: 12, background: '#334155', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
              <button onClick={handleSave} style={{ flex: 1, padding: 12, background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>💾 Simpan</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <Modal title={`📋 Histori: ${customers.find(c => c.id === showDetail)?.nama}`} onClose={() => setShowDetail(null)} wide>
          {detailTrx.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>Tidak ada transaksi</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                  <div style={{ color: '#f97316', fontWeight: 700 }}>{formatRupiah(detailTrx.reduce((s, t) => s + (t.total || 0), 0))}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Total Belanja</div>
                </div>
                <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                  <div style={{ color: '#3b82f6', fontWeight: 700 }}>{detailTrx.length}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Transaksi</div>
                </div>
                <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                  <div style={{ color: '#10b981', fontWeight: 700 }}>{formatRupiah(detailTrx.reduce((s, t) => s + (t.total || 0), 0) / detailTrx.length)}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Avg/Trx</div>
                </div>
              </div>
              <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detailTrx.map(t => (
                  <div key={t.id} style={{ background: '#0f172a', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{t.item} {t.qty > 1 ? `×${t.qty}` : ''}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} · {t.tf}</div>
                      </div>
                      <div style={{ color: '#f97316', fontWeight: 700 }}>{formatRupiah(t.total)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
