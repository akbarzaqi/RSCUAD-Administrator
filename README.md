# RSCUAD — Admin Dashboard LPJ KRSBI Humanoid

Dashboard admin untuk mengelola Laporan Pertanggungjawaban (LPJ) Anggaran tim R-SCUAD KRSBI Humanoid. Mulai dari pencatatan pemasukan, pengeluaran, upload bukti nota, hingga export laporan realisasi anggaran.

## Fitur

### Periode Anggaran
- Pilih tahun anggaran saat login
- Buat periode baru (tahun + nama organisasi)
- Menu navigasi terkunci sampai periode dipilih

### Pemasukan
- CRUD data pemasukan (kode, nama akun, satuan, qty, harga satuan)
- Upload bukti nota langsung dari form tambah/edit
- Jumlah otomatis (`qty × harga_satuan`)

### Pengeluaran
- Kelola kategori pengeluaran (Administrasi, Perlengkapan Robot, dll.)
- CRUD item per kategori
- Tabel report-style dengan border per baris dan total per kategori
- Upload bukti nota per item

### Bukti Nota
- Halaman gabungan untuk semua transaksi (pemasukan + pengeluaran)
- Upload bukti nota untuk transaksi yang belum punya bukti
- Preview gambar bukti full-size
- Status tracking: Terupload / Menunggu
- Search by kode atau nama

### Laporan
- Preview laporan utama format Lampiran II KRSBI Humanoid
- Kop surat otomatis dari nama organisasi
- Tabel pemasukan & pengeluaran per kategori
- Lampiran bukti nota grid
- **Export Excel** (3 sheet: Rekap, Pemasukan, Pengeluaran)
- **Kunci laporan** (status Draft → Final)

### Riwayat
- Lihat semua periode anggaran dari tahun ke tahun
- Expand per tahun untuk lihat rincian pemasukan, pengeluaran, saldo, dan kategori

### Upload Gambar
- Kompresi otomatis sebelum upload (`browser-image-compression`, max 1MB, max 1200px)
- Disimpan ke Supabase Storage bucket `lpj`

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) |
| Auth | Supabase Auth (email + password) |
| Export | SheetJS (xlsx) |
| Image | browser-image-compression |
| Language | TypeScript |

## Database Schema

```
users (Supabase Auth)
  └── id, nama, email, role

periode_anggaran
  ├── id (UUID)
  ├── dibuat_oleh → users.id
  ├── tahun
  ├── nama_organisasi
  ├── kop_surat
  ├── status (Draft / Final)
  └── created_at

pemasukan
  ├── id (UUID)
  ├── periode_id → periode_anggaran.id
  ├── kode, nama_akun, satuan, tanggal
  ├── qty, harga_satuan, jumlah
  └── bukti_url

kategori_pengeluaran
  ├── id (UUID)
  ├── periode_id → periode_anggaran.id
  ├── nama_kategori
  └── urutan

pengeluaran
  ├── id (UUID)
  ├── kategori_id → kategori_pengeluaran.id
  ├── kode, nama_item, satuan
  ├── qty, harga_satuan, jumlah
  └── bukti_url
```

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd rscuad-admin
npm install
```

### 2. Buat `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

### 3. Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

### 4. Register & Login

1. Buka `/register` untuk buat akun baru
2. Login di `/login`
3. Pilih atau buat periode anggaran
4. Mulai input data

## Struktur Folder

```
app/
├── actions/auth.ts          # Server actions: login, signup, logout
├── contexts/year-context.ts # Year/periode context (Supabase-backed)
├── dashboard/
│   ├── layout.tsx           # Dashboard layout + auth check
│   ├── sidebar.tsx          # Sidebar navigasi
│   ├── page.tsx             # Pilih periode + ringkasan
│   ├── pemasukan/page.tsx   # CRUD pemasukan
│   ├── pengeluaran/page.tsx # CRUD pengeluaran per kategori
│   ├── bukti-nota/page.tsx  # Upload & kelola bukti nota
│   ├── laporan/page.tsx     # Preview laporan + export Excel + kunci
│   └── riwayat/page.tsx     # Riwayat semua periode
├── lib/supabase/
│   ├── server.ts            # Supabase server client (cookies)
│   ├── client.ts            # Supabase browser client
│   └── database.types.ts    # TypeScript types dari schema DB
├── login/page.tsx           # Login page
├── register/page.tsx        # Register page
└── layout.tsx               # Root layout
```

## Perintah

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Jalankan production build
npm run lint     # ESLint check
```
