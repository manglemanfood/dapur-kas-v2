-- ============================================================
-- JALANKAN SQL INI DI SUPABASE SQL EDITOR
-- Supabase Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- 1. Buat tabel transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal DATE NOT NULL,
  nama TEXT DEFAULT 'Pelanggan',
  keterangan TEXT DEFAULT '',
  item TEXT NOT NULL,
  kategori TEXT DEFAULT 'LAINNYA',
  harga NUMERIC DEFAULT 0,
  qty INTEGER DEFAULT 1,
  total NUMERIC DEFAULT 0,
  hpp NUMERIC DEFAULT 0,
  profit NUMERIC DEFAULT 0,
  tf TEXT DEFAULT 'Cash',
  status TEXT DEFAULT 'Lunas',
  order_num TEXT DEFAULT '',
  is_historical BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Buat index untuk query cepat per tanggal
CREATE INDEX IF NOT EXISTS idx_transactions_tanggal ON transactions(tanggal);

-- 3. Aktifkan Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 4. Policy: semua user bisa baca dan tulis (untuk aplikasi kasir)
CREATE POLICY "Allow all operations" ON transactions
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Verifikasi
SELECT 'Tabel berhasil dibuat!' as status;
