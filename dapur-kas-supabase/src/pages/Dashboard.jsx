import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatRupiah } from '../data/menuData';

const COLORS = ['#f97316','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899'];

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => { fetchData(); }, [period]);

  const fetchData = async () => {
    setLoading(true);
    const from = new Date();
    from.setDate(from.getDate() - parseInt(period));
    const { data: rows } = await supabase
      .from('transactions')
      .select('*')
      .gte('tanggal', from.toISOString().split('T')[0])
      .order('tanggal');
    setData(rows || []);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const totalOmset = data.reduce((s, t) => s + (t.total || 0), 0);
    const totalProfit = data.reduce((s, t) => s + (t.profit || 0), 0);
    const totalHpp = data.reduce((s, t) => s + (t.hpp || 0), 0);
    const margin = totalOmset > 0 ? (totalProfit / totalOmset * 100).toFixed(1) : 0;

    const byDate = {};
    data.forEach(t => {
      if (!byDate[t.tanggal]) byDate[t.tanggal] = { omset: 0, profit: 0, count: 0 };
      byDate[t.tanggal].omset += t.total || 0;
      byDate[t.tanggal].profit += t.profit || 0;
      byDate[t.tanggal].count += 1;
    });
    const daily = Object.entries(byDate).sort().map(([date, d]) => ({
      date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), ...d
    }));

    const byItem = {};
    data.forEach(t => {
      if (!byItem[t.item]) byItem[t.item] = { total: 0, qty: 0, profit: 0 };
      byItem[t.item].total += t.total || 0;
      byItem[t.item].qty += t.qty || 1;
      byItem[t.item].profit += t.profit || 0;
    });
    const topItems = Object.entries(byItem).sort(([,a],[,b]) => b.total - a.total).slice(0, 6)
      .map(([name, d]) => ({ name: name.length > 22 ? name.slice(0, 22) + '…' : name, ...d }));

    const byCat = {};
    data.forEach(t => {
      const c = t.kategori || 'Lainnya';
      byCat[c] = (byCat[c] || 0) + (t.total || 0);
    });
    const catData = Object.entries(byCat).sort(([,a],[,b]) => b - a).map(([name, value]) => ({ name, value }));

    return { totalOmset, totalProfit, totalHpp, margin, daily, topItems, catData, count: data.length, days: Object.keys(byDate).length };
  }, [data]);

  const today = new Date().toISOString().split('T')[0];
  const todayData = data.filter(t => t.tanggal === today);
  const todayOmset = todayData.reduce((s, t) => s + (t.total || 0), 0);
  const todayProfit = todayData.reduce((s, t) => s + (t.profit || 0), 0);

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>⚙️ Memuat data...</div>;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>📊 Dashboard</h1>
          <div style={{ fontSize: 13, color: '#64748b' }}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['7','7 Hari'],['30','30 Hari'],['90','3 Bln'],['365','1 Thn']].map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: period === v ? '#f97316' : '#1e293b', color: period === v ? '#fff' : '#94a3b8'
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Today */}
      <div style={{ background: '#1e293b', border: '1px solid #f9731640', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#f97316', fontWeight: 700, marginBottom: 10 }}>🌟 Hari Ini</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div><div style={{ fontSize: 20, fontWeight: 700 }}>{formatRupiah(todayOmset)}</div><div style={{ fontSize: 11, color: '#64748b' }}>Omset</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{formatRupiah(todayProfit)}</div><div style={{ fontSize: 11, color: '#64748b' }}>Profit</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{todayData.length}</div><div style={{ fontSize: 11, color: '#64748b' }}>Transaksi</div></div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Omset', val: formatRupiah(stats.totalOmset), sub: `${stats.count} transaksi`, color: '#f97316' },
          { label: 'Total Profit', val: formatRupiah(stats.totalProfit), sub: `Margin ${stats.margin}%`, color: '#10b981' },
          { label: 'Total HPP', val: formatRupiah(stats.totalHpp), sub: 'Harga Pokok', color: '#ef4444' },
          { label: 'Rata-rata/Hari', val: formatRupiah(stats.days > 0 ? stats.totalOmset / stats.days : 0), sub: `${stats.days} hari aktif`, color: '#8b5cf6' },
        ].map(({ label, val, sub, color }) => (
          <div key={label} style={{ background: '#1e293b', border: `1px solid ${color}30`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
        <div style={{ background: '#1e293b', borderRadius: 14, padding: 16, border: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>📈 Omset & Profit Harian</div>
          {stats.daily.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(v, n) => [formatRupiah(v), n === 'omset' ? 'Omset' : 'Profit']} />
                <Bar dataKey="omset" fill="#f97316" radius={[3,3,0,0]} />
                <Bar dataKey="profit" fill="#10b981" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={{ background: '#1e293b', borderRadius: 14, padding: 16, border: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>🍽️ Per Kategori</div>
          {stats.catData.length === 0 ? (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>Belum ada data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={stats.catData} dataKey="value" cx="50%" cy="50%" outerRadius={65} stroke="none">
                    {stats.catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} formatter={v => [formatRupiah(v)]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 8 }}>
                {stats.catData.slice(0, 5).map((item, i) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#94a3b8', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>{formatRupiah(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top items */}
      <div style={{ background: '#1e293b', borderRadius: 14, padding: 16, border: '1px solid #334155' }}>
        <div style={{ fontWeight: 700, marginBottom: 14 }}>🏆 Menu Terlaris</div>
        {stats.topItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#475569' }}>Belum ada data</div>
        ) : stats.topItems.map((item, i) => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i === 0 ? '#ca8a04' : i === 1 ? '#6b7280' : i === 2 ? '#92400e' : '#1e293b',
              color: i < 3 ? '#fff' : '#64748b', fontSize: 12, fontWeight: 700, flexShrink: 0
            }}>{i+1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                <div style={{ height: 4, background: '#334155', borderRadius: 2, flex: 1, maxWidth: 120 }}>
                  <div style={{ height: 4, background: '#f97316', borderRadius: 2, width: `${(item.total / stats.topItems[0].total) * 100}%` }} />
                </div>
                <span style={{ fontSize: 11, color: '#64748b' }}>{item.qty}x</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ color: '#f97316', fontWeight: 700, fontSize: 13 }}>{formatRupiah(item.total)}</div>
              <div style={{ color: '#10b981', fontSize: 11 }}>+{formatRupiah(item.profit)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
