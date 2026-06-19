import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { formatRupiah } from '../data/menuData';

const COLORS = ['#f97316','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16','#ef4444','#a78bfa'];

export default function Analysis() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('transactions').select('*').order('tanggal').then(({ data: rows }) => {
      setData(rows || []);
      setLoading(false);
    });
  }, []);

  const analysis = useMemo(() => {
    if (!data.length) return null;

    const totalOmset = data.reduce((s, t) => s + (t.total || 0), 0);
    const totalProfit = data.reduce((s, t) => s + (t.profit || 0), 0);
    const totalHpp = data.reduce((s, t) => s + (t.hpp || 0), 0);
    const totalTrx = data.length;
    const avgPerTrx = totalOmset / totalTrx;

    // Monthly data
    const byMonth = {};
    data.forEach(t => {
      const m = t.tanggal?.slice(0, 7);
      if (!m) return;
      if (!byMonth[m]) byMonth[m] = { omset: 0, profit: 0, hpp: 0, count: 0, label: '' };
      byMonth[m].omset += t.total || 0;
      byMonth[m].profit += t.profit || 0;
      byMonth[m].hpp += t.hpp || 0;
      byMonth[m].count += 1;
    });
    const monthNames = { '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Mei', '06': 'Jun', '07': 'Jul', '08': 'Agu' };
    const monthlyData = Object.entries(byMonth).sort().map(([m, d]) => ({
      bulan: (monthNames[m.slice(5)] || m.slice(5)) + ' ' + m.slice(0, 4),
      omset: d.omset, profit: d.profit, hpp: d.hpp, count: d.count,
      margin: d.omset > 0 ? Math.round(d.profit / d.omset * 100) : 0,
      avgPerTrx: Math.round(d.omset / d.count),
    }));

    // Category data
    const byCat = {};
    data.forEach(t => {
      const c = t.kategori || 'LAINNYA';
      if (!byCat[c]) byCat[c] = { omset: 0, count: 0, qty: 0 };
      byCat[c].omset += t.total || 0;
      byCat[c].count += 1;
      byCat[c].qty += t.qty || 1;
    });
    const catData = Object.entries(byCat).sort(([,a],[,b]) => b.omset - a.omset)
      .map(([name, d]) => ({ name, ...d, pct: Math.round(d.omset / totalOmset * 100) }));

    // Top products
    const byItem = {};
    data.forEach(t => {
      if (!byItem[t.item]) byItem[t.item] = { omset: 0, qty: 0, count: 0, kategori: t.kategori };
      byItem[t.item].omset += t.total || 0;
      byItem[t.item].qty += t.qty || 1;
      byItem[t.item].count += 1;
    });
    const topProducts = Object.entries(byItem).sort(([,a],[,b]) => b.omset - a.omset).slice(0, 10)
      .map(([name, d]) => ({ name: name.length > 25 ? name.slice(0,25)+'…' : name, fullName: name, ...d }));

    // Top customers
    const byCust = {};
    data.forEach(t => {
      const n = t.nama;
      if (!n || n === 'Pelanggan' || n === 'nan') return;
      if (!byCust[n]) byCust[n] = { omset: 0, count: 0, items: new Set() };
      byCust[n].omset += t.total || 0;
      byCust[n].count += 1;
      byCust[n].items.add(t.item);
    });
    const topCustomers = Object.entries(byCust).sort(([,a],[,b]) => b.omset - a.omset).slice(0, 10)
      .map(([name, d]) => ({ name, omset: d.omset, count: d.count, items: d.items.size }));

    // Payment methods
    const byPay = {};
    data.forEach(t => {
      const p = (t.tf || 'Cash').replace('TUNAI', 'Tunai').replace('GOPAY', 'GoPay').replace('QRIS', 'QRIS');
      byPay[p] = (byPay[p] || 0) + (t.total || 0);
    });
    const payData = Object.entries(byPay).sort(([,a],[,b]) => b - a)
      .map(([name, value]) => ({ name, value, pct: Math.round(value / totalOmset * 100) }));

    // Growth calculation
    const months = Object.keys(byMonth).sort();
    const growthData = months.map((m, i) => ({
      bulan: (monthNames[m.slice(5)] || m.slice(5)),
      omset: byMonth[m].omset,
      growth: i > 0 ? Math.round((byMonth[m].omset - byMonth[months[i-1]].omset) / byMonth[months[i-1]].omset * 100) : 0
    }));

    // Unique customers
    const uniqueCustomers = Object.keys(byCust).length;
    const repeatCustomers = Object.values(byCust).filter(c => c.count > 1).length;
    const repeatRate = Math.round(repeatCustomers / uniqueCustomers * 100);

    // Best month
    const bestMonth = monthlyData.reduce((best, m) => m.omset > best.omset ? m : best, monthlyData[0]);
    const worstMonth = monthlyData.reduce((worst, m) => m.omset < worst.omset ? m : worst, monthlyData[0]);

    return {
      totalOmset, totalProfit, totalHpp, totalTrx, avgPerTrx,
      monthlyData, catData, topProducts, topCustomers, payData, growthData,
      uniqueCustomers, repeatCustomers, repeatRate, bestMonth, worstMonth,
      margin: totalOmset > 0 ? Math.round(totalProfit / totalOmset * 100) : 0,
    };
  }, [data]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: '#64748b', fontSize: 18 }}>⚙️ Menganalisa data...</div>;
  if (!analysis) return <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>Tidak ada data</div>;

  const { totalOmset, totalProfit, totalTrx, avgPerTrx, monthlyData, catData,
    topProducts, topCustomers, payData, growthData, uniqueCustomers, repeatRate,
    bestMonth, worstMonth, margin } = analysis;

  const Section = ({ title, children }) => (
    <div style={{ background: '#1e293b', borderRadius: 16, border: '1px solid #334155', marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #334155', fontWeight: 700, fontSize: 16 }}>{title}</div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );

  const Insight = ({ icon, text, color = '#f97316' }) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>{text}</span>
    </div>
  );

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>🧠 Analisa Bisnis</h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>Laporan komprehensif Kedai MangLeman · {totalTrx} transaksi · {monthlyData.length} bulan data</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Omset', val: formatRupiah(totalOmset), sub: `${totalTrx} transaksi`, color: '#f97316', icon: '💰' },
          { label: 'Total Profit', val: formatRupiah(totalProfit), sub: `Margin ${margin}%`, color: '#10b981', icon: '📈' },
          { label: 'Rata-rata/Transaksi', val: formatRupiah(avgPerTrx), sub: 'Average Order Value', color: '#3b82f6', icon: '🧾' },
          { label: 'Pelanggan Unik', val: uniqueCustomers, sub: `${repeatRate}% pelanggan repeat`, color: '#8b5cf6', icon: '👥' },
        ].map(({ label, val, sub, color, icon }) => (
          <div key={label} style={{ background: '#1e293b', border: `1px solid ${color}30`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>
              </div>
              <div style={{ fontSize: 28 }}>{icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Trend */}
      <Section title="📅 Tren Omset & Profit per Bulan">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="bulan" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${(v/1000000).toFixed(1)}jt`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v, n) => [formatRupiah(v), n === 'omset' ? 'Omset' : n === 'profit' ? 'Profit' : 'HPP']} />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <Bar dataKey="omset" fill="#f97316" radius={[4,4,0,0]} name="omset" />
            <Bar dataKey="profit" fill="#10b981" radius={[4,4,0,0]} name="profit" />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
          <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Bulan Terbaik</div>
            <div style={{ color: '#10b981', fontWeight: 700, fontSize: 14, marginTop: 4 }}>{bestMonth?.bulan}</div>
            <div style={{ color: '#10b981', fontSize: 12 }}>{formatRupiah(bestMonth?.omset)}</div>
          </div>
          <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Rata-rata/Bulan</div>
            <div style={{ color: '#f97316', fontWeight: 700, fontSize: 14, marginTop: 4 }}>{formatRupiah(totalOmset / monthlyData.length)}</div>
          </div>
          <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Bulan Terendah</div>
            <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 14, marginTop: 4 }}>{worstMonth?.bulan}</div>
            <div style={{ color: '#ef4444', fontSize: 12 }}>{formatRupiah(worstMonth?.omset)}</div>
          </div>
        </div>
      </Section>

      {/* Growth Rate */}
      <Section title="📊 Pertumbuhan Omset Bulanan (%)">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={growthData.slice(1)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="bulan" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v) => [`${v}%`, 'Growth']} />
            <Bar dataKey="growth" radius={[4,4,0,0]}
              fill="#3b82f6"
              label={{ position: 'top', fill: '#94a3b8', fontSize: 11, formatter: v => `${v}%` }}>
              {growthData.slice(1).map((entry, i) => (
                <Cell key={i} fill={entry.growth >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {/* Category Analysis */}
      <Section title="🍽️ Komposisi Penjualan per Kategori">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={catData} dataKey="omset" cx="50%" cy="50%" outerRadius={85}
                label={({ name, pct }) => pct > 5 ? `${pct}%` : ''} labelLine={false} stroke="none">
                {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v) => [formatRupiah(v)]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
            {catData.map((item, i) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{item.name}</div>
                  <div style={{ height: 4, background: '#334155', borderRadius: 2, marginTop: 3 }}>
                    <div style={{ height: 4, background: COLORS[i % COLORS.length], borderRadius: 2, width: `${item.pct}%` }} />
                  </div>
                </div>
                <span style={{ fontSize: 12, color: '#f97316', fontWeight: 700, flexShrink: 0 }}>{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Top Products */}
      <Section title="🏆 Top 10 Produk Terlaris">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {topProducts.map((p, i) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0, fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i === 0 ? '#ca8a04' : i === 1 ? '#6b7280' : i === 2 ? '#92400e' : '#1e293b',
                color: i < 3 ? '#fff' : '#64748b'
              }}>{i+1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ height: 5, background: '#334155', borderRadius: 3 }}>
                  <div style={{ height: 5, background: COLORS[i % COLORS.length], borderRadius: 3, width: `${(p.omset / topProducts[0].omset) * 100}%` }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: '#f97316', fontWeight: 700, fontSize: 13 }}>{formatRupiah(p.omset)}</div>
                <div style={{ color: '#64748b', fontSize: 11 }}>{p.qty}x terjual</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Top Customers */}
      <Section title="👥 Top 10 Pelanggan (CRM)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
                {['#', 'Nama', 'Total Belanja', 'Transaksi', 'Variasi Item', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Nama' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((c, i) => (
                <tr key={c.name} style={{ borderBottom: '1px solid #0f172a' }}>
                  <td style={{ padding: '10px 10px', color: '#475569' }}>{i+1}</td>
                  <td style={{ padding: '10px 10px', color: '#e2e8f0', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#f97316', fontWeight: 700 }}>{formatRupiah(c.omset)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#94a3b8' }}>{c.count}x</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#94a3b8' }}>{c.items} menu</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: c.count >= 10 ? '#065f46' : c.count >= 5 ? '#1d4ed8' : '#374151',
                      color: c.count >= 10 ? '#6ee7b7' : c.count >= 5 ? '#bfdbfe' : '#94a3b8'
                    }}>
                      {c.count >= 10 ? '⭐ VIP' : c.count >= 5 ? '🔥 Loyal' : '🆕 Baru'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Payment Methods */}
      <Section title="💳 Metode Pembayaran">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={payData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} stroke="none">
                {payData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v) => [formatRupiah(v)]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
            {payData.map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                  <span style={{ fontSize: 13, color: '#e2e8f0' }}>{p.name}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#f97316', fontWeight: 700, fontSize: 13 }}>{p.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Business Insights */}
      <Section title="💡 Insight & Rekomendasi Bisnis">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Strengths */}
          <div style={{ background: '#022c22', border: '1px solid #065f46', borderRadius: 12, padding: 16 }}>
            <div style={{ color: '#10b981', fontWeight: 700, marginBottom: 12, fontSize: 14 }}>✅ Kekuatan (Strengths)</div>
            <Insight icon="🥇" text="Ricebowl adalah produk andalan — 56.5% omset berasal dari kategori ini. Terus inovasi varian baru." />
            <Insight icon="👥" text={`${uniqueCustomers} pelanggan unik tercatat dengan ${repeatRate}% rate repeat order — basis loyal yang kuat.`} />
            <Insight icon="🌟" text="Luciana Retno adalah pelanggan terbaik dengan 14 transaksi — bukti loyalitas tinggi." />
            <Insight icon="💰" text="BRI mendominasi 90.1% pembayaran — cocok untuk target promosi cashback BRI." />
          </div>
          {/* Opportunities */}
          <div style={{ background: '#0c1a3a', border: '1px solid #1d4ed8', borderRadius: 12, padding: 16 }}>
            <div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: 12, fontSize: 14 }}>🚀 Peluang (Opportunities)</div>
            <Insight icon="🥤" text="JUICE 14.1% omset — ada potensi besar. Buat paket bundling Ricebowl + Jus dengan diskon 10%." />
            <Insight icon="🥟" text="DIMSUM hanya 4.6% — promosikan sebagai add-on saat checkout atau buat promo happy hour." />
            <Insight icon="📱" text="QRIS & GoPay masih sangat kecil (0.6%) — aktifkan promosi cashback digital untuk target anak muda." />
            <Insight icon="🎂" text="Cheesecake Choco & Matcha populer — pertimbangkan paket dessert bundle untuk meningkatkan AOV." />
          </div>
          {/* Warnings */}
          <div style={{ background: '#2d1515', border: '1px solid #7f1d1d', borderRadius: 12, padding: 16 }}>
            <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: 12, fontSize: 14 }}>⚠️ Perhatian (Warnings)</div>
            <Insight icon="📉" text="Tren menurun sejak Maret 2026 (-28% Apr, -14% Mei, -23% Jun). Perlu evaluasi strategi penjualan segera." />
            <Insight icon="🐟" text="LELE hanya 3% omset padahal ini produk awal bisnis — pertimbangkan revitalisasi menu lele atau remove." />
            <Insight icon="🔄" text="Transaksi per bulan belum stabil. Perlu program loyalitas untuk menstabilkan revenue." />
            <Insight icon="💸" text="Rata-rata transaksi Rp 33k — cukup rendah. Dorong upselling dan cross-selling ke pelanggan." />
          </div>
          {/* Action Plan */}
          <div style={{ background: '#1a0a2e', border: '1px solid #7c3aed', borderRadius: 12, padding: 16 }}>
            <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 12, fontSize: 14 }}>📋 Action Plan CRM</div>
            <Insight icon="1️⃣" text="Buat program VIP untuk pelanggan dengan 5+ transaksi — berikan diskon khusus atau gratis minuman." />
            <Insight icon="2️⃣" text="Hubungi pelanggan top (Luciana, Eka, Adinda, Rori) untuk feedback dan penawaran spesial." />
            <Insight icon="3️⃣" text="Buat paket bundling: Ricebowl + Jus + Dimsum = harga spesial untuk tingkatkan AOV." />
            <Insight icon="4️⃣" text="Aktifkan promo hari tertentu (misal: Rabu = diskon 10% semua Ricebowl) untuk stabilkan traffic." />
            <Insight icon="5️⃣" text="Target omset: Rp 4.5 juta/bulan dengan minimum 150 transaksi per bulan." />
          </div>
        </div>
      </Section>

      {/* Monthly Detail Table */}
      <Section title="📊 Ringkasan Performa per Bulan">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
                {['Bulan', 'Trx', 'Omset', 'HPP', 'Profit', 'Margin', 'Avg/Trx'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Bulan' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((m, i) => (
                <tr key={m.bulan} style={{ borderBottom: '1px solid #0f172a' }}>
                  <td style={{ padding: '10px 10px', color: '#e2e8f0', fontWeight: 600 }}>{m.bulan}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#94a3b8' }}>{m.count}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#f97316', fontWeight: 700 }}>{formatRupiah(m.omset)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#ef4444' }}>{formatRupiah(m.hpp)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>{formatRupiah(m.profit)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                    <span style={{ background: m.margin >= 30 ? '#065f46' : '#713f12', color: m.margin >= 30 ? '#6ee7b7' : '#fde68a', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>
                      {m.margin}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#94a3b8' }}>{formatRupiah(m.avgPerTrx)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Footer note */}
      <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, border: '1px solid #334155', fontSize: 12, color: '#64748b', textAlign: 'center' }}>
        📌 Laporan ini dibuat otomatis berdasarkan {totalTrx} transaksi dari {monthlyData.length} bulan data Kedai MangLeman.
        Data diperbarui setiap kali halaman dibuka.
      </div>
    </div>
  );
}
