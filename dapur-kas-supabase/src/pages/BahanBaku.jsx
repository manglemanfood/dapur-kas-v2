// src/pages/BahanBaku.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatRupiah } from '../data/menuData';
import toast from 'react-hot-toast';

const KATEGORI = ['Protein', 'Sayuran', 'Bumbu', 'Minyak & Lemak', 'Karbohidrat', 'Minuman', 'Kemasan', 'Lainnya'];

export default function BahanBaku() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKat, setFilterKat] = useState('Semua');
  const [showForm, setShowForm] = useState(false);
  const [showHarga, setShowHarga] = useState(null); // bahan_id
  const [hargaHistory, setHargaHistory] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [showUpdateHarga, setShowUpdateHarga] = useState(null);

  const [form, setForm] = useState({ nama: '', kategori: 'Protein', satuan: 'gram', harga_terakhir: '', supplier: '', catatan: '' });
  const [hargaForm, setHargaForm] = useState({ tanggal: new Date().toISOString().split('T')[0], harga: '', jumlah: '', satuan: 'gram', supplier: '', catatan: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data } = await supabase.from('bahan_baku').select('*').order('nama');
    setItems(data || []);
    setLoading(false);
  };

  const fetchHarga = async (bahanId) => {
    const { data } = await supabase.from('harga_bahan').select('*').eq('bahan_id', bahanId).order('tanggal', { ascending: false });
    setHargaHistory(data || []);
    setShowHarga(bahanId);
  };

  const handleSave = async () => {
    if (!form.nama) return toast.error('Nama bahan wajib diisi!');
    const payload = { ...form, harga_terakhir: parseFloat(form.harga_terakhir) || 0, updated_at: new Date().toISOString() };
    if (editItem) {
      const { error } = await supabase.from('bahan_baku').update(payload).eq('id', editItem.id);
      if (error) return toast.error(error.message);
      toast.success('Bahan diupdate!');
    } else {
      const { error } = await supabase.from('bahan_baku').insert(payload);
      if (error) return toast.error(error.message);
      toast.success('Bahan ditambahkan!');
    }
    setShowForm(false);
    setEditItem(null);
    setForm({ nama: '', kategori: 'Protein', satuan: 'gram', harga_terakhir: '', supplier: '', catatan: '' });
    fetchData();
  };

  const handleUpdateHarga = async (bahan) => {
    if (!hargaForm.harga) return toast.error('Harga wajib diisi!');
    const harga = parseFloat(hargaForm.harga);
    const jumlah = parseFloat(hargaForm.jumlah) || 1;
    const total = harga * jumlah;

    // Save to harga history
    await supabase.from('harga_bahan').insert({
      bahan_id: bahan.id, nama_bahan: bahan.nama,
      tanggal: hargaForm.tanggal, harga, jumlah,
      satuan: hargaForm.satuan || bahan.satuan,
      total_bayar: total, supplier: hargaForm.supplier, catatan: hargaForm.catatan
    });
    // Update latest price
    await supabase.from('bahan_baku').update({ harga_terakhir: harga, updated_at: new Date().toISOString() }).eq('id', bahan.id);
    toast.success(`Harga ${bahan.nama} diupdate!`);
    setShowUpdateHarga(null);
    setHargaForm({ tanggal: new Date().toISOString().split('T')[0], harga: '', jumlah: '', satuan: 'gram', supplier: '', catatan: '' });
    fetchData();
    if (showHarga === bahan.id) fetchHarga(bahan.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus bahan ini?')) return;
    await supabase.from('bahan_baku').delete().eq('id', id);
    toast.success('Dihapus!');
    fetchData();
  };

  const filtered = items.filter(i =>
    i.nama?.toLowerCase().includes(search.toLowerCase()) &&
    (filterKat === 'Semua' || i.kategori === filterKat)
  );

  const S = {
    input: { width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none' },
    label: { fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' },
    btn: (color = '#f97316') => ({ padding: '10px 18px', background: color, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }),
  };

  const Modal = ({ title, onClose, children }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 480, border: '1px solid #334155', maxHeight: '90vh', overflowY: 'auto' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>📦 Master Bahan Baku</h1>
          <p style={{ color: '#64748b', fontSize: 13 }}>{items.length} bahan terdaftar</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditItem(null); setForm({ nama: '', kategori: 'Protein', satuan: 'gram', harga_terakhir: '', supplier: '', catatan: '' }); }} style={S.btn()}>+ Tambah Bahan</button>
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari bahan..." style={{ ...S.input, flex: 1, minWidth: 200 }} />
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 4 }}>
        {['Semua', ...KATEGORI].map(k => (
          <button key={k} onClick={() => setFilterKat(k)} style={{
            flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: filterKat === k ? '#f97316' : '#1e293b', color: filterKat === k ? '#fff' : '#94a3b8'
          }}>{k}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⚙️ Memuat...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#1e293b', borderRadius: 16, color: '#64748b' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
          <div>Belum ada bahan baku</div>
          <button onClick={() => setShowForm(true)} style={{ ...S.btn(), marginTop: 12 }}>+ Tambah Sekarang</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => (
            <div key={item.id} style={{ background: '#1e293b', borderRadius: 14, padding: 16, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 15 }}>{item.nama}</span>
                    <span style={{ background: '#334155', color: '#94a3b8', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>{item.kategori}</span>
                  </div>
                  <div style={{ color: '#f97316', fontWeight: 700, fontSize: 16, marginTop: 6 }}>
                    {formatRupiah(item.harga_terakhir)} / {item.satuan}
                  </div>
                  {item.supplier && <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>🏪 {item.supplier}</div>}
                  {item.updated_at && <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>Update: {new Date(item.updated_at).toLocaleDateString('id-ID')}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => setShowUpdateHarga(item)} style={{ ...S.btn('#10b981'), padding: '6px 12px', fontSize: 12 }}>💰 Update Harga</button>
                  <button onClick={() => fetchHarga(item.id)} style={{ ...S.btn('#3b82f6'), padding: '6px 12px', fontSize: 12 }}>📋 Histori</button>
                  <button onClick={() => { setEditItem(item); setForm({ nama: item.nama, kategori: item.kategori, satuan: item.satuan, harga_terakhir: item.harga_terakhir, supplier: item.supplier || '', catatan: item.catatan || '' }); setShowForm(true); }} style={{ ...S.btn('#334155'), padding: '6px 12px', fontSize: 12 }}>✏️ Edit</button>
                  <button onClick={() => handleDelete(item.id)} style={{ ...S.btn('#ef4444'), padding: '6px 12px', fontSize: 12 }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <Modal title={editItem ? '✏️ Edit Bahan' : '+ Tambah Bahan Baku'} onClose={() => { setShowForm(false); setEditItem(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={S.label}>Nama Bahan *</label><input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="cth: Ayam Fillet" style={S.input} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={S.label}>Kategori</label>
                <select value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })} style={S.input}>
                  {KATEGORI.map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Satuan</label>
                <select value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} style={S.input}>
                  {['gram', 'kg', 'ml', 'liter', 'pcs', 'ikat', 'buah', 'sdm', 'sdt', 'bungkus'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div><label style={S.label}>Harga Terakhir (per satuan)</label><input type="number" value={form.harga_terakhir} onChange={e => setForm({ ...form, harga_terakhir: e.target.value })} placeholder="0" style={S.input} /></div>
            <div><label style={S.label}>Supplier / Tempat Beli</label><input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="cth: Pasar Induk, Supermarket" style={S.input} /></div>
            <div><label style={S.label}>Catatan</label><input value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} style={S.input} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowForm(false); setEditItem(null); }} style={{ ...S.btn('#334155'), flex: 1 }}>Batal</button>
              <button onClick={handleSave} style={{ ...S.btn(), flex: 1 }}>💾 Simpan</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Update Harga Modal */}
      {showUpdateHarga && (
        <Modal title={`💰 Update Harga: ${showUpdateHarga.nama}`} onClose={() => setShowUpdateHarga(null)}>
          <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>Harga saat ini</div>
            <div style={{ color: '#f97316', fontWeight: 700, fontSize: 18 }}>{formatRupiah(showUpdateHarga.harga_terakhir)} / {showUpdateHarga.satuan}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={S.label}>Tanggal Beli</label><input type="date" value={hargaForm.tanggal} onChange={e => setHargaForm({ ...hargaForm, tanggal: e.target.value })} style={S.input} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={S.label}>Harga Beli (per satuan)</label><input type="number" value={hargaForm.harga} onChange={e => setHargaForm({ ...hargaForm, harga: e.target.value })} placeholder="0" style={S.input} /></div>
              <div><label style={S.label}>Jumlah Beli</label><input type="number" value={hargaForm.jumlah} onChange={e => setHargaForm({ ...hargaForm, jumlah: e.target.value })} placeholder="1" style={S.input} /></div>
            </div>
            {hargaForm.harga && hargaForm.jumlah && (
              <div style={{ background: '#0f172a', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Total Bayar</div>
                <div style={{ color: '#10b981', fontWeight: 700 }}>{formatRupiah(parseFloat(hargaForm.harga) * parseFloat(hargaForm.jumlah))}</div>
              </div>
            )}
            <div><label style={S.label}>Supplier</label><input value={hargaForm.supplier} onChange={e => setHargaForm({ ...hargaForm, supplier: e.target.value })} placeholder="Pasar, Supermarket, dll" style={S.input} /></div>
            <div><label style={S.label}>Catatan</label><input value={hargaForm.catatan} onChange={e => setHargaForm({ ...hargaForm, catatan: e.target.value })} style={S.input} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowUpdateHarga(null)} style={{ ...S.btn('#334155'), flex: 1 }}>Batal</button>
              <button onClick={() => handleUpdateHarga(showUpdateHarga)} style={{ ...S.btn('#10b981'), flex: 1 }}>💾 Update Harga</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Harga History Modal */}
      {showHarga && (
        <Modal title={`📋 Histori Harga: ${items.find(i => i.id === showHarga)?.nama}`} onClose={() => setShowHarga(null)}>
          {hargaHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>Belum ada histori harga</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hargaHistory.map((h, i) => (
                <div key={h.id} style={{ background: '#0f172a', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{new Date(h.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{h.jumlah} {h.satuan} {h.supplier ? `· ${h.supplier}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#f97316', fontWeight: 700 }}>{formatRupiah(h.harga)}/{h.satuan}</div>
                      <div style={{ color: '#10b981', fontSize: 12 }}>Total: {formatRupiah(h.total_bayar)}</div>
                    </div>
                  </div>
                  {i > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11 }}>
                      {(() => {
                        const diff = h.harga - hargaHistory[i-1].harga;
                        const pct = Math.abs(diff / hargaHistory[i-1].harga * 100).toFixed(1);
                        return diff > 0 ?
                          <span style={{ color: '#ef4444' }}>📈 Naik {formatRupiah(diff)} ({pct}%) dari sebelumnya</span> :
                          <span style={{ color: '#10b981' }}>📉 Turun {formatRupiah(Math.abs(diff))} ({pct}%) dari sebelumnya</span>;
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
