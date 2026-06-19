import React, { useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { MENU_ITEMS, MENU_CATEGORIES, formatRupiah } from '../data/menuData';
import toast from 'react-hot-toast';

export default function POS({ session }) {
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('SEMUA');
  const [nama, setNama] = useState('');
  const [ket, setKet] = useState('');
  const [payment, setPayment] = useState('BCA');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const filtered = useMemo(() => MENU_ITEMS.filter(i =>
    i.nama.toLowerCase().includes(search.toLowerCase()) &&
    (cat === 'SEMUA' || i.kategori === cat)
  ), [search, cat]);

  const addToCart = (item) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id);
      if (ex) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => setCart(prev =>
    prev.map(c => c.id === id ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0)
  );

  const total = cart.reduce((s, i) => s + i.harga * i.qty, 0);
  const totalHpp = cart.reduce((s, i) => s + i.hpp * i.qty, 0);

  const checkout = async () => {
    if (!cart.length) return toast.error('Keranjang kosong!');
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const orderNum = `ORD-${Date.now()}`;
      const rows = cart.map(item => ({
        tanggal: today,
        nama: nama || 'Pelanggan',
        keterangan: ket,
        item: item.nama,
        kategori: item.kategori,
        harga: item.harga,
        qty: item.qty,
        total: item.harga * item.qty,
        hpp: item.hpp * item.qty,
        profit: (item.harga - item.hpp) * item.qty,
        tf: payment,
        status: 'Lunas',
        order_num: orderNum,
        is_historical: false,
      }));
      const { error } = await supabase.from('transactions').insert(rows);
      if (error) throw error;
      setReceipt({ cart: [...cart], total, nama, ket, payment, orderNum, date: today });
      setCart([]);
      setNama('');
      setKet('');
      toast.success('Transaksi berhasil! 🎉');
    } catch (err) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const S = {
    input: { width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none' },
  };

  if (receipt) return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ background: '#1e293b', borderRadius: 20, overflow: 'hidden', border: '1px solid #334155' }}>
        <div style={{ background: '#f97316', padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🍽️</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>Kedai MangLeman</div>
          <div style={{ color: '#fed7aa', fontSize: 13 }}>Struk Pembayaran</div>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            <div>No: {receipt.orderNum}</div>
            <div>Tgl: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            {receipt.nama && receipt.nama !== 'Pelanggan' && <div>Nama: {receipt.nama}</div>}
            {receipt.ket && <div>Lokasi: {receipt.ket}</div>}
            <div>Bayar: {receipt.payment}</div>
          </div>
          <div style={{ borderTop: '1px solid #334155', paddingTop: 12, marginBottom: 12 }}>
            {receipt.cart.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: '#cbd5e1' }}>{i.nama} ×{i.qty}</span>
                <span style={{ color: '#f97316', fontWeight: 600 }}>{formatRupiah(i.harga * i.qty)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, borderTop: '1px solid #334155', paddingTop: 12 }}>
            <span>TOTAL</span>
            <span style={{ color: '#f97316' }}>{formatRupiah(receipt.total)}</span>
          </div>
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#64748b', fontSize: 13 }}>🙏 Terima kasih!</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => window.print()} style={{ flex: 1, padding: 12, background: '#334155', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>🖨️ Print</button>
            <button onClick={() => setReceipt(null)} style={{ flex: 1, padding: 12, background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>✅ Baru</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 80px)' }}>
      {/* Menu */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>🛒 POS Kasir</h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari menu..." style={{ ...S.input, marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
          {['SEMUA', ...MENU_CATEGORIES].map(c => (
            <button key={c} onClick={() => setCat(c)} style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: cat === c ? '#f97316' : '#1e293b', color: cat === c ? '#fff' : '#94a3b8'
            }}>{c}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, alignContent: 'start' }}>
          {filtered.map(item => (
            <button key={item.id} onClick={() => addToCart(item)} style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 12,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{item.emoji}</div>
              <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{item.nama}</div>
              <div style={{ color: '#f97316', fontWeight: 700, fontSize: 13 }}>{formatRupiah(item.harga)}</div>
              {item.hpp > 0 && <div style={{ color: '#10b981', fontSize: 11 }}>Margin: {Math.round((item.harga - item.hpp) / item.harga * 100)}%</div>}
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div style={{ width: 280, flexShrink: 0, background: '#1e293b', borderRadius: 16, border: '1px solid #334155', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #334155', fontWeight: 700 }}>🛒 Keranjang ({cart.length})</div>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama pelanggan" style={{ ...S.input, fontSize: 12 }} />
          <input value={ket} onChange={e => setKet(e.target.value)} placeholder="Lokasi / keterangan" style={{ ...S.input, fontSize: 12 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>
              <div style={{ fontSize: 36 }}>🛒</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Pilih menu di kiri</div>
            </div>
          ) : cart.map(item => (
            <div key={item.id} style={{ background: '#0f172a', borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>{item.emoji} {item.nama}</div>
              <div style={{ color: '#f97316', fontSize: 11, marginTop: 2 }}>{formatRupiah(item.harga)}/item</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => updateQty(item.id, -1)} style={{ width: 26, height: 26, background: '#334155', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>−</button>
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} style={{ width: 26, height: 26, background: '#f97316', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>+</button>
                </div>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{formatRupiah(item.harga * item.qty)}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid #334155' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {['Cash', 'BCA', 'BRI', 'Mandiri', 'Qris', 'Transfer'].map(m => (
              <button key={m} onClick={() => setPayment(m)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: payment === m ? '#f97316' : '#334155', color: payment === m ? '#fff' : '#94a3b8'
              }}>{m}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
            <span>HPP</span><span>{formatRupiah(totalHpp)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#10b981', marginBottom: 8 }}>
            <span>Est. Profit</span><span>{formatRupiah(total - totalHpp)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
            <span>Total</span><span style={{ color: '#f97316' }}>{formatRupiah(total)}</span>
          </div>
          <button onClick={checkout} disabled={loading || !cart.length} style={{
            width: '100%', padding: '14px', background: '#f97316', border: 'none', borderRadius: 12,
            color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: loading || !cart.length ? 0.5 : 1
          }}>
            {loading ? '⏳...' : `✅ Bayar ${formatRupiah(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
