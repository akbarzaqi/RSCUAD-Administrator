'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useYear } from '@/app/contexts/year-context'
import { createClient } from '@/app/lib/supabase/client'
import type { Database } from '@/app/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import * as XLSX from 'xlsx'
import {
  Download,
  FileText,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Receipt,
  ShieldCheck,
  Calendar,
  Eye,
  Table,
  Printer,
  X,
  Image as ImageIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

type KategoriRow = Database['public']['Tables']['kategori_pengeluaran']['Row']
type PengeluaranRow = Database['public']['Tables']['pengeluaran']['Row']
type PemasukanRow = Database['public']['Tables']['pemasukan']['Row']

type KategoriWithItems = KategoriRow & { items: PengeluaranRow[] }
type BuktiStatusItem = { key: string; kode: string; terupload: boolean; bukti_url: string | null; namaItem: string }
type SortKey = 'kode' | 'nama' | 'satuan' | 'qty' | 'harga' | 'jumlah'

function rp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function rpShort(n: number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

export default function LaporanPage() {
  const { selectedYear, selectedPeriode, periodeId } = useYear()
  const supabase = createClient()

  const [pemasukanData, setPemasukanData] = useState<PemasukanRow[]>([])
  const [kategori, setKategori] = useState<KategoriWithItems[]>([])
  const [buktiStatus, setBuktiStatus] = useState<BuktiStatusItem[]>([])
  const [pemSort, setPemSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'kode', asc: true })
  const [pengSort, setPengSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'kode', asc: true })
  const [loading, setLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [previewBukti, setPreviewBukti] = useState<{ kode: string; namaItem: string; bukti_url: string | null } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    if (!periodeId) return
    setLoading(true)

    const [pemRes, kategoriRes] = await Promise.all([
      supabase.from('pemasukan').select('*').eq('periode_id', periodeId),
      supabase.from('kategori_pengeluaran').select('*').eq('periode_id', periodeId).order('urutan'),
    ])

    const pemData = (pemRes.data || []).sort((a, b) =>
      (a.kode || '').localeCompare(b.kode || '', undefined, { numeric: true, sensitivity: 'base' })
    )
    setPemasukanData(pemData)

    const kategoriList: KategoriWithItems[] = []

    for (const k of kategoriRes.data || []) {
      const { data: items } = await supabase.from('pengeluaran').select('*').eq('kategori_id', k.id)
      const sortedItems = (items || []).sort((a, b) =>
        (a.kode || '').localeCompare(b.kode || '', undefined, { numeric: true, sensitivity: 'base' })
      )
      kategoriList.push({ ...k, items: sortedItems })
    }

    setKategori(kategoriList)

    // Kelompokkan bukti nota per kode nota (satu nota bisa memiliki beberapa item dengan kode yang sama)
    const rawBukti = [
      ...pemData.map((r) => ({ id: r.id, kode: r.kode || '-', terupload: !!r.bukti_url, bukti_url: r.bukti_url, namaItem: r.nama_akun })),
      ...kategoriList.flatMap((k) =>
        k.items.map((r) => ({ id: r.id, kode: r.kode || '-', terupload: !!r.bukti_url, bukti_url: r.bukti_url, namaItem: r.nama_item }))
      ),
    ]

    const notaMap = new Map<string, BuktiStatusItem>()
    for (const item of rawBukti) {
      const key = item.kode && item.kode !== '-' ? item.kode : item.id
      if (notaMap.has(key)) {
        const existing = notaMap.get(key)!
        existing.namaItem += `, ${item.namaItem}`
        if (!existing.terupload && item.terupload) {
          existing.terupload = true
          existing.bukti_url = item.bukti_url
        }
      } else {
        notaMap.set(key, {
          key,
          kode: item.kode,
          terupload: item.terupload,
          bukti_url: item.bukti_url,
          namaItem: item.namaItem,
        })
      }
    }

    const buktiItems = Array.from(notaMap.values()).sort((a, b) =>
      a.kode.localeCompare(b.kode, undefined, { numeric: true, sensitivity: 'base' })
    )
    setBuktiStatus(buktiItems)

    if (selectedPeriode) {
      setIsLocked(selectedPeriode.status === 'Final')
    }

    setLoading(false)
  }, [periodeId, supabase, selectedPeriode])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPemasukan = pemasukanData.reduce((s, r) => s + Number(r.jumlah), 0)
  const totalPengeluaran = kategori.reduce(
    (s, k) => s + k.items.reduce((ss, r) => ss + Number(r.jumlah), 0),
    0,
  )
  const saldoAkhir = totalPemasukan - totalPengeluaran

  const buktiTerupload = buktiStatus.filter((b) => b.terupload).length
  const buktiTotal = buktiStatus.length
  const buktiMissing = buktiTotal - buktiTerupload

  const togglePemSort = (key: SortKey) => {
    setPemSort((prev) => ({ key, asc: prev.key === key ? !prev.asc : true }))
  }

  const togglePengSort = (key: SortKey) => {
    setPengSort((prev) => ({ key, asc: prev.key === key ? !prev.asc : true }))
  }

  const getSortedPemasukan = () => {
    return [...pemasukanData].sort((a, b) => {
      let cmp = 0
      switch (pemSort.key) {
        case 'kode':
          cmp = (a.kode || '').localeCompare(b.kode || '', undefined, { numeric: true, sensitivity: 'base' })
          break
        case 'nama':
          cmp = a.nama_akun.localeCompare(b.nama_akun)
          break
        case 'satuan':
          cmp = (a.satuan || '').localeCompare(b.satuan || '')
          break
        case 'qty':
          cmp = Number(a.qty) - Number(b.qty)
          break
        case 'harga':
          cmp = Number(a.harga_satuan) - Number(b.harga_satuan)
          break
        case 'jumlah':
          cmp = Number(a.jumlah) - Number(b.jumlah)
          break
      }
      return pemSort.asc ? cmp : -cmp
    })
  }

  const getSortedPengeluaran = (items: PengeluaranRow[]) => {
    return [...items].sort((a, b) => {
      let cmp = 0
      switch (pengSort.key) {
        case 'kode':
          cmp = (a.kode || '').localeCompare(b.kode || '', undefined, { numeric: true, sensitivity: 'base' })
          break
        case 'nama':
          cmp = a.nama_item.localeCompare(b.nama_item)
          break
        case 'satuan':
          cmp = (a.satuan || '').localeCompare(b.satuan || '')
          break
        case 'qty':
          cmp = Number(a.qty) - Number(b.qty)
          break
        case 'harga':
          cmp = Number(a.harga_satuan) - Number(b.harga_satuan)
          break
        case 'jumlah':
          cmp = Number(a.jumlah) - Number(b.jumlah)
          break
      }
      return pengSort.asc ? cmp : -cmp
    })
  }

  const handleLock = async () => {
    if (!periodeId) return
    if (showLockConfirm) {
      await supabase.from('periode_anggaran').update({ status: 'Final' }).eq('id', periodeId)
      setIsLocked(true)
      setShowLockConfirm(false)
    } else {
      setShowLockConfirm(true)
    }
  }

  const handleUnlock = async () => {
    if (!periodeId) return
    await supabase.from('periode_anggaran').update({ status: 'Draft' }).eq('id', periodeId)
    setIsLocked(false)
  }

  function exportToExcel() {
    const wb = XLSX.utils.book_new()
    const orgName = selectedPeriode?.nama_organisasi || 'R-SCUAD'
    const header = [
      ['Lampiran II'],
      ['REALISASI ANGGARAN DANA'],
      [orgName.toUpperCase()],
      ['KRSBI HUMANOID'],
      [`TAHUN ${selectedYear}`],
      [''],
    ]

    const colWidths = [
      { wch: 5 },
      { wch: 32 },
      { wch: 10 },
      { wch: 8 },
      { wch: 18 },
      { wch: 18 },
      { wch: 8 },
    ]

    const sortedPem = getSortedPemasukan()

    // Sheet 1: Laporan Realisasi Lengkap (Pemasukan + Semua Kategori Pengeluaran + Rekapitulasi)
    const laporanLengkap: (string | number)[][] = [
      ...header,
      ['A. PEMASUKAN'],
      [''],
      ['NO', 'AKUN', 'SATUAN', 'UNIT', 'HARGA', 'JUMLAH', 'KODE'],
      ...sortedPem.map((r, i) => [
        i + 1,
        r.nama_akun,
        r.satuan || '',
        Number(r.qty),
        Number(r.harga_satuan),
        Number(r.jumlah),
        r.kode || '',
      ]),
      ['', '', '', '', 'Total Pemasukan', totalPemasukan, ''],
      [''],
      ['B. PENGELUARAN'],
      [''],
    ]

    if (kategori.length === 0) {
      laporanLengkap.push(['', '(Belum ada kategori pengeluaran)', '', '', '', 0, ''], [''])
    } else {
      for (const kat of kategori) {
        const sortedKatItems = getSortedPengeluaran(kat.items)
        const totalKat = kat.items.reduce((s, r) => s + Number(r.jumlah), 0)
        laporanLengkap.push(
          ['', kat.nama_kategori.toUpperCase()],
          ['NO', 'AKUN', 'SATUAN', 'UNIT', 'HARGA', 'JUMLAH', 'KODE'],
        )
        if (sortedKatItems.length === 0) {
          laporanLengkap.push(['', '(Belum ada transaksi)', '', '', '', 0, ''])
        } else {
          laporanLengkap.push(
            ...sortedKatItems.map((r, i) => [
              i + 1,
              r.nama_item,
              r.satuan || '',
              Number(r.qty),
              Number(r.harga_satuan),
              Number(r.jumlah),
              r.kode || '',
            ])
          )
        }
        laporanLengkap.push(
          ['', '', '', '', `Total ${kat.nama_kategori}`, totalKat, ''],
          [''],
        )
      }
    }

    laporanLengkap.push(
      ['', '', '', '', 'TOTAL PENGELUARAN', totalPengeluaran, ''],
      [''],
      ['', 'REKAPITULASI', '', '', '', '', ''],
      ['', 'Total Pemasukan', '', '', '', totalPemasukan, ''],
      ['', 'Total Pengeluaran', '', '', '', totalPengeluaran, ''],
      ['', 'Saldo Akhir', '', '', '', saldoAkhir, ''],
    )

    const sLengkap = XLSX.utils.aoa_to_sheet(laporanLengkap)
    sLengkap['!cols'] = colWidths
    XLSX.utils.book_append_sheet(wb, sLengkap, 'Laporan Realisasi')

    // Sheet 2: Rincian Pemasukan
    const pemasukanExcel = [
      ...header,
      ['A. PEMASUKAN'],
      [''],
      ['NO', 'AKUN', 'SATUAN', 'UNIT', 'HARGA', 'JUMLAH', 'KODE'],
      ...sortedPem.map((r, i) => [
        i + 1,
        r.nama_akun,
        r.satuan || '',
        Number(r.qty),
        Number(r.harga_satuan),
        Number(r.jumlah),
        r.kode || '',
      ]),
      ['', '', '', '', 'Total Pemasukan', totalPemasukan, ''],
    ]
    const ps = XLSX.utils.aoa_to_sheet(pemasukanExcel)
    ps['!cols'] = colWidths
    XLSX.utils.book_append_sheet(wb, ps, 'Pemasukan')

    // Sheet 3: Rincian Pengeluaran
    let pengRow = 0
    const pengeluaranExcel: (string | number)[][] = [...header, ['B. PENGELUARAN'], ['']]

    for (const kat of kategori) {
      const sortedKatItems = getSortedPengeluaran(kat.items)
      const totalKat = kat.items.reduce((s, r) => s + Number(r.jumlah), 0)
      pengeluaranExcel.push(
        ['', kat.nama_kategori.toUpperCase()],
        ['NO', 'AKUN', 'SATUAN', 'UNIT', 'HARGA', 'JUMLAH', 'KODE'],
        ...sortedKatItems.map((r) => [
          ++pengRow,
          r.nama_item,
          r.satuan || '',
          Number(r.qty),
          Number(r.harga_satuan),
          Number(r.jumlah),
          r.kode || '',
        ]),
        ['', '', '', '', `Total ${kat.nama_kategori}`, totalKat, ''],
        [''],
      )
    }

    pengeluaranExcel.push(['', '', '', '', 'TOTAL PENGELUARAN', totalPengeluaran, ''])

    const pe = XLSX.utils.aoa_to_sheet(pengeluaranExcel)
    pe['!cols'] = colWidths
    XLSX.utils.book_append_sheet(wb, pe, 'Pengeluaran')

    XLSX.writeFile(wb, `Laporan_Realisasi_Anggaran_KRSBI_${selectedYear}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-sm text-zinc-400">Memuat data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">Laporan</h1>
            {isLocked ? (
              <Badge variant="secondary" className="gap-1 bg-teal-50 text-teal-700">
                <Lock className="size-3" />
                Final
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 bg-amber-50 text-amber-700">Draft</Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">Export dan kunci laporan realisasi anggaran</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Calendar className="size-3.5" />
          Tahun {selectedYear}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Total Pemasukan</CardTitle>
            <Wallet className="size-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-emerald-600">{rp(totalPemasukan)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Total Pengeluaran</CardTitle>
            <Receipt className="size-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-orange-600">{rp(totalPengeluaran)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Saldo Akhir</CardTitle>
            <ShieldCheck className="size-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tracking-tight text-teal-600">{rp(saldoAkhir)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Preview Laporan Utama */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4" />
            Preview Laporan Utama
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4 border-b border-zinc-200 pb-4">
              <div className="flex size-14 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                <span className="text-lg font-bold text-zinc-400">LOGO</span>
              </div>
              <div className="flex-1 text-center">
                <p className="text-sm font-bold uppercase tracking-wide text-zinc-800">
                  {selectedPeriode?.nama_organisasi || 'R-SCUAD'}
                </p>
              </div>
            </div>

            <div className="py-4 text-center">
              <p className="text-xs text-zinc-500">Lampiran II</p>
              <p className="text-base font-bold uppercase tracking-wide text-zinc-800">Realisasi Anggaran Dana</p>
              <p className="text-base font-bold uppercase tracking-wide text-zinc-800">KRSBI Humanoid</p>
              <p className="text-base font-bold uppercase tracking-wide text-zinc-800">Tahun {selectedYear}</p>
            </div>

            {/* Table A — Pemasukan */}
            <div className="space-y-2">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-8">NO</th>
                    <th
                      className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-left font-bold text-zinc-700 cursor-pointer select-none hover:bg-zinc-300"
                      onClick={() => togglePemSort('nama')}
                    >
                      <div className="flex items-center gap-1">
                        <span>AKUN</span>
                        {pemSort.key === 'nama' ? (
                          pemSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                        ) : (
                          <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-16 cursor-pointer select-none hover:bg-zinc-300"
                      onClick={() => togglePemSort('satuan')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>SATUAN</span>
                        {pemSort.key === 'satuan' ? (
                          pemSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                        ) : (
                          <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-12 cursor-pointer select-none hover:bg-zinc-300"
                      onClick={() => togglePemSort('qty')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>UNIT</span>
                        {pemSort.key === 'qty' ? (
                          pemSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                        ) : (
                          <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-right font-bold text-zinc-700 w-28 cursor-pointer select-none hover:bg-zinc-300"
                      onClick={() => togglePemSort('harga')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>HARGA</span>
                        {pemSort.key === 'harga' ? (
                          pemSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                        ) : (
                          <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-right font-bold text-zinc-700 w-28 cursor-pointer select-none hover:bg-zinc-300"
                      onClick={() => togglePemSort('jumlah')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>JUMLAH</span>
                        {pemSort.key === 'jumlah' ? (
                          pemSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                        ) : (
                          <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-12 cursor-pointer select-none hover:bg-zinc-300"
                      onClick={() => togglePemSort('kode')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>KODE</span>
                        {pemSort.key === 'kode' ? (
                          pemSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                        ) : (
                          <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedPemasukan().map((r, i) => (
                    <tr key={r.id}>
                      <td className="border border-zinc-400 px-3 py-1.5 text-center tabular-nums text-zinc-700">{i + 1}</td>
                      <td className="border border-zinc-400 px-3 py-1.5 text-zinc-700">{r.nama_akun}</td>
                      <td className="border border-zinc-400 px-3 py-1.5 text-center text-zinc-700">{r.satuan}</td>
                      <td className="border border-zinc-400 px-3 py-1.5 text-center tabular-nums text-zinc-700">{Number(r.qty)}</td>
                      <td className="border border-zinc-400 px-3 py-1.5 text-right tabular-nums text-zinc-700">{rpShort(Number(r.harga_satuan))}</td>
                      <td className="border border-zinc-400 px-3 py-1.5 text-right tabular-nums text-zinc-700">{rpShort(Number(r.jumlah))}</td>
                      <td className="border border-zinc-400 px-3 py-1.5 text-center font-mono text-zinc-700">{r.kode}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/60 font-bold">
                    <td colSpan={5} className="border border-zinc-400 px-3 py-2 text-right text-emerald-800">Total Pemasukan</td>
                    <td className="border border-zinc-400 px-3 py-2 text-right tabular-nums text-emerald-700">{rp(totalPemasukan)}</td>
                    <td className="border border-zinc-400 px-3 py-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Table B — Pengeluaran */}
            <div className="mt-5 space-y-4">
              <p className="text-sm font-bold uppercase tracking-wider text-zinc-800">B. Pengeluaran</p>

              {kategori.map((kat) => {
                const sortedKatItems = getSortedPengeluaran(kat.items)
                const totalKat = kat.items.reduce((s, r) => s + Number(r.jumlah), 0)
                return (
                  <div key={kat.id} className="space-y-2">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          <th colSpan={7} className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-left font-bold uppercase tracking-wider text-zinc-700">
                            {kat.nama_kategori}
                          </th>
                        </tr>
                        <tr>
                          <th className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-8">NO</th>
                          <th
                            className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-left font-bold text-zinc-700 cursor-pointer select-none hover:bg-zinc-300"
                            onClick={() => togglePengSort('nama')}
                          >
                            <div className="flex items-center gap-1">
                              <span>AKUN</span>
                              {pengSort.key === 'nama' ? (
                                pengSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                              ) : (
                                <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-16 cursor-pointer select-none hover:bg-zinc-300"
                            onClick={() => togglePengSort('satuan')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>SATUAN</span>
                              {pengSort.key === 'satuan' ? (
                                pengSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                              ) : (
                                <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-12 cursor-pointer select-none hover:bg-zinc-300"
                            onClick={() => togglePengSort('qty')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>UNIT</span>
                              {pengSort.key === 'qty' ? (
                                pengSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                              ) : (
                                <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-right font-bold text-zinc-700 w-28 cursor-pointer select-none hover:bg-zinc-300"
                            onClick={() => togglePengSort('harga')}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>HARGA</span>
                              {pengSort.key === 'harga' ? (
                                pengSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                              ) : (
                                <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-right font-bold text-zinc-700 w-28 cursor-pointer select-none hover:bg-zinc-300"
                            onClick={() => togglePengSort('jumlah')}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>JUMLAH</span>
                              {pengSort.key === 'jumlah' ? (
                                pengSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                              ) : (
                                <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-12 cursor-pointer select-none hover:bg-zinc-300"
                            onClick={() => togglePengSort('kode')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>KODE</span>
                              {pengSort.key === 'kode' ? (
                                pengSort.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                              ) : (
                                <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedKatItems.map((r, i) => (
                          <tr key={r.id}>
                            <td className="border border-zinc-400 px-3 py-1.5 text-center tabular-nums text-zinc-700">{i + 1}</td>
                            <td className="border border-zinc-400 px-3 py-1.5 text-zinc-700">{r.nama_item}</td>
                            <td className="border border-zinc-400 px-3 py-1.5 text-center text-zinc-700">{r.satuan}</td>
                            <td className="border border-zinc-400 px-3 py-1.5 text-center tabular-nums text-zinc-700">{Number(r.qty)}</td>
                            <td className="border border-zinc-400 px-3 py-1.5 text-right tabular-nums text-zinc-700">{rpShort(Number(r.harga_satuan))}</td>
                            <td className="border border-zinc-400 px-3 py-1.5 text-right tabular-nums text-zinc-700">{rpShort(Number(r.jumlah))}</td>
                            <td className="border border-zinc-400 px-3 py-1.5 text-center font-mono text-zinc-700">{r.kode}</td>
                          </tr>
                        ))}
                        <tr className="bg-orange-50/60 font-bold">
                          <td colSpan={5} className="border border-zinc-400 px-3 py-2 text-right text-orange-800">Total {kat.nama_kategori}</td>
                          <td className="border border-zinc-400 px-3 py-2 text-right tabular-nums text-orange-700">{rp(totalKat)}</td>
                          <td className="border border-zinc-400 px-3 py-2"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )
              })}

              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="border-2 border-zinc-500 bg-zinc-100/80 px-4 py-2.5 text-sm font-bold text-zinc-800">TOTAL PENGELUARAN</td>
                    <td className="border-2 border-zinc-500 bg-zinc-100/80 px-4 py-2.5 text-right text-base font-bold tabular-nums text-orange-700 w-48">{rp(totalPengeluaran)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportToExcel}>
              <Table className="size-3.5" />
              Export Rekap (Excel)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lampiran Bukti Nota */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Receipt className="size-4" />
            Lampiran Bukti Nota
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div ref={printRef} className="grid grid-cols-6 gap-3 sm:grid-cols-8">
            {buktiStatus.map((item) => (
              <div key={item.key} className="flex flex-col items-center gap-1">
                {item.bukti_url ? (
                  <button
                    onClick={() => setPreviewBukti(item)}
                    className="group relative aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-md border border-zinc-200 bg-zinc-50"
                  >
                    <img
                      src={item.bukti_url}
                      alt={item.namaItem}
                      className="size-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent) {
                          const fallback = document.createElement('div')
                          fallback.className = 'size-full bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center'
                          fallback.innerHTML = '<svg class="size-6 text-emerald-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                          parent.appendChild(fallback)
                        }
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                      <Eye className="size-3 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                ) : (
                  <div className="aspect-[3/4] w-full rounded-md border-2 border-dashed border-zinc-200 bg-zinc-50/50" />
                )}
                <span className={`text-[9px] font-mono ${item.terupload ? 'text-zinc-600' : 'text-zinc-400'}`}>{item.kode}</span>
              </div>
            ))}
          </div>

          {buktiMissing === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              <span>
                <span className="font-semibold">{buktiTerupload}</span> dari{' '}
                <span className="font-semibold">{buktiTotal}</span> bukti nota siap dilampirkan
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <span>
                <span className="font-semibold">{buktiMissing}</span> item belum ada bukti nota
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
              onClick={() => {
                const content = printRef.current
                if (!content) return

                const win = window.open('', '_blank')
                if (!win) return

                const items = buktiStatus.filter((b) => b.bukti_url)
                const totalRows = Math.ceil(items.length / 4)

                let rows = ''
                for (let row = 0; row < totalRows; row++) {
                  let cells = ''
                  for (let col = 0; col < 4; col++) {
                    const idx = row * 4 + col
                    if (idx < items.length) {
                      const item = items[idx]
                      cells += `
                        <td style="padding:8px; text-align:center; width:25%; vertical-align:top;">
                          <div style="border:1px solid #d4d4d8; border-radius:6px; overflow:hidden; background:#fafafa;">
                            <img src="${item.bukti_url}" style="width:100%; height:200px; object-fit:cover; display:block;" onerror="this.parentElement.innerHTML='<div style=\\'height:200px;display:flex;align-items:center;justify-content:center;color:#a1a1aa;font-size:11px;\\'>Gagal memuat</div>'" />
                          </div>
                          <p style="margin-top:4px; font-size:11px; font-family:monospace; color:#52525b;">${item.kode}</p>
                          <p style="font-size:10px; color:#71717a; margin-top:1px;">${item.namaItem}</p>
                        </td>`
                    } else {
                      cells += '<td style="width:25%;"></td>'
                    }
                  }
                  rows += `<tr>${cells}</tr>`
                }

                win.document.write(`
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <title>Lampiran Bukti Nota - ${selectedYear}</title>
                    <style>
                      @page { margin: 1.5cm; }
                      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #18181b; }
                      .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #27272a; padding-bottom: 16px; }
                      .header h1 { font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0; letter-spacing: 0.05em; }
                      .header h2 { font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 4px 0 0; letter-spacing: 0.05em; }
                      .header p { font-size: 12px; color: #71717a; margin: 8px 0 0; }
                      table { width: 100%; border-collapse: collapse; }
                      .footer { margin-top: 24px; font-size: 10px; color: #a1a1aa; text-align: center; }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <h1>${selectedPeriode?.nama_organisasi || 'R-SCUAD'}</h1>
                      <h2>Lampiran Bukti Nota</h2>
                      <h2>Realisasi Anggaran KRSBI Humanoid Tahun ${selectedYear}</h2>
                      <p>Total: ${buktiTerupload} bukti dari ${buktiTotal} transaksi</p>
                    </div>
                    <table>${rows}</table>
                    <div class="footer">Dicetak pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </body>
                  </html>
                `)
                win.document.close()
                win.focus()
                setTimeout(() => { win.print() }, 500)
              }}
            >
              <Printer className="size-3.5" />
              Cetak Lampiran Bukti
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal Preview Bukti */}
      {previewBukti && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setPreviewBukti(null)} />
          <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-800">Bukti Nota — {previewBukti.kode}</h2>
                <p className="text-sm text-zinc-500">{previewBukti.namaItem}</p>
              </div>
              <button onClick={() => setPreviewBukti(null)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex items-center justify-center overflow-hidden rounded-lg border bg-zinc-50">
              {previewBukti.bukti_url ? (
                <img src={previewBukti.bukti_url} alt={previewBukti.namaItem} className="max-h-[60vh] w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-3 py-20 text-zinc-400">
                  <ImageIcon className="size-12" />
                  <p className="text-sm">Bukti belum diupload</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Kunci Laporan */}
      <Card className={isLocked ? 'border-teal-200' : 'border-amber-200'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            {isLocked ? <Lock className="size-4 text-teal-600" /> : <ShieldCheck className="size-4 text-amber-600" />}
            Kunci Laporan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLocked ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                <span>Laporan telah dikunci (Status: Final)</span>
              </div>
              <button onClick={handleUnlock} className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-800">
                <Unlock className="size-3.5" />
                Buka Kembali (Admin Override)
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                Setelah dikunci, laporan tidak bisa diedit lagi. Pastikan semua data sudah benar sebelum melanjutkan.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLock}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
                    showLockConfirm
                      ? 'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <Lock className="size-3.5" />
                  {showLockConfirm ? 'Konfirmasi & Kunci Sekarang' : 'Kunci Laporan (Ubah ke Final)'}
                </button>
                {showLockConfirm && (
                  <button onClick={() => setShowLockConfirm(false)} className="text-xs text-zinc-500 hover:text-zinc-800">Batal</button>
                )}
              </div>
              {showLockConfirm && (
                <p className="text-[11px] text-amber-600">Tindakan ini bersifat permanen. Laporan akan terkunci dan tidak bisa diubah.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
