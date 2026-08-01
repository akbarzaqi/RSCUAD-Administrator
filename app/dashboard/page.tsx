'use client'

import { useState, useEffect } from 'react'
import { useYear } from '@/app/contexts/year-context'
import { createClient } from '@/app/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Wallet,
  PiggyBank,
  Receipt,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'

function rp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(n))
}

function YearSelector({ onSelect }: { onSelect: (year: number) => void }) {
  const { availableYears, loading, createPeriode } = useYear()
  const [showForm, setShowForm] = useState(false)
  const [newYear, setNewYear] = useState('')
  const [newOrg, setNewOrg] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const [periodeStats, setPeriodeStats] = useState<
    Record<string, { totalPemasukan: number; totalPengeluaran: number; txCount: number }>
  >({})

  useEffect(() => {
    const fetchStats = async () => {
      for (const p of availableYears) {
        const [pem, peng] = await Promise.all([
          supabase.from('pemasukan').select('jumlah').eq('periode_id', p.id),
          supabase.from('pengeluaran').select('jumlah, kategori_id').eq('kategori_id', p.id),
        ])

        const totalPemasukan = (pem.data || []).reduce((s, r) => s + Number(r.jumlah), 0)

        const pengIds = (
          await supabase.from('kategori_pengeluaran').select('id').eq('periode_id', p.id)
        ).data?.map((k) => k.id) || []

        const pengData = pengIds.length
          ? (await supabase.from('pengeluaran').select('jumlah').in('kategori_id', pengIds)).data || []
          : []

        const totalPengeluaran = pengData.reduce((s, r) => s + Number(r.jumlah), 0)
        const txCount = (pem.data?.length || 0) + pengData.length

        setPeriodeStats((prev) => ({
          ...prev,
          [p.tahun]: { totalPemasukan, totalPengeluaran, txCount },
        }))
      }
    }
    if (availableYears.length > 0) fetchStats()
  }, [availableYears])

  const handleAdd = async () => {
    if (!newYear || !newOrg) return
    setSaving(true)
    try {
      await createPeriode(newYear, newOrg)
      setNewYear('')
      setNewOrg('')
      setShowForm(false)
      onSelect(parseInt(newYear))
    } catch {
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-zinc-100">
            <Calendar className="size-8 text-zinc-600" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Pilih Periode Anggaran</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Pilih tahun anggaran yang ingin dilihat
          </p>
        </div>

        {loading ? (
          <div className="text-center text-sm text-zinc-400 py-8">Memuat data...</div>
        ) : (
          <div className="space-y-3">
            {availableYears.map((periode) => {
              const stats = periodeStats[periode.tahun]
              const totalPemasukan = stats?.totalPemasukan || 0
              const totalPengeluaran = stats?.totalPengeluaran || 0
              const txCount = stats?.txCount || 0
              const saldo = totalPemasukan - totalPengeluaran
              return (
                <button
                  key={periode.id}
                  onClick={() => onSelect(parseInt(periode.tahun))}
                  className="group flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-100 text-lg font-bold text-zinc-700 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-700">
                      {periode.tahun}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-zinc-800">{periode.nama_organisasi} — {periode.tahun}</h3>
                        {periode.status === 'Final' ? (
                          <Badge variant="secondary" className="bg-teal-50 text-teal-700">Final</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700">Draft</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {txCount} transaksi &middot; Saldo {rp(saldo)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-600" />
                </button>
              )
            })}

            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="group flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-white p-4 text-sm font-medium text-zinc-500 transition-all hover:border-emerald-400 hover:text-emerald-600"
              >
                <Plus className="size-4" />
                Tambah Periode Baru
              </button>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-zinc-800">Tambah Periode Baru</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Tahun Anggaran</label>
                    <input
                      type="number"
                      placeholder="contoh: 2026"
                      value={newYear}
                      onChange={(e) => setNewYear(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Nama Organisasi</label>
                    <input
                      type="text"
                      placeholder="contoh: R-SCUAD"
                      value={newOrg}
                      onChange={(e) => setNewOrg(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" onClick={handleAdd} disabled={!newYear || !newOrg || saving}>
                      <Plus className="size-3.5" />
                      {saving ? 'Membuat...' : 'Buat Periode'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                      Batal
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DashboardYear({ year, onBack }: { year: number; onBack: () => void }) {
  const { selectedPeriode, periodeId } = useYear()
  const supabase = createClient()
  const [totalPemasukan, setTotalPemasukan] = useState(0)
  const [totalPengeluaran, setTotalPengeluaran] = useState(0)
  const [totalTransaksi, setTotalTransaksi] = useState(0)
  const [missingProof, setMissingProof] = useState(0)
  const [recentTx, setRecentTx] = useState<
    { kode: string; tanggal: string; deskripsi: string; nominal: number; hasBukti: boolean }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!periodeId) return
    setLoading(true)

    const fetchData = async () => {
      const [pemRes, kategoriRes] = await Promise.all([
        supabase.from('pemasukan').select('*').eq('periode_id', periodeId),
        supabase.from('kategori_pengeluaran').select('id').eq('periode_id', periodeId),
      ])

      const pemData = pemRes.data || []
      const kategoriIds = kategoriRes.data?.map((k) => k.id) || []

      let pengData: { kode: string | null; nama_item: string; jumlah: number; bukti_url: string | null; kategori_id: string }[] = []
      if (kategoriIds.length > 0) {
        const res = await supabase.from('pengeluaran').select('*').in('kategori_id', kategoriIds)
        pengData = res.data || []
      }

      const tPemasukan = pemData.reduce((s, r) => s + Number(r.jumlah), 0)
      const tPengeluaran = pengData.reduce((s, r) => s + Number(r.jumlah), 0)
      const tMissingPem = pemData.filter((r) => !r.bukti_url).length
      const tMissingPeng = pengData.filter((r) => !r.bukti_url).length

      setTotalPemasukan(tPemasukan)
      setTotalPengeluaran(tPengeluaran)
      setTotalTransaksi(pemData.length + pengData.length)
      setMissingProof(tMissingPem + tMissingPeng)

      const pemasukanTx = pemData.map((r) => ({
        kode: r.kode || '-',
        tanggal: r.tanggal || '',
        deskripsi: r.nama_akun,
        nominal: Number(r.jumlah),
        hasBukti: !!r.bukti_url,
      }))
      const pengeluaranTx = pengData.map((r) => ({
        kode: r.kode || '-',
        tanggal: r.tanggal || '',
        deskripsi: r.nama_item,
        nominal: -Number(r.jumlah),
        hasBukti: !!r.bukti_url,
      }))

      const allTx = [...pemasukanTx, ...pengeluaranTx]
        .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''))
        .slice(0, 8)

      setRecentTx(allTx)
      setLoading(false)
    }

    fetchData()
  }, [periodeId])

  const saldo = totalPemasukan - totalPengeluaran
  const proofProgress = totalTransaksi > 0 ? Math.round(((totalTransaksi - missingProof) / totalTransaksi) * 100) : 100

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-sm text-zinc-400">Memuat data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">
            {selectedPeriode?.nama_organisasi || 'Tahun Anggaran'} {year}
          </h1>
          <Badge variant={selectedPeriode?.status === 'Draft' ? 'secondary' : 'default'}>
            {selectedPeriode?.status || 'Draft'}
          </Badge>
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
            <PiggyBank className="size-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tracking-tight text-teal-600">{rp(saldo)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Bukti Nota</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>
              {totalTransaksi - missingProof} dari {totalTransaksi} transaksi memiliki bukti nota
            </span>
            <span className="tabular-nums text-muted-foreground">{proofProgress}%</span>
          </div>
          <Progress value={proofProgress} />
          {missingProof > 0 && (
            <p className="mt-1 text-xs text-amber-600">{missingProof} transaksi masih kurang bukti nota</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Transaksi Terbaru</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Kode</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="pr-6 text-center">Bukti</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTx.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-sm text-zinc-400">
                    Belum ada transaksi
                  </TableCell>
                </TableRow>
              ) : (
                recentTx.map((tx, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6 font-medium text-zinc-500">{tx.kode}</TableCell>
                    <TableCell className="text-zinc-600">
                      {tx.tanggal
                        ? new Date(tx.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '-'}
                    </TableCell>
                    <TableCell>{tx.deskripsi}</TableCell>
                    <TableCell className={`text-right tabular-nums ${tx.nominal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {tx.nominal >= 0 ? '+' : ''}{rp(tx.nominal)}
                    </TableCell>
                    <TableCell className="pr-6 text-center">
                      {tx.hasBukti ? (
                        <CheckCircle2 className="inline-block size-4 text-emerald-500" />
                      ) : (
                        <Circle className="inline-block size-4 text-zinc-300" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function DashboardPage() {
  const { selectedYear, setSelectedYear } = useYear()

  if (!selectedYear) {
    return <YearSelector onSelect={setSelectedYear} />
  }

  return <DashboardYear year={selectedYear} onBack={() => setSelectedYear(null)} />
}
