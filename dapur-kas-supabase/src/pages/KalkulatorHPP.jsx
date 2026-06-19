// src/pages/KalkulatorHPP.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { MENU_ITEMS, formatRupiah } from '../data/menuData';
import toast from 'react-hot-toast';

export default function KalkulatorHPP() {
  const [resepList, setResepList] = useState([]);
  const [bahanList, setBahanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('daftar');
  const [showForm, setShowForm] = useState(false);
  const [editResep, setEditResep] = useState(null);

  const [form, setForm] = useState({ nama_menu: '', kategori: 'RICEBOWL', porsi: 1, harga_jual: '', catatan: '' });
  const [bahanForm, setBahanForm] = useState([{ bahan_id: '', nama_bahan: '', jumlah: '', satuan: 'gram', harga_per_unit: 0, subtotal: 0 }]);

  useEffect(() => {
    fetchResep();
    supabase.from('bahan_baku').select('*').order('nama').then(({ data }) => setBahanList(data || []));
  }, []);

  const fetchResep = async () => {
    setLoading(true);
    const { data } = await supabase.from('resep').select('*, resep_bahan(*)').order('nama_menu');
    setResepList(data || []);
    setLoading(false);
  };

  const calcHPP = () => {
    return bahanForm.reduce((s, b) => s + (parseFloat(b.subtotal) || 0), 0);
  };

  const handleBahanChange = (i, key, val) => {
    const updated = [...bahanForm];
    updated[i] = { ...updated[i], [key]: val };
    if (key === 'bahan_id') {
      const bahan = bahanList.find(b => b.id === val);
      if (bahan) {
        updated[i].nama_bahan = bahan.nama;
        updated[i].harga_per_unit = bahan.harga_terakhir || 0;
        updated[i].satuan = bahan.satuan;
        updated[i].subtotal = (parseFloat(updated[i].jumlah) || 0) * (bahan.harga_terakhir || 0);
      }
    }
    if (key === 'jumlah') {
      updated[i].subtotal = parseFloat(val) * (parseFloat(updated[i].harga_per_unit) || 0);
    }
    if (key === 'harga_per_unit') {
      updated[i].subtotal = (parseFloat(updated[i].jumlah) || 0) * parseFloat(val);
    }
    setBahanForm(updated);
  };

  const handleSaveResep = async () => {
    if (!form.nama_menu) return toast.error('Nama menu wajib diisi!');
    const validBahan = bahanForm.filter(b => b.nama_bahan && b.jumlah);
    const hpp = calcHPP() / (parseInt(form.porsi) || 1);
    const harga_jual = parseFloat(form.harga_jual) || 0;
    const margin = harga_jual > 0 ? Math.round((harga_jual - hpp) / harga_jual * 100) : 0;

    const resepPayload = { ...form, porsi: parseInt(form.porsi) || 1, hpp_per_porsi: hpp, harga_jual, margin, updated_at: new Date().toISOString() };

    let resepId;
    if (editResep) {
      await supabase.from('resep').update(resepPayload).eq('id', editResep.id);
      await supabase.from('resep_bahan').delete().eq('resep_id', editResep.id);
      resepId = editResep.id;
      toast.success('Resep diupdate!');
    } else {
      const { data } = await supabase.from('resep').insert(resepPayload).select().single();
      resepId = data?.id;
      toast.success('Resep disimpan!');
    }

    if (resepId && validBahan.length) {
      await supabase.from('resep_bahan').insert(validBahan.map(b => ({ ...b, resep_id: resepId })));
    }

    setShowForm(false);
    setEditResep(null);
    setForm({ nama_menu: '', kategori: 'RICEBOWL', porsi: 1, harga_jual: '', catatan: '' });
    setBahanForm([{ bahan_id: '', nama_bahan: '', jumlah: '', satuan: 'gram', harga_per_unit: 0, subtotal: 0 }]);
    fetchResep();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus resep ini?')) return;
    await supabase.from('resep').delete().eq('id', id);
    toast.success('Dihapus!');
    fetchResep();
  };

  const openEdit = (r) => {
    setEditResep(r);
    setForm({ nama_menu: r.nama_menu, kategori: r.kategori, porsi: r.porsi, harga_jual: r.harga_jual, catatan: r.catatan || '' });
    setBahanForm(r.resep_bahan?.length ? r.resep_bahan.map(b => ({ ...b })) : [{ bahan_id: '', nama_bahan: '', jumlah: '', satuan: 'gram', harga_per_unit: 0, subtotal: 0 }]);
    setShowForm(true);
  };

  const hpp = calcHPP() / (parseInt(form.porsi) || 1);
  const margin = form.harga_jual > 0 ? Math.round((parseFloat(form.harga_jual) - hpp) / parseFloat(form.harga_jual) * 100) : 0;

  const S = {
    input: { width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' },
    label: { fontSize: 11, color: '#94a3b8', marginBottom: 3, display: 'block' },
  };

  const KATEGORI = ['LELE', 'AYAM MENTAH', 'AYAM MATANG', 'RICEBOWL', 'MIE', 'DIMSUM', 'CAMILAN', 'JUICE', 'TUMISAN', 'PUDING'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>🧮 Kalkulator HPP</h1>
          <p style={{ color: '#64748b', fontSize: 13 }}>Hitung Harga Pokok Produksi per resep</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditResep(null); }} style={{ padding: '10px 18px', background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+ Buat Resep</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 14, textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f97316' }}>{resepList.length}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Resep</div>
        </div>
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 14, textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{bahanList.length}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Bahan Baku</div>
        </div>
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 14, textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>
            {resepList.length > 0 ? Math.round(resepList.reduce((s, r) => s + (r.margin || 0), 0) / resepList.length) : 0}%
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Avg Margin</div>
        </div>
      </div>

      {/* Resep List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⚙️ Memuat...</div>
      ) : resepList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#1e293b', borderRadius: 16, color: '#64748b' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🧮</div>
          <div>Belum ada resep</div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>Tambah resep untuk menghitung HPP otomatis</div>
          <button onClick={() => setShowForm(true)} style={{ marginTop: 12, padding: '10px 20px', background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+ Buat Resep Pertama</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resepList.map(r => {
            const marginColor = r.margin >= 40 ? '#10b981' : r.margin >= 25 ? '#f59e0b' : '#ef4444';
            return (
              <div key={r.id} style={{ background: '#1e293b', borderRadius: 14, padding: 16, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 15 }}>{r.nama_menu}</span>
                      <span style={{ background: '#334155', color: '#94a3b8', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>{r.kategori}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <div style={{ background: '#0f172a', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>HPP/porsi</div>
                        <div style={{ color: '#ef4444', fontWeight: 700 }}>{formatRupiah(r.hpp_per_porsi)}</div>
                      </div>
                      <div style={{ background: '#0f172a', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Harga Jual</div>
                        <div style={{ color: '#f97316', fontWeight: 700 }}>{formatRupiah(r.harga_jual)}</div>
                      </div>
                      <div style={{ background: '#0f172a', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Margin</div>
                        <div style={{ color: marginColor, fontWeight: 700 }}>{r.margin}%</div>
                      </div>
                    </div>
                    {r.resep_bahan?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Bahan ({r.resep_bahan.length} item):</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.resep_bahan.map(b => (
                            <span key={b.id} style={{ background: '#334155', color: '#cbd5e1', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>{b.nama_bahan} {b.jumlah}{b.satuan}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => openEdit(r)} style={{ padding: '7px 14px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>✏️ Edit</button>
                    <button onClick={() => handleDelete(r.id)} style={{ padding: '7px 14px', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>🗑️ Hapus</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, overflowY: 'auto', padding: 16 }}>
          <div style={{ background: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 600, margin: '0 auto', border: '1px solid #334155' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#1e293b', zIndex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{editResep ? '✏️ Edit Resep' : '+ Resep Baru'}</span>
              <button onClick={() => { setShowForm(false); setEditResep(null); }} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Basic info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <div><label style={S.label}>Nama Menu *</label><input value={form.nama_menu} onChange={e => setForm({ ...form, nama_menu: e.target.value })} placeholder="cth: Ricebowl Ayam Teriyaki" style={S.input} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={S.label}>Kategori</label>
                    <select value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })} style={S.input}>
                      {KATEGORI.map(k => <option key={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Jumlah Porsi</label>
                    <input type="number" value={form.porsi} onChange={e => setForm({ ...form, porsi: e.target.value })} style={S.input} min="1" />
                  </div>
                  <div>
                    <label style={S.label}>Harga Jual</label>
                    <input type="number" value={form.harga_jual} onChange={e => setForm({ ...form, harga_jual: e.target.value })} placeholder="0" style={S.input} />
                  </div>
                </div>
              </div>

              {/* Bahan bahan */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#94a3b8' }}>🥬 Bahan-bahan:</div>
                {bahanForm.map((b, i) => (
                  <div key={i} style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Bahan #{i+1}</span>
                      {bahanForm.length > 1 && <button onClick={() => setBahanForm(bahanForm.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={S.label}>Pilih Bahan</label>
                        <select value={b.bahan_id} onChange={e => handleBahanChange(i, 'bahan_id', e.target.value)} style={S.input}>
                          <option value="">-- Pilih dari master --</option>
                          {bahanList.map(bh => <option key={bh.id} value={bh.id}>{bh.nama} ({formatRupiah(bh.harga_terakhir)}/{bh.satuan})</option>)}
                        </select>
                      </div>
                      {!b.bahan_id && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={S.label}>Atau ketik manual</label>
                          <input value={b.nama_bahan} onChange={e => handleBahanChange(i, 'nama_bahan', e.target.value)} placeholder="Nama bahan" style={S.input} />
                        </div>
                      )}
                      <div>
                        <label style={S.label}>Jumlah</label>
                        <input type="number" value={b.jumlah} onChange={e => handleBahanChange(i, 'jumlah', e.target.value)} placeholder="0" style={S.input} />
                      </div>
                      <div>
                        <label style={S.label}>Harga/unit (Rp)</label>
                        <input type="number" value={b.harga_per_unit} onChange={e => handleBahanChange(i, 'harga_per_unit', e.target.value)} style={S.input} />
                      </div>
                      {b.subtotal > 0 && (
                        <div style={{ gridColumn: '1 / -1', color: '#10b981', fontWeight: 600, fontSize: 13 }}>
                          Subtotal: {formatRupiah(b.subtotal)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <button onClick={() => setBahanForm([...bahanForm, { bahan_id: '', nama_bahan: '', jumlah: '', satuan: 'gram', harga_per_unit: 0, subtotal: 0 }])}
                  style={{ width: '100%', padding: '10px', background: 'transparent', border: '2px dashed #334155', borderRadius: 10, color: '#64748b', cursor: 'pointer', marginBottom: 16 }}>
                  + Tambah Bahan
                </button>
              </div>

              {/* HPP Summary */}
              <div style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, textAlign: 'center' }}>
                  <div><div style={{ fontSize: 11, color: '#64748b' }}>Total HPP</div><div style={{ color: '#ef4444', fontWeight: 700 }}>{formatRupiah(calcHPP())}</div></div>
                  <div><div style={{ fontSize: 11, color: '#64748b' }}>HPP/Porsi</div><div style={{ color: '#f97316', fontWeight: 700 }}>{formatRupiah(hpp)}</div></div>
                  <div><div style={{ fontSize: 11, color: '#64748b' }}>Margin</div><div style={{ color: margin >= 30 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{margin}%</div></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setShowForm(false); setEditResep(null); }} style={{ flex: 1, padding: 12, background: '#334155', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
                <button onClick={handleSaveResep} style={{ flex: 2, padding: 12, background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>💾 Simpan Resep</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
