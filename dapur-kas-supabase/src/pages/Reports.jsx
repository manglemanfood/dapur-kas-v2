import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatRupiah } from '../data/menuData';

export default function Reports() {
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('harian');

  const presets = [
    { l: 'Hari Ini', fn: () => { const t = new Date().toISOString().split('T')[0]; setStartDate(t); setEndDate(t); } },
    { l: 'Kemarin', fn: () => { const t = new Date(); t.setDate(t.getDate()-1); const d=t.toISOString().split('T')[0]; setStartDate(d); setEndDate(d); } },
    { l: '7 Hari', fn: () => { const t=new Date(); t.setDate(t.getDate()-6); setStartDate(t.toISOString().split('T')[0]); setEndDate(new Date().toISOString().split('T')[0]); } },
    { l: 'Bulan Ini', fn: () => { const t=new Date(); setStartDate(new Date(t.getFullYear(),t.getMonth(),1).toISOString().split('T')[0]); setEndDate(t.toISOString().split('T')[0]); } },
    { l: 'Bulan Lalu', fn: () => { const t=new Date(); const s=new Date(t.getFullYear(),t.getMonth()-1,1); const e=new Date(t.getFullYear(),t.getMonth(),0); setStartDate(s.toISOString().split('T')[0]); setEndDate(e.toISOString().split('T')[0]); } },
    { l: 'Feb-Jun 2026', fn: () => { setStartDate('2026-02-01'); setEndDate('2026-06-30'); } },
    { l: 'Semua', fn: () => { setStartDate('2026-01-01'); setEndDate(new Date().toISOString().split('T')[0]); } },
  ];

  useEffect(() => { fetchData(); }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal');
    if (!error) setData(rows || []);
    setLoading(false);
  };

  const report = useMemo(() => {
    const totalOmset = data.reduce((s, t) => s + (t.total || 0), 0);
    const totalHpp = data.reduce((s, t) => s + (t.hpp || 0), 0);
    const totalProfit = data.reduce((s, t) => s + (t.profit || 0), 0);
    const margin = totalOmset > 0 ? (totalProfit / totalOmset * 100).toFixed(1) : 0;

    const byDate = {};
    data.forEach(t => {
      if (!byDate[t.tanggal]) byDate[t.tanggal] = { omset: 0, hpp: 0, profit: 0, count: 0 };
      byDate[t.tanggal].omset += t.total || 0;
      byDate[t.tanggal].hpp += t.hpp || 0;
      byDate[t.tanggal].profit += t.profit || 0;
      byDate[t.tanggal].count += 1;
    });
    const daily = Object.entries(byDate).sort().map(([date, d]) => ({
      date, label: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), ...d,
      margin: d.omset > 0 ? (d.profit / d.omset * 100).toFixed(1) : 0
    }));

    const byItem = {};
    data.forEach(t => {
      if (!byItem[t.item]) byItem[t.item] = { omset: 0, qty: 0, profit: 0 };
      byItem[t.item].omset += t.total || 0;
      byItem[t.item].qty += t.qty || 1;
      byItem[t.item].profit += t.profit || 0;
    });
    const items = Object.entries(byItem).sort(([,a],[,b]) => b.omset - a.omset)
      .map(([nama, d]) => ({ nama, ...d, margin: d.omset > 0 ? (d.profit / d.omset * 100).toFixed(1) : 0 }));

    const byPayment = {};
    data.forEach(t => {
      const p = t.tf || 'Cash';
      if (!byPayment[p]) byPayment[p] = { total: 0, count: 0 };
      byPayment[p].total += t.total || 0;
      byPayment[p].count += 1;
    });

    return { totalOmset, totalHpp, totalProfit, margin, daily, items, byPayment, count: data.length };
  }, [data]);

  const S = {
    input: { padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' },
    card: (color) => ({ background: color + '15', border: `1px solid ${color}40`, borderRadius: 14, padding: 16 }),
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>📈 Laporan Keuangan</h1>

      {/* Filter */}
      <div style={{ background: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 16, border: '1px solid #334155' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {presets.map(({ l, fn }) => (
            <button key={l} onClick={fn} style={{ ...S.input, cursor: 'pointer', fontSize: 12 }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Dari:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={S.input} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Sampai:</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={S.input} />
          </div>
          <button onClick={fetchData} style={{ ...S.input, background: '#f97316', border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 600 }}>🔍 Tampilkan</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⚙️ Memuat laporan...</div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
            <div style={S.card('#f97316')}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Total Omset</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f97316' }}>{formatRupiah(report.totalOmset)}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{report.count} transaksi</div>
            </div>
            <div style={S.card('#ef4444')}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Total HPP</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{formatRupiah(report.totalHpp)}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Harga Pokok</div>
            </div>
            <div style={S.card('#10b981')}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Total Profit</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{formatRupiah(report.totalProfit)}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Omset - HPP</div>
            </div>
            <div style={S.card('#8b5cf6')}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Margin</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{report.margin}%</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{report.daily.length} hari aktif</div>
            </div>
          </div>

          {/* Chart */}
          {report.daily.length > 0 && (
            <div style={{ background: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 16, border: '1px solid #334155' }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>📊 Grafik Harian</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={report.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v, n) => [formatRupiah(v), n === 'omset' ? 'Omset' : n === 'hpp' ? 'HPP' : 'Profit']} />
                  <Bar dataKey="omset" fill="#f97316" radius={[3,3,0,0]} />
                  <Bar dataKey="hpp" fill="#ef4444" radius={[3,3,0,0]} />
                  <Bar dataKey="profit" fill="#10b981" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabs */}
          <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #334155' }}>
              {[['harian', '📅 Per Hari'], ['produk', '🍽️ Per Produk'], ['bayar', '💳 Pembayaran']].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: 'transparent', color: tab === id ? '#f97316' : '#64748b',
                  borderBottom: tab === id ? '2px solid #f97316' : '2px solid transparent'
                }}>{label}</button>
              ))}
            </div>
            <div style={{ padding: 16, overflowX: 'auto' }}>
              {tab === 'harian' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
                      {['Tanggal', 'Trx', 'Omset', 'HPP', 'Profit', 'Margin'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Tanggal' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.daily.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#475569' }}>Tidak ada data</td></tr>
                    ) : report.daily.map(row => (
                      <tr key={row.date} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '10px 10px', color: '#e2e8f0' }}>
                          {new Date(row.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#94a3b8' }}>{row.count}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#f97316', fontWeight: 600 }}>{formatRupiah(row.omset)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#ef4444' }}>{formatRupiah(row.hpp)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatRupiah(row.profit)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          <span style={{ background: parseFloat(row.margin) >= 30 ? '#065f46' : '#713f12', color: parseFloat(row.margin) >= 30 ? '#6ee7b7' : '#fde68a', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>{row.margin}%</span>
                        </td>
                      </tr>
                    ))}
                    {report.daily.length > 0 && (
                      <tr style={{ borderTop: '2px solid #334155', fontWeight: 700 }}>
                        <td style={{ padding: '10px 10px', color: '#fff' }}>TOTAL</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#94a3b8' }}>{report.count}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#f97316' }}>{formatRupiah(report.totalOmset)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#ef4444' }}>{formatRupiah(report.totalHpp)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#10b981' }}>{formatRupiah(report.totalProfit)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          <span style={{ background: '#065f46', color: '#6ee7b7', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>{report.margin}%</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              {tab === 'produk' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
                      {['#', 'Produk', 'Qty', 'Omset', 'Profit', 'Margin'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Produk' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#475569' }}>Tidak ada data</td></tr>
                    ) : report.items.map((item, i) => (
                      <tr key={item.nama} style={{ borderBottom: '1px solid #0f172a' }}>
                        <td style={{ padding: '10px 10px', color: '#475569' }}>{i+1}</td>
                        <td style={{ padding: '10px 10px', color: '#e2e8f0' }}>{item.nama}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#94a3b8' }}>{item.qty}x</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#f97316', fontWeight: 600 }}>{formatRupiah(item.omset)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#10b981' }}>{formatRupiah(item.profit)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          <span style={{ background: parseFloat(item.margin) >= 30 ? '#065f46' : '#713f12', color: parseFloat(item.margin) >= 30 ? '#6ee7b7' : '#fde68a', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>{item.margin}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === 'bayar' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {Object.entries(report.byPayment).length === 0 ? (
                    <div style={{ color: '#475569', textAlign: 'center', padding: 30 }}>Tidak ada data</div>
                  ) : Object.entries(report.byPayment).sort(([,a],[,b]) => b.total - a.total).map(([method, d]) => (
                    <div key={method} style={{ background: '#0f172a', borderRadius: 12, padding: 14, border: '1px solid #334155' }}>
                      <div style={{ fontSize: 28 }}>{method === 'Cash' ? '💵' : method === 'BCA' ? '🏦' : method === 'Qris' ? '📱' : '💳'}</div>
                      <div style={{ fontWeight: 600, marginTop: 8 }}>{method}</div>
                      <div style={{ color: '#f97316', fontWeight: 700 }}>{formatRupiah(d.total)}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{d.count} transaksi</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
