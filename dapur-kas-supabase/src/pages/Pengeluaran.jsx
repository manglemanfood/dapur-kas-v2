// src/pages/Pengeluaran.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { formatRupiah } from '../data/menuData';
import toast from 'react-hot-toast';

const KATEGORI = ['Bahan Baku', 'Kemasan', 'Gas / BBM', 'Listrik & Air', 'Gaji', 'Sewa', 'Peralatan', 'Lainnya'];

export default function Pengeluaran() {
  const [data, setData] = useState([]);
  const [bahanList, setBahanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('scan');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [scanning, setScanning] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);
  const [form, setForm] = useState({ tanggal: new Date().toISOString().split('T')[0] });
  const [items, setItems] = useState([{ nama_item: '', kategori: 'Bahan Baku', jumlah: '1', satuan: 'pcs', harga_satuan: '', supplier: '' }]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

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

  // AI Scan nota dengan Claude Vision
  const handleScanNota = async (file) => {
    if (!file) return;
    setScanning(true);

    // Preview image
    const reader = new FileReader();
    reader.onload = (e) => setPreviewImg(e.target.result);
    reader.readAsDataURL(file);

    try {
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result.split(',')[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      const mediaType = file.type || 'image/jpeg';

      // Call Claude API dengan vision
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 }
              },
              {
                type: 'text',
                text: `Kamu adalah asisten kasir yang membantu membaca nota belanja. 
Analisa gambar nota/struk belanja ini dan ekstrak semua item belanjaan.

Jawab HANYA dalam format JSON seperti ini, tanpa teks lain:
{
  "tanggal": "YYYY-MM-DD atau kosong jika tidak ada",
  "supplier": "nama toko/supplier",
  "total": 0,
  "items": [
    {
      "nama_item": "nama barang",
      "kategori": "Bahan Baku",
      "jumlah": 1,
      "satuan": "pcs/gram/kg/liter/dll",
      "harga_satuan": 0,
      "subtotal": 0
    }
  ]
}

Untuk kategori, pilih dari: Bahan Baku, Kemasan, Gas / BBM, Listrik & Air, Gaji, Sewa, Peralatan, Lainnya.
Untuk satuan, gunakan: gram, kg, ml, liter, pcs, ikat, buah, bungkus, botol, lusin.
Jika tanggal tidak ada di nota, kosongkan saja.
Pastikan harga dalam Rupiah (angka saja, tanpa simbol).`
              }
            ]
          }]
        })
      });

      const result = await response.json();
      const text = result.content?.[0]?.text || '';

      // Parse JSON dari response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Format tidak valid');

      const parsed = JSON.parse(jsonMatch[0]);

      // Update form dengan data dari AI
      if (parsed.tanggal && parsed.tanggal !== '') {
        setForm(prev => ({ ...prev, tanggal: parsed.tanggal }));
      }

      if (parsed.items && parsed.items.length > 0) {
        setItems(parsed.items.map(item => ({
          nama_item: item.nama_item || '',
          kategori: item.kategori || 'Bahan Baku',
          jumlah: String(item.jumlah || 1),
          satuan: item.satuan || 'pcs',
          harga_satuan: String(item.harga_satuan || 0),
          supplier: parsed.supplier || '',
        })));
        toast.success(`✅ AI berhasil membaca ${parsed.items.length} item dari nota!`);
      } else {
        toast.error('Tidak ada item yang terdeteksi. Coba foto lebih jelas.');
      }

    } catch (err) {
      console.error(err);
      toast.error('Gagal membaca nota. Pastikan foto jelas dan terang.');
    } finally {
      setScanning(false);
    }
  };

  const handleSaveBulk = async () => {
    const valid = items.filter(i => i.nama_item && i.harga_satuan);
    if (!valid.length) return toast.error('Isi minimal 1 item!');
    setSaving(true);
    try {
      const rows = valid.map(i => ({
        tanggal: form.tanggal,
        kategori: i.kategori,
        nama_item: i.nama_item,
        jumlah: parseFloat(i.jumlah) || 1,
        satuan: i.satuan,
        harga_satuan: parseFloat(i.harga_satuan) || 0,
        total: (parseFloat(i.jumlah) || 1) * (parseFloat(i.harga_satuan) || 0),
        supplier: i.supplier || '',
      }));

      const { error } = await supabase.from('pengeluaran').insert(rows);
      if (error) throw error;

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
      setItems([{ nama_item: '', kategori: 'Bahan Baku', jumlah: '1', satuan: 'pcs', harga_satuan: '', supplier: '' }]);
      setPreviewImg(null);
      setTab('riwayat');
      fetchData();
    } catch (err) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data ini?')) return;
    await supabase.from('pengeluaran').delete().eq('id', id);
    toast.success('Dihapus!');
    fetchData();
  };

  const addRow = () => setItems([...items, { nama_item: '', kategori: 'Bahan Baku', jumlah: '1', satuan: 'pcs', harga_satuan: '', supplier: '' }]);
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
        <p style={{ color: '#64748b', fontSize: 13 }}>Scan nota atau input manual belanja bahan baku</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#1e293b', borderRadius: 12, padding: 4 }}>
        {[['scan', '📷 Scan Nota'], ['manual', '✏️ Input Manual'], ['riwayat', '📋 Riwayat']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '10px', border: 'none', cursor: 'pointer', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: tab === id ? '#f97316' : 'transparent', color: tab === id ? '#fff' : '#94a3b8'
          }}>{label}</button>
        ))}
      </div>

      {/* SCAN TAB */}
      {tab === 'scan' && (
        <div>
          {/* Upload area */}
          <div
            onClick={() => !scanning && fileRef.current?.click()}
            style={{
              border: `2px dashed ${scanning ? '#f97316' : '#334155'}`,
              borderRadius: 16, padding: 32, textAlign: 'center', cursor: scanning ? 'wait' : 'pointer',
              background: scanning ? '#f9731610' : '#1e293b', marginBottom: 16, transition: 'all 0.3s'
            }}
          >
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleScanNota(e.target.files[0])} />

            {scanning ? (
              <div>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
                <div style={{ color: '#f97316', fontWeight: 700, fontSize: 16 }}>AI sedang membaca nota...</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Harap tunggu sebentar</div>
                <div style={{ marginTop: 16, height: 4, background: '#334155', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#f97316', borderRadius: 2, animation: 'progress 1.5s infinite ease-in-out', width: '60%' }} />
                </div>
              </div>
            ) : previewImg ? (
              <div>
                <img src={previewImg} alt="nota" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, marginBottom: 12 }} />
                <div style={{ color: '#10b981', fontWeight: 600 }}>✅ Nota sudah dibaca AI</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Klik untuk ganti foto</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 56, marginBottom: 12 }}>📷</div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>Foto Nota / Upload Gambar</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Kamera HP atau pilih dari galeri</div>
                <div style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>AI akan otomatis membaca item & harga</div>
              </div>
            )}
          </div>

          {/* Tips */}
          {!previewImg && !scanning && (
            <div style={{ background: '#0c1a3a', border: '1px solid #1d4ed8', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ color: '#60a5fa', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>💡 Tips foto nota yang baik:</div>
              <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.8 }}>
                • Pastikan pencahayaan cukup terang<br/>
                • Nota tidak terlipat atau kusut<br/>
                • Semua teks terbaca jelas<br/>
                • Foto dari atas / tegak lurus
              </div>
            </div>
          )}

          {/* Hasil scan - edit form */}
          {previewImg && !scanning && (
            <div>
              <div style={{ background: '#022c22', border: '1px solid #065f46', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ color: '#10b981', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>✅ AI berhasil membaca nota!</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>Cek dan edit jika ada yang tidak sesuai sebelum menyimpan.</div>
              </div>

              {/* Tanggal */}
              <div style={{ background: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 14, border: '1px solid #334155' }}>
                <label style={{ ...S.label, fontSize: 13 }}>📅 Tanggal Belanja</label>
                <input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} style={{ ...S.input, width: 'auto' }} />
              </div>

              {/* Item list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {items.map((item, i) => (
                  <div key={i} style={{ background: '#1e293b', borderRadius: 12, padding: 14, border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, color: '#94a3b8', fontSize: 12 }}>Item #{i+1}</span>
                      {items.length > 1 && <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={S.label}>Nama Item</label>
                        <input value={item.nama_item} onChange={e => updateRow(i, 'nama_item', e.target.value)} style={S.input} />
                      </div>
                      <div>
                        <label style={S.label}>Jumlah</label>
                        <input type="number" value={item.jumlah} onChange={e => updateRow(i, 'jumlah', e.target.value)} style={S.input} />
                      </div>
                      <div>
                        <label style={S.label}>Satuan</label>
                        <select value={item.satuan} onChange={e => updateRow(i, 'satuan', e.target.value)} style={S.input}>
                          {['gram','kg','ml','liter','pcs','ikat','buah','bungkus','botol','lusin'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={S.label}>Harga Satuan</label>
                        <input type="number" value={item.harga_satuan} onChange={e => updateRow(i, 'harga_satuan', e.target.value)} style={S.input} />
                      </div>
                      <div>
                        <label style={S.label}>Kategori</label>
                        <select value={item.kategori} onChange={e => updateRow(i, 'kategori', e.target.value)} style={S.input}>
                          {KATEGORI.map(k => <option key={k}>{k}</option>)}
                        </select>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={S.label}>Supplier</label>
                        <input value={item.supplier} onChange={e => updateRow(i, 'supplier', e.target.value)} placeholder="Nama toko" style={S.input} />
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

              <button onClick={addRow} style={{ width: '100%', padding: '10px', background: 'transparent', border: '2px dashed #334155', borderRadius: 10, color: '#64748b', cursor: 'pointer', marginBottom: 12 }}>
                + Tambah Item Manual
              </button>

              {totalBelanja > 0 && (
                <div style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Total Belanja</span>
                  <span style={{ color: '#f97316', fontWeight: 700, fontSize: 20 }}>{formatRupiah(totalBelanja)}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setPreviewImg(null); setItems([{ nama_item: '', kategori: 'Bahan Baku', jumlah: '1', satuan: 'pcs', harga_satuan: '', supplier: '' }]); }} style={{ flex: 1, padding: 14, background: '#334155', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  🔄 Scan Ulang
                </button>
                <button onClick={handleSaveBulk} disabled={saving} style={{ flex: 2, padding: 14, background: '#f97316', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 15, opacity: saving ? 0.7 : 1 }}>
                  {saving ? '⏳ Menyimpan...' : '💾 Simpan Pengeluaran'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANUAL TAB */}
      {tab === 'manual' && (
        <div>
          <div style={{ background: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 14, border: '1px solid #334155' }}>
            <label style={{ ...S.label, fontSize: 13 }}>📅 Tanggal Belanja</label>
            <input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} style={{ ...S.input, width: 'auto' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
            {items.map((item, i) => (
              <div key={i} style={{ background: '#1e293b', borderRadius: 14, padding: 14, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, color: '#94a3b8', fontSize: 13 }}>Item #{i+1}</span>
                  {items.length > 1 && <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>✕</button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={S.label}>Nama Item *</label>
                    <input value={item.nama_item} onChange={e => updateRow(i, 'nama_item', e.target.value)} placeholder="cth: Ayam Fillet, Tepung..." list={`bahan-${i}`} style={S.input} />
                    <datalist id={`bahan-${i}`}>{bahanList.map(b => <option key={b.id} value={b.nama} />)}</datalist>
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
                    <input type="number" value={item.jumlah} onChange={e => updateRow(i, 'jumlah', e.target.value)} style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Satuan</label>
                    <select value={item.satuan} onChange={e => updateRow(i, 'satuan', e.target.value)} style={S.input}>
                      {['gram','kg','ml','liter','pcs','ikat','buah','bungkus','botol'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={S.label}>Harga Satuan</label>
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
          <button onClick={addRow} style={{ width: '100%', padding: '12px', background: '#1e293b', border: '2px dashed #334155', borderRadius: 12, color: '#64748b', cursor: 'pointer', fontSize: 14, marginBottom: 14 }}>+ Tambah Item</button>
          {totalBelanja > 0 && (
            <div style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>Total Belanja</span>
              <span style={{ color: '#f97316', fontWeight: 700, fontSize: 20 }}>{formatRupiah(totalBelanja)}</span>
            </div>
          )}
          <button onClick={handleSaveBulk} disabled={saving} style={{ width: '100%', padding: '16px', background: '#f97316', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? '⏳ Menyimpan...' : '💾 Simpan Pengeluaran'}
          </button>
        </div>
      )}

      {/* RIWAYAT TAB */}
      {tab === 'riwayat' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...S.input, width: 'auto' }}>
              {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</option>)}
            </select>
          </div>
          <div style={{ background: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 14, border: '1px solid #334155' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Total Pengeluaran</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{formatRupiah(summary.total)}</div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(summary.byCat).sort(([,a],[,b]) => b-a).map(([cat, val]) => (
                <div key={cat} style={{ background: '#0f172a', borderRadius: 8, padding: '5px 10px' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{cat}: </span>
                  <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 12 }}>{formatRupiah(val)}</span>
                </div>
              ))}
            </div>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>⚙️ Memuat...</div>
          : data.length === 0 ? (
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

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
