// src/pages/KalkulatorHPP.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatRupiah } from '../data/menuData';
import toast from 'react-hot-toast';

const KATEGORI = ['LELE', 'AYAM MENTAH', 'AYAM MATANG', 'RICEBOWL', 'MIE', 'DIMSUM', 'CAMILAN', 'JUICE', 'TUMISAN', 'PUDING'];

const SATUAN_KONVERSI = {
  gram: 1,
  kg: 1000,
  ml: 1,
  liter: 1000,
  sdm: 15,
  sdt: 5,
  sachet: 1,
  buah: 1,
  siung: 5,
  lembar: 2,
  cup: 150,
  pcs: 1,
};

function toGram(jumlah, satuan) {
  const factor = SATUAN_KONVERSI[satuan?.toLowerCase()] || 1;
  return parseFloat(jumlah || 0) * factor;
}

export default function KalkulatorHPP() {
  const [resepList, setResepList] = useState([]);
  const [bahanList, setBahanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editResep, setEditResep] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const defaultBahan = { bahan_id: '', nama_bahan: '', jumlah: '', satuan: 'gram', harga_per_unit: 0, harga_satuan_beli: 0, gram_per_satuan_beli: 1000, subtotal: 0 };
  const [form, setForm] = useState({ nama_menu: '', kategori: 'RICEBOWL', porsi: 1, harga_jual: '', biaya_operasional: '', target_porsi_bulan: '', catatan: '' });
  const [bahanForm, setBahanForm] = useState([{ ...defaultBahan }]);

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

  // Hitung subtotal per bahan dengan konversi gramasi
  const hitungSubtotal = (b) => {
    const jumlahGram = toGram(b.jumlah, b.satuan);
    const hargaPerGram = (parseFloat(b.harga_satuan_beli) || 0) / (parseFloat(b.gram_per_satuan_beli) || 1000);
    return jumlahGram * hargaPerGram;
  };

  const calcHPP = () => bahanForm.reduce((s, b) => s + hitungSubtotal(b), 0);

  const handleBahanChange = (i, key, val) => {
    const updated = [...bahanForm];
    updated[i] = { ...updated[i], [key]: val };

    if (key === 'bahan_id') {
      const bahan = bahanList.find(b => b.id === val);
      if (bahan) {
        updated[i].nama_bahan = bahan.nama;
        updated[i].harga_satuan_beli = bahan.harga_terakhir || 0;
        updated[i].gram_per_satuan_beli = bahan.jumlah_beli || 1000;
        updated[i].satuan = 'gram';
      }
    }
    setBahanForm(updated);
  };

  const hppPerPorsi = calcHPP() / (parseInt(form.porsi) || 1);
  const hargaJual = parseFloat(form.harga_jual) || 0;
  const margin = hargaJual > 0 ? Math.round((hargaJual - hppPerPorsi) / hargaJual * 100) : 0;
  const profitPerPorsi = hargaJual - hppPerPorsi;

  // Hitung BEP
  const biayaOps = parseFloat(form.biaya_operasional) || 0;
  const bepPorsi = profitPerPorsi > 0 ? Math.ceil(biayaOps / profitPerPorsi) : 0;
  const bepOmzet = bepPorsi * hargaJual;
  const targetBulan = parseInt(form.target_porsi_bulan) || 0;
  const estimasiProfitBulan = targetBulan > 0 ? (targetBulan * profitPerPorsi) - biayaOps : 0;

  const handleSaveResep = async () => {
    if (!form.nama_menu) return toast.error('Nama menu wajib diisi!');
    const validBahan = bahanForm.filter(b => b.nama_bahan && b.jumlah);

    const resepPayload = {
      nama_menu: form.nama_menu,
      kategori: form.kategori,
      porsi: parseInt(form.porsi) || 1,
      harga_jual: hargaJual,
      hpp_per_porsi: hppPerPorsi,
      margin,
      biaya_operasional: biayaOps,
      target_porsi_bulan: targetBulan,
      bep_porsi: bepPorsi,
      catatan: form.catatan,
      updated_at: new Date().toISOString()
    };

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
      await supabase.from('resep_bahan').insert(validBahan.map(b => ({
        resep_id: resepId,
        bahan_id: b.bahan_id || null,
        nama_bahan: b.nama_bahan,
        jumlah: parseFloat(b.jumlah),
        satuan: b.satuan,
        harga_per_unit: hitungSubtotal(b) / (toGram(b.jumlah, b.satuan) || 1),
        harga_satuan_beli: parseFloat(b.harga_satuan_beli) || 0,
        gram_per_satuan_beli: parseFloat(b.gram_per_satuan_beli) || 1000,
        subtotal: hitungSubtotal(b),
      })));
    }

    resetForm();
    fetchResep();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditResep(null);
    setForm({ nama_menu: '', kategori: 'RICEBOWL', porsi: 1, harga_jual: '', biaya_operasional: '', target_porsi_bulan: '', catatan: '' });
    setBahanForm([{ ...defaultBahan }]);
  };

  const openEdit = (r) => {
    setEditResep(r);
    setForm({
      nama_menu: r.nama_menu,
      kategori: r.kategori,
      porsi: r.porsi,
      harga_jual: r.harga_jual,
      biaya_operasional: r.biaya_operasional || '',
      target_porsi_bulan: r.target_porsi_bulan || '',
      catatan: r.catatan || ''
    });
    setBahanForm(r.resep_bahan?.length
      ? r.resep_bahan.map(b => ({
          bahan_id: b.bahan_id || '',
          nama_bahan: b.nama_bahan,
          jumlah: b.jumlah,
          satuan: b.satuan,
          harga_satuan_beli: b.harga_satuan_beli || 0,
          gram_per_satuan_beli: b.gram_per_satuan_beli || 1000,
          subtotal: b.subtotal || 0,
        }))
      : [{ ...defaultBahan }]);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus resep ini?')) return;
    await supabase.from('resep_bahan').delete().eq('resep_id', id);
    await supabase.from('resep').delete().eq('id', id);
    toast.success('Resep dihapus!');
    fetchResep();
  };

  const S = {
    input: { width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
    label: { fontSize: 11, color: '#94a3b8', marginBottom: 3, display: 'block' },
  };

  const avgMargin = resepList.length > 0
    ? Math.round(resepList.reduce((s, r) => s + (r.margin || 0), 0) / resepList.length)
    : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>🧮 Kalkulator HPP</h1>
          <p style={{ color: '#64748b', fontSize: 13 }}>Harga Pokok Produksi + BEP Balik Modal</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditResep(null); }}
          style={{ padding: '10px 18px', background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          + Buat Resep
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Resep', value: resepList.length, color: '#f97316' },
          { label: 'Bahan Baku', value: bahanList.length, color: '#10b981' },
          { label: 'Avg Margin', value: `${avgMargin}%`, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1e293b', borderRadius: 12, padding: 14, textAlign: 'center', border: '1px solid #334155' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Resep List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⚙️ Memuat...</div>
      ) : resepList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#1e293b', borderRadius: 16, color: '#64748b' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🧮</div>
          <div style={{ marginBottom: 4 }}>Belum ada resep</div>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>Tambah resep untuk menghitung HPP & BEP otomatis</div>
          <button onClick={() => setShowForm(true)}
            style={{ padding: '10px 20px', background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            + Buat Resep Pertama
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resepList.map(r => {
            const marginColor = r.margin >= 40 ? '#10b981' : r.margin >= 25 ? '#f59e0b' : '#ef4444';
            const isExpanded = expandedId === r.id;
            const profitPerPorsiR = (r.harga_jual || 0) - (r.hpp_per_porsi || 0);
            const bepR = r.bep_porsi || (r.biaya_operasional > 0 && profitPerPorsiR > 0 ? Math.ceil(r.biaya_operasional / profitPerPorsiR) : 0);

            return (
              <div key={r.id} style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflow: 'hidden' }}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 15 }}>{r.nama_menu}</span>
                        <span style={{ background: '#334155', color: '#94a3b8', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>{r.kategori}</span>
                        <span style={{ background: '#1e3a5f', color: '#60a5fa', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>{r.porsi} porsi</span>
                      </div>

                      {/* HPP Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                        <div style={{ background: '#0f172a', borderRadius: 8, padding: 10 }}>
                          <div style={{ fontSize: 10, color: '#64748b' }}>HPP/porsi</div>
                          <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>{formatRupiah(r.hpp_per_porsi)}</div>
                        </div>
                        <div style={{ background: '#0f172a', borderRadius: 8, padding: 10 }}>
                          <div style={{ fontSize: 10, color: '#64748b' }}>Harga Jual</div>
                          <div style={{ color: '#f97316', fontWeight: 700, fontSize: 13 }}>{formatRupiah(r.harga_jual)}</div>
                        </div>
                        <div style={{ background: '#0f172a', borderRadius: 8, padding: 10 }}>
                          <div style={{ fontSize: 10, color: '#64748b' }}>Margin</div>
                          <div style={{ color: marginColor, fontWeight: 700, fontSize: 13 }}>{r.margin}%</div>
                        </div>
                      </div>

                      {/* BEP Info */}
                      {bepR > 0 && (
                        <div style={{ background: '#0f2a1a', borderRadius: 8, padding: 10, marginBottom: 8, border: '1px solid #166534' }}>
                          <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginBottom: 4 }}>📊 BEP Balik Modal</div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#86efac' }}>🎯 {bepR} porsi/bulan</span>
                            <span style={{ fontSize: 12, color: '#86efac' }}>💰 {formatRupiah(bepR * (r.harga_jual || 0))}/bulan</span>
                            {r.target_porsi_bulan > 0 && (
                              <span style={{ fontSize: 12, color: r.target_porsi_bulan >= bepR ? '#4ade80' : '#fbbf24' }}>
                                {r.target_porsi_bulan >= bepR ? '✅' : '⚠️'} Target: {r.target_porsi_bulan} porsi
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => openEdit(r)}
                        style={{ padding: '7px 14px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(r.id)}
                        style={{ padding: '7px 14px', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                        🗑️ Hapus
                      </button>
                      <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        style={{ padding: '7px 14px', background: '#334155', border: 'none', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                        {isExpanded ? '▲ Tutup' : '▼ Detail'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Detail - Gramasi Breakdown */}
                {isExpanded && r.resep_bahan?.length > 0 && (
                  <div style={{ borderTop: '1px solid #334155', padding: 16, background: '#0f172a' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 10 }}>🥬 Detail Bahan & Gramasi:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {r.resep_bahan.map((b, idx) => {
                        const jumlahGram = toGram(b.jumlah, b.satuan);
                        const hargaPerGram = (b.harga_satuan_beli || 0) / (b.gram_per_satuan_beli || 1000);
                        const porsiDariPembelian = b.gram_per_satuan_beli > 0 ? Math.floor((b.gram_per_satuan_beli) / jumlahGram) : 0;

                        return (
                          <div key={idx} style={{ background: '#1e293b', borderRadius: 8, padding: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{b.nama_bahan}</div>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                  {b.jumlah} {b.satuan}
                                  {b.satuan !== 'gram' && ` = ${jumlahGram.toFixed(1)}g`}
                                  {b.gram_per_satuan_beli > 0 && b.harga_satuan_beli > 0 && (
                                    <span style={{ color: '#60a5fa' }}>
                                      {' '}· Beli {b.gram_per_satuan_beli}g @ {formatRupiah(b.harga_satuan_beli)}
                                      {porsiDariPembelian > 0 && ` → untuk ${porsiDariPembelian}x resep`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ color: '#10b981', fontWeight: 700, fontSize: 13 }}>{formatRupiah(b.subtotal || (jumlahGram * hargaPerGram))}</div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>{formatRupiah(hargaPerGram)}/gram</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 10, padding: 10, background: '#1e293b', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: 13 }}>Total HPP ({r.porsi} porsi)</span>
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatRupiah(r.hpp_per_porsi * r.porsi)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, overflowY: 'auto', padding: 16 }}>
          <div style={{ background: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 620, margin: '0 auto', border: '1px solid #334155' }}>

            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#1e293b', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{editResep ? '✏️ Edit Resep' : '+ Resep Baru'}</span>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Info Dasar */}
              <div style={{ background: '#0f172a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#f97316', fontWeight: 600, marginBottom: 10 }}>📋 Info Menu</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={S.label}>Nama Menu *</label>
                    <input value={form.nama_menu} onChange={e => setForm({ ...form, nama_menu: e.target.value })}
                      placeholder="cth: Ricebowl Ayam Teriyaki" style={S.input} />
                  </div>
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
                      <label style={S.label}>Harga Jual/porsi</label>
                      <input type="number" value={form.harga_jual} onChange={e => setForm({ ...form, harga_jual: e.target.value })} placeholder="0" style={S.input} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bahan-bahan */}
              <div style={{ background: '#0f172a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginBottom: 10 }}>🥬 Bahan-bahan & Gramasi</div>
                {bahanForm.map((b, i) => {
                  const jumlahGram = toGram(b.jumlah, b.satuan);
                  const hargaPerGram = (parseFloat(b.harga_satuan_beli) || 0) / (parseFloat(b.gram_per_satuan_beli) || 1000);
                  const subtotal = jumlahGram * hargaPerGram;
                  const porsiDariPembelian = b.gram_per_satuan_beli > 0 && b.jumlah > 0
                    ? Math.floor(parseFloat(b.gram_per_satuan_beli) / jumlahGram)
                    : 0;

                  return (
                    <div key={i} style={{ background: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Bahan #{i + 1}</span>
                        {bahanForm.length > 1 && (
                          <button onClick={() => setBahanForm(bahanForm.filter((_, idx) => idx !== i))}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {/* Pilih bahan */}
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={S.label}>Pilih dari Master Bahan</label>
                          <select value={b.bahan_id} onChange={e => handleBahanChange(i, 'bahan_id', e.target.value)} style={S.input}>
                            <option value="">-- Pilih bahan --</option>
                            {bahanList.map(bh => (
                              <option key={bh.id} value={bh.id}>
                                {bh.nama} ({formatRupiah(bh.harga_terakhir)}/{bh.jumlah_beli || 1000}g)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Nama manual jika tidak dari master */}
                        {!b.bahan_id && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={S.label}>Atau ketik nama bahan</label>
                            <input value={b.nama_bahan} onChange={e => handleBahanChange(i, 'nama_bahan', e.target.value)}
                              placeholder="Nama bahan" style={S.input} />
                          </div>
                        )}

                        {/* Jumlah & Satuan */}
                        <div>
                          <label style={S.label}>Jumlah dipakai</label>
                          <input type="number" value={b.jumlah} onChange={e => handleBahanChange(i, 'jumlah', e.target.value)}
                            placeholder="0" style={S.input} />
                        </div>
                        <div>
                          <label style={S.label}>Satuan</label>
                          <select value={b.satuan} onChange={e => handleBahanChange(i, 'satuan', e.target.value)} style={S.input}>
                            {Object.keys(SATUAN_KONVERSI).map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>

                        {/* Harga beli */}
                        <div>
                          <label style={S.label}>Harga beli (Rp)</label>
                          <input type="number" value={b.harga_satuan_beli}
                            onChange={e => handleBahanChange(i, 'harga_satuan_beli', e.target.value)}
                            placeholder="cth: 79900" style={S.input} />
                        </div>
                        <div>
                          <label style={S.label}>Beli per (gram)</label>
                          <input type="number" value={b.gram_per_satuan_beli}
                            onChange={e => handleBahanChange(i, 'gram_per_satuan_beli', e.target.value)}
                            placeholder="cth: 1000" style={S.input} />
                        </div>
                      </div>

                      {/* Preview konversi */}
                      {b.jumlah > 0 && b.harga_satuan_beli > 0 && (
                        <div style={{ marginTop: 8, padding: 8, background: '#0f172a', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: '#60a5fa' }}>
                            📐 {b.jumlah} {b.satuan} = {jumlahGram.toFixed(1)}g
                            {b.satuan !== 'gram' && ` (×${SATUAN_KONVERSI[b.satuan] || 1})`}
                          </div>
                          <div style={{ fontSize: 11, color: '#60a5fa' }}>
                            💰 {formatRupiah(hargaPerGram.toFixed(2))}/gram
                            {porsiDariPembelian > 0 && ` · 1 beli = ${porsiDariPembelian}x resep`}
                          </div>
                          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                            Subtotal: {formatRupiah(subtotal)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button onClick={() => setBahanForm([...bahanForm, { ...defaultBahan }])}
                  style={{ width: '100%', padding: 10, background: 'transparent', border: '2px dashed #334155', borderRadius: 10, color: '#64748b', cursor: 'pointer', marginBottom: 4 }}>
                  + Tambah Bahan
                </button>
              </div>

              {/* HPP Summary */}
              <div style={{ background: '#0f172a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 600, marginBottom: 10 }}>📊 Ringkasan HPP</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                  <div style={{ background: '#1e293b', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Total HPP</div>
                    <div style={{ color: '#ef4444', fontWeight: 700 }}>{formatRupiah(calcHPP())}</div>
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>HPP/Porsi</div>
                    <div style={{ color: '#f97316', fontWeight: 700 }}>{formatRupiah(hppPerPorsi)}</div>
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Margin</div>
                    <div style={{ color: margin >= 30 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{margin}%</div>
                  </div>
                </div>
                {profitPerPorsi > 0 && (
                  <div style={{ marginTop: 8, padding: 8, background: '#1e293b', borderRadius: 8, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: '#10b981' }}>Profit/porsi: <strong>{formatRupiah(profitPerPorsi)}</strong></span>
                  </div>
                )}
              </div>

              {/* BEP Section */}
              <div style={{ background: '#0f172a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, marginBottom: 10 }}>🎯 Kalkulator BEP Balik Modal</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Biaya Operasional/bulan (Rp)</label>
                    <input type="number" value={form.biaya_operasional}
                      onChange={e => setForm({ ...form, biaya_operasional: e.target.value })}
                      placeholder="Sewa, gaji, listrik..." style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Target Porsi/bulan</label>
                    <input type="number" value={form.target_porsi_bulan}
                      onChange={e => setForm({ ...form, target_porsi_bulan: e.target.value })}
                      placeholder="cth: 300" style={S.input} />
                  </div>
                </div>

                {biayaOps > 0 && profitPerPorsi > 0 && (
                  <div style={{ background: '#0f2a1a', borderRadius: 8, padding: 12, border: '1px solid #166534' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#4ade80' }}>BEP Porsi/bulan</div>
                        <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 20 }}>{bepPorsi}</div>
                        <div style={{ fontSize: 10, color: '#86efac' }}>porsi minimum</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#4ade80' }}>BEP Omzet/bulan</div>
                        <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 16 }}>{formatRupiah(bepOmzet)}</div>
                        <div style={{ fontSize: 10, color: '#86efac' }}>omzet minimum</div>
                      </div>
                    </div>

                    {targetBulan > 0 && (
                      <div style={{ marginTop: 10, padding: 10, background: '#1e293b', borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                          {targetBulan >= bepPorsi
                            ? `✅ Target ${targetBulan} porsi TERCAPAI BEP (min ${bepPorsi})`
                            : `⚠️ Target ${targetBulan} porsi BELUM mencapai BEP (min ${bepPorsi})`}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: estimasiProfitBulan >= 0 ? '#10b981' : '#ef4444' }}>
                          Estimasi {estimasiProfitBulan >= 0 ? 'Profit' : 'Rugi'}/bulan: {formatRupiah(Math.abs(estimasiProfitBulan))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Catatan */}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Catatan (opsional)</label>
                <input value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })}
                  placeholder="cth: resep untuk 5 porsi ricebowl" style={S.input} />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={resetForm}
                  style={{ flex: 1, padding: 12, background: '#334155', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  Batal
                </button>
                <button onClick={handleSaveResep}
                  style={{ flex: 2, padding: 12, background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                  💾 Simpan Resep
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
