// src/pages/Pengeluaran.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { formatRupiah } from '../data/menuData';
import toast from 'react-hot-toast';

const KATEGORI = ['Bahan Baku', 'Kemasan', 'Gas / BBM', 'Listrik & Air', 'Gaji', 'Sewa', 'Peralatan', 'Lainnya'];

export default function Pengeluaran() {
  const [data, setData] = useState([]);
  const [bahanList, setBahanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('input');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    kategori: 'Bahan Baku', nama_item: '', jumlah: '', satuan: 'gram',
    harga_satuan: '', supplier: '', catatan: ''
  });
  const [items, setItems] = useState([{ nama_item: '', kategori: 'Bahan Baku', jumlah: '', satuan: 'gram', harga_satuan: '', supplier: '' }]);

  useEffect(() => {
    fetchData();
    supabase.from('bahan_baku').select('*').order('nama').then(({ data }) => setBahanList(data || []));
  }, [filterMonth]);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows } = await supabase.from('pengeluaran')
      .select('*')
      .gte('tanggal', filterMonth + '-01')
      .lte('tanggal', filterMonth + '-31')
      .order('tanggal', { ascending: false });
    setData(rows || []);
    setLoading(false);
  };

  const handleSaveBulk = async () => {
    const valid = items.filter(i => i.nama_item && i.harga_satuan);
    if (!valid.length) return toast.error('Isi minimal 1 item!');
    const rows = valid.map(i => ({
      tanggal: form.tanggal,
      kategori: i.kategori,
      nama_item: i.nama_item,
      jumlah: parseFloat(i.jumlah) || 1,
      satuan: i.satuan,
      harga_satuan: parseFloat(i.harga_satuan) || 0,
      total: (parseFloat(i.jumlah) || 1) * (parseFloat(i.harga_satuan) || 0),
      supplier: i.supplier,
    }));
    const { error } = await supabase.from('pengeluaran').insert(rows);
    if (error) return toast.error(error.message);

    // Update harga bahan baku otomatis
    for (const i of valid) {
      const bahan = bahanList.find(b => b.nama.toLowerCase() === i.nama_item.toLowerCase());
      if (bahan && i.harga_satuan) {
        const hargaBaru = parseFloat(i.harga_satuan);
        await supabase.from('bahan_baku').update({ harga_terakhir: hargaBaru, updated_at: new Date().toISOString() }).eq('id', bahan.id);
        await supabase.from('harga_bahan').insert({
          bahan_id: bahan.id, nama_bahan: bahan.nama, tanggal: form.tanggal,
          harga: hargaBaru, jumlah: parseFloat(i.jumlah) || 1, satuan: i.satuan,
          total_bayar: (parseFloat(i.jumlah) || 1) * hargaBaru, supplier: i.supplier
        });
      }
    }

    toast.success(`${rows.length} pengeluaran tersimpan! ✅`);
    setItems([{ nama_item: '', kategori: 'Bahan Baku', jumlah: '', satuan: 'gram', harga_satuan: '', supplier: '' }]);
    setTab('riwayat');
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data ini?')) return;
    await supabase.from('pengeluaran').delete().eq('id', id);
    toast.success('Dihapus!');
    fetchData();
  };

  const addRow = () => setItems([...items, { nama_item: '', kategori: 'Bahan Baku', jumlah: '', satuan: 'gram', harga_satuan: '', supplier: '' }]);
  const removeRow = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateRow = (i, key, val) => setItems(items.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const summary = useMemo(() => {
    const total = data.reduce((s, d) => s + (d.total || 0), 0);
    const byCat = {};
    data.forEach(d => { byCat[d.kategori] = (byCat[d.kategori] || 0) + (d.total || 0); });
    return { total, byCat };
  }, [data]);

  const totalBelanja = items.reduce((s, i) => s + ((parseFloat(i.jumlah) || 0) * (parseFloat(i.harga_satuan) || 0)), 0);

  const S = {
    input: { width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' },
    label: { fontSize: 11, color: '#94a3b8', marginBottom: 3, display: 'block' },
  };

  // Generate months for filter
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>💸 Tracker Pengeluaran</h1>
        <p style={{ color: '#64748b', fontSize: 13 }}>Catat belanja bahan baku & operasional</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#1e293b', borderRadius: 12, padding: 4 }}>
        {[['input', '✏️ Input Belanja'], ['riwayat', '📋 Riwayat']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '10px', border: 'none', cursor: 'pointer', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: tab === id ? '#f97316' : 'transparent', color: tab === id ? '#fff' : '#94a3b8'
          }}>{label}</button>
        ))}
      </div>

      {tab === 'input' && (
        <div>
          {/* Date */}
          <div style={{ background: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 16, border: '1px solid #334155' }}>
            <label style={{ ...S.label, fontSize: 13 }}>📅 Tanggal Belanja</label>
            <input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} style={{ ...S.input, width: 'auto' }} />
          </div>

          {/* Item rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {items.map((item, i) => (
              <div key={i} style={{ background: '#1e293b', borderRadius: 14, padding: 14, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, color: '#94a3b8', fontSize: 13 }}>Item #{i+1}</span>
                  {items.length > 1 && <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>✕</button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={S.label}>Nama Item *</label>
                    <input
                      value={item.nama_item}
                      onChange={e => updateRow(i, 'nama_item', e.target.value)}
                      placeholder="cth: Ayam Fillet, Tepung..."
                      list={`bahan-list-${i}`}
                      style={S.input}
                    />
                    <datalist id={`bahan-list-${i}`}>
                      {bahanList.map(b => <option key={b.id} value={b.nama} />)}
                    </datalist>
                  </div>
                  <div>
                    <label style={S.label}>Kategori</label>
                    <select value={item.kategori} onChange={e => updateRow(i, 'kategori', e.target.value)} style={S.input}>
                      {KATEGORI.map(k => <option key={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Supplier</label>
                    <input value={item.supplier} onChange={e => updateRow(i, 'supplier', e.target.value)} placeholder="Pasar, Superindo..." style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Jumlah</label>
                    <input type="number" value={item.jumlah} onChange={e => updateRow(i, 'jumlah', e.target.value)} placeholder="1" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Satuan</label>
                    <select value={item.satuan} onChange={e => updateRow(i, 'satuan', e.target.value)} style={S.input}>
                      {['gram', 'kg', 'ml', 'liter', 'pcs', 'ikat', 'buah', 'bungkus', 'botol'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={S.label}>Harga Satuan (per {item.satuan})</label>
                    <input type="number" value={item.harga_satuan} onChange={e => updateRow(i, 'harga_satuan', e.target.value)} placeholder="0" style={S.input} />
                  </div>
                  {item.jumlah && item.harga_satuan && (
                    <div style={{ gridColumn: '1 / -1', background: '#0f172a', borderRadius: 8, padding: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontSize: 12 }}>Subtotal</span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>{formatRupiah(parseFloat(item.jumlah) * parseFloat(item.harga_satuan))}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={addRow} style={{ width: '100%', padding: '12px', background: '#1e293b', border: '2px dashed #334155', borderRadius: 12, color: '#64748b', cursor: 'pointer', fontSize: 14, marginBottom: 16 }}>
            + Tambah Item
          </button>

          {totalBelanja > 0 && (
            <div style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>Total Belanja</span>
              <span style={{ color: '#f97316', fontWeight: 700, fontSize: 20 }}>{formatRupiah(totalBelanja)}</span>
            </div>
          )}

          <button onClick={handleSaveBulk} style={{ width: '100%', padding: '16px', background: '#f97316', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            💾 Simpan Pengeluaran
          </button>
        </div>
      )}

      {tab === 'riwayat' && (
        <div>
          {/* Filter month */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...S.input, width: 'auto' }}>
              {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</option>)}
            </select>
          </div>

          {/* Summary */}
          <div style={{ background: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 16, border: '1px solid #334155' }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Total Pengeluaran Bulan Ini</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>{formatRupiah(summary.total)}</div>
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(summary.byCat).sort(([,a],[,b]) => b-a).map(([cat, val]) => (
                <div key={cat} style={{ background: '#0f172a', borderRadius: 8, padding: '6px 12px' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{cat}</div>
                  <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>{formatRupiah(val)}</div>
                </div>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>⚙️ Memuat...</div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: '#1e293b', borderRadius: 16, color: '#64748b' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>💸</div>
              <div>Belum ada pengeluaran bulan ini</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.map(d => (
                <div key={d.id} style={{ background: '#1e293b', borderRadius: 12, padding: 14, border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{d.nama_item}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                        {new Date(d.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · {d.jumlah} {d.satuan} · {d.kategori}
                        {d.supplier ? ` · ${d.supplier}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{formatRupiah(d.harga_satuan)} / {d.satuan}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: '#ef4444', fontWeight: 700 }}>{formatRupiah(d.total)}</div>
                      <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 11, marginTop: 4 }}>Hapus</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
