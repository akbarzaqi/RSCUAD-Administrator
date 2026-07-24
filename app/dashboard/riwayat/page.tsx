'use client'

import { useState, useEffect } from 'react'
import { useYear } from '@/app/contexts/year-context'
import { createClient } from '@/app/lib/supabase/client'
import type { Database } from '@/app/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  History,
  ChevronDown,
  ChevronRight,
  Calendar,
  Wallet,
  Receipt,
  Lock,
} from 'lucide-react'

type PeriodeRow = Database['public']['Tables']['periode_anggaran']['Row']

type TahunRiwayat = {
  periode: PeriodeRow
  pemasukan: number
  pengeluaran: number
  jumlahTransaksi: number
  kategori: { nama: string; total: number }[]
}

function rp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export default function RiwayatPage() {
  const { setSelectedYear } = useYear()
  const supabase = createClient()
  const [riwayatData, setRiwayatData] = useState<TahunRiwayat[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedYear, setExpandedYear] = useState<string | null>(null)

  useEffect(() => {
    const fetchAll = async () => {
      const { data: periodes } = await supabase
        .from('periode_anggaran')
        .select('*')
        .order('tahun', { ascending: false })

      if (!periodes) {
        setLoading(false)
        return
      }

      const results: TahunRiwayat[] = []

      for (const p of periodes) {
        const [pemRes, kategoriRes] = await Promise.all([
          supabase.from('pemasukan').select('*').eq('periode_id', p.id),
          supabase.from('kategori_pengeluaran').select('*').eq('periode_id', p.id),
        ])

        const pemData = pemRes.data || []
        const tPemasukan = pemData.reduce((s, r) => s + Number(r.jumlah), 0)

        const kategoriIds = kategoriRes.data?.map((k) => k.id) || []
        const kategoriList: { nama: string; total: number }[] = []
        let allPengItems: { jumlah: number }[] = []

        for (const k of kategoriRes.data || []) {
          const { data: items } = await supabase.from('pengeluaran').select('jumlah').eq('kategori_id', k.id)
          const total = (items || []).reduce((s, r) => s + Number(r.jumlah), 0)
          kategoriList.push({ nama: k.nama_kategori, total })
          allPengItems = [...allPengItems, ...(items || [])]
        }

        const tPengeluaran = allPengItems.reduce((s, r) => s + Number(r.jumlah), 0)

        results.push({
          periode: p,
          pemasukan: tPemasukan,
          pengeluaran: tPengeluaran,
          jumlahTransaksi: pemData.length + allPengItems.length,
          kategori: kategoriList,
        })
      }

      setRiwayatData(results)
      setLoading(false)
    }

    fetchAll()
  }, [supabase])

  const totalPemasukan = riwayatData.reduce((s, r) => s + r.pemasukan, 0)
  const totalPengeluaran = riwayatData.reduce((s, r) => s + r.pengeluaran, 0)

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
          <h1 className="text-xl font-semibold tracking-tight">Riwayat</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Lihat riwayat laporan anggaran dari tahun ke tahun</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Total Tahun</CardTitle>
            <Calendar className="size-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{riwayatData.length}</p>
            <p className="text-xs text-zinc-500">tahun tercatat</p>
          </CardContent>
        </Card>
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
      </div>

      <div className="space-y-3">
        {riwayatData.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-zinc-400">Belum ada riwayat</CardContent>
          </Card>
        ) : (
          riwayatData.map((item) => {
            const isExpanded = expandedYear === item.periode.id
            const saldo = item.pemasukan - item.pengeluaran
            const isFinal = item.periode.status === 'Final'

            return (
              <Card
                key={item.periode.id}
                className={`overflow-hidden transition-all ${isFinal ? 'border-teal-200' : 'border-amber-200'}`}
              >
                <button
                  onClick={() => setExpandedYear(isExpanded ? null : item.periode.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-zinc-50/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-100">
                      <Calendar className="size-5 text-zinc-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-zinc-800">{item.periode.nama_organisasi} — {item.periode.tahun}</h3>
                        {isFinal ? (
                          <Badge variant="secondary" className="gap-1 bg-teal-50 text-teal-700">
                            <Lock className="size-2.5" />
                            Final
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 bg-amber-50 text-amber-700">Draft</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {item.jumlahTransaksi} transaksi &middot; {item.kategori.length} kategori
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Saldo</p>
                      <p className="text-sm font-semibold tabular-nums text-teal-600">{rp(saldo)}</p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-zinc-400" />
                    ) : (
                      <ChevronRight className="size-4 text-zinc-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-200 bg-zinc-50/30 px-5 py-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-zinc-200 bg-white p-3">
                        <p className="text-xs text-zinc-500">Total Pemasukan</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600">{rp(item.pemasukan)}</p>
                      </div>
                      <div className="rounded-lg border border-zinc-200 bg-white p-3">
                        <p className="text-xs text-zinc-500">Total Pengeluaran</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-orange-600">{rp(item.pengeluaran)}</p>
                      </div>
                      <div className="rounded-lg border border-zinc-200 bg-white p-3">
                        <p className="text-xs text-zinc-500">Saldo Akhir</p>
                        <p className="mt-1 text-lg font-bold tabular-nums text-teal-600">{rp(saldo)}</p>
                      </div>
                    </div>

                    {item.kategori.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-zinc-600">Rincian Pengeluaran per Kategori</p>
                        <div className="overflow-hidden rounded-lg border border-zinc-200">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b bg-zinc-100">
                                <th className="px-3 py-2 text-left font-bold text-zinc-700">Kategori</th>
                                <th className="px-3 py-2 text-right font-bold text-zinc-700">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.kategori.map((kat) => (
                                <tr key={kat.nama} className="border-b border-zinc-200">
                                  <td className="px-3 py-1.5 text-zinc-700">{kat.nama}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums text-zinc-700">{rp(kat.total)}</td>
                                </tr>
                              ))}
                              <tr className="bg-zinc-50 font-bold">
                                <td className="px-3 py-2 text-zinc-800">Total Pengeluaran</td>
                                <td className="px-3 py-2 text-right tabular-nums text-orange-700">{rp(item.pengeluaran)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedYear(parseInt(item.periode.tahun))} className="gap-1.5">
                        Lihat Laporan
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
