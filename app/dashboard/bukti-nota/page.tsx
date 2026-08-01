'use client'

import { useState, useEffect, useCallback } from 'react'
import imageCompression from 'browser-image-compression'
import { useYear } from '@/app/contexts/year-context'
import { createClient } from '@/app/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Search,
  Filter,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Eye,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type BuktiItem = {
  id: string
  kode: string
  namaItem: string
  asal: 'Pemasukan' | 'Pengeluaran'
  kategori?: string
  tanggal: string | null
  jumlah: number
  bukti_url: string | null
}

const emptyForm = {
  kode: '',
  namaItem: '',
  asal: 'Pemasukan' as 'Pemasukan' | 'Pengeluaran',
  kategori: '',
  tanggal: '',
  jumlah: 0,
}

function rp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(n))
}

export default function BuktiNotaPage() {
  const { selectedYear, periodeId } = useYear()
  const supabase = createClient()
  const [data, setData] = useState<BuktiItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [buktiPreview, setBuktiPreview] = useState<string | null>(null)
  const [buktiFile, setBuktiFile] = useState<File | null>(null)
  const [editingEntry, setEditingEntry] = useState<{ asal: 'Pemasukan' | 'Pengeluaran'; id: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const [showPreview, setShowPreview] = useState<BuktiItem | null>(null)

  const fetchData = useCallback(async () => {
    if (!periodeId) return
    setLoading(true)

    const kategoriRes = await supabase
      .from('kategori_pengeluaran')
      .select('id, nama_kategori')
      .eq('periode_id', periodeId)

    const kategoriMap = new Map<string, string>()
    for (const k of kategoriRes.data || []) {
      kategoriMap.set(k.id, k.nama_kategori)
    }

    const kategoriIds = kategoriRes.data?.map((k) => k.id) || []

    const [pemRes, pengRes] = await Promise.all([
      supabase.from('pemasukan').select('*').eq('periode_id', periodeId),
      kategoriIds.length > 0
        ? supabase.from('pengeluaran').select('*').in('kategori_id', kategoriIds)
        : { data: [] },
    ])

    const pemItems: BuktiItem[] = (pemRes.data || []).map((r) => ({
      id: r.id,
      kode: r.kode || '-',
      namaItem: r.nama_akun,
      asal: 'Pemasukan' as const,
      tanggal: r.tanggal,
      jumlah: Number(r.jumlah),
      bukti_url: r.bukti_url,
    }))

    const pengItems: BuktiItem[] = (pengRes.data || []).map((r) => ({
      id: r.id,
      kode: r.kode || '-',
      namaItem: r.nama_item,
      asal: 'Pengeluaran' as const,
      kategori: kategoriMap.get(r.kategori_id) || undefined,
      tanggal: r.tanggal || null,
      jumlah: Number(r.jumlah),
      bukti_url: r.bukti_url,
    }))

    setData([...pemItems, ...pengItems].sort((a, b) => a.kode.localeCompare(b.kode)))
    setLoading(false)
  }, [periodeId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = data.filter((b) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      b.kode.toLowerCase().includes(q) ||
      b.namaItem.toLowerCase().includes(q) ||
      b.kategori?.toLowerCase().includes(q)
    )
  })

  const totalTerupload = data.filter((b) => !!b.bukti_url).length
  const totalMenunggu = data.filter((b) => !b.bukti_url).length

  const openAdd = () => {
    setEditingEntry(null)
    setForm(emptyForm)
    setBuktiPreview(null)
    setBuktiFile(null)
    setShowModal(true)
  }

  const openUploadFor = (item: BuktiItem) => {
    setEditingEntry({ asal: item.asal, id: item.id })
    setForm({
      kode: item.kode,
      namaItem: item.namaItem,
      asal: item.asal,
      kategori: item.kategori || '',
      tanggal: item.tanggal || '',
      jumlah: item.jumlah,
    })
    setBuktiPreview(null)
    setBuktiFile(null)
    setShowModal(true)
  }

  const uploadBukti = async (file: File): Promise<string | null> => {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
    })
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
    const filePath = `bukti-nota/${fileName}`

    const { error } = await supabase.storage
      .from('lpj')
      .upload(filePath, compressed, { contentType: compressed.type })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    const { data: urlData } = supabase.storage.from('lpj').getPublicUrl(filePath)
    return urlData.publicUrl
  }

  const handleSave = async () => {
    if (!form.namaItem) return
    setSaving(true)

    let buktiUrl = buktiPreview

    if (buktiFile) {
      const uploaded = await uploadBukti(buktiFile)
      if (uploaded) buktiUrl = uploaded
    }

    if (editingEntry) {
      if (editingEntry.asal === 'Pemasukan') {
        await supabase.from('pemasukan').update({ bukti_url: buktiUrl }).eq('id', editingEntry.id)
      } else {
        await supabase.from('pengeluaran').update({ bukti_url: buktiUrl }).eq('id', editingEntry.id)
      }
    } else {
      if (form.asal === 'Pemasukan' && periodeId) {
        const qty = Number(form.jumlah) || 1
        await supabase.from('pemasukan').insert({
          periode_id: periodeId,
          kode: form.kode,
          nama_akun: form.namaItem,
          tanggal: form.tanggal || null,
          satuan: 'Kali',
          qty,
          harga_satuan: Number(form.jumlah) / qty || 0,
          jumlah: Number(form.jumlah),
          bukti_url: buktiUrl,
        })
      } else if (form.asal === 'Pengeluaran') {
        const kategoriRes = await supabase
          .from('kategori_pengeluaran')
          .select('id')
          .eq('periode_id', periodeId)
          .eq('nama_kategori', form.kategori)
          .single()

        if (kategoriRes.data) {
          await supabase.from('pengeluaran').insert({
            kategori_id: kategoriRes.data.id,
            kode: form.kode,
            nama_item: form.namaItem,
            satuan: 'Kali',
            qty: 1,
            harga_satuan: Number(form.jumlah),
            jumlah: Number(form.jumlah),
            bukti_url: buktiUrl,
          })
        }
      }
    }

    setShowModal(false)
    setForm(emptyForm)
    setBuktiPreview(null)
    setBuktiFile(null)
    setEditingEntry(null)
    setSaving(false)
    fetchData()
  }

  const handleDelete = async (item: BuktiItem) => {
    if (item.asal === 'Pemasukan') {
      await supabase.from('pemasukan').delete().eq('id', item.id)
    } else {
      await supabase.from('pengeluaran').delete().eq('id', item.id)
    }
    fetchData()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bukti Nota</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Kelola bukti nota untuk seluruh transaksi pemasukan dan pengeluaran — Tahun {selectedYear}
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4" />
          Upload Bukti
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Total Bukti</CardTitle>
            <ImageIcon className="size-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{data.length}</p>
            <p className="text-xs text-zinc-500">dari seluruh transaksi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Terupload</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-emerald-600">{totalTerupload}</p>
            <p className="text-xs text-zinc-500">bukti lengkap</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Menunggu Upload</CardTitle>
            <Clock className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-amber-600">{totalMenunggu}</p>
            <p className="text-xs text-zinc-500">belum ada bukti</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Daftar Bukti Nota</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="size-3.5" />
                Filter
              </Button>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari kode atau nama..."
                  className="h-8 rounded-md border bg-white pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-zinc-50/80">
                  <th className="px-6 py-2.5 text-left text-xs font-medium text-zinc-500">Bukti</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Kode</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Nama Item</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Asal</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Jumlah</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-6 py-2.5 text-center text-xs font-medium text-zinc-500">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-sm text-zinc-400">Memuat data...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-sm text-zinc-400">Tidak ada data</td></tr>
                ) : (
                  filtered.map((item, i) => (
                    <tr key={item.id} className={`border-b transition-colors hover:bg-zinc-50/50 ${i % 2 === 1 ? 'bg-zinc-50/30' : ''}`}>
                      <td className="px-6 py-3">
                        {item.bukti_url ? (
                          <button onClick={() => setShowPreview(item)}
                            className="group relative inline-flex size-12 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-zinc-50">
                            <img src={item.bukti_url} alt={item.namaItem} className="size-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                              <Eye className="size-3.5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                            </div>
                          </button>
                        ) : (
                          <button onClick={() => openUploadFor(item)}
                            className="inline-flex size-12 items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 text-zinc-400 transition-colors hover:border-emerald-300 hover:text-emerald-500">
                            <Upload className="size-4" />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] font-mono tracking-wide">{item.kode}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{item.namaItem}</p>
                          {item.kategori && <p className="text-xs text-zinc-400">{item.kategori}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={`text-[10px] ${item.asal === 'Pemasukan' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {item.asal}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-600">{rp(item.jumlah)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary" className={`text-[10px] ${item.bukti_url ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {item.bukti_url ? 'Terupload' : 'Menunggu'}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {item.bukti_url ? (
                            <button onClick={() => setShowPreview(item)} className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-blue-50 hover:text-blue-600">
                              <Eye className="size-4" />
                            </button>
                          ) : (
                            <button onClick={() => openUploadFor(item)} className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600">
                              <Upload className="size-4" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(item)} className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Menampilkan {filtered.length} dari {data.length} bukti nota</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" disabled><ChevronLeft className="size-4" /></Button>
          <Button variant="default" size="xs" className="min-w-8">1</Button>
          <Button variant="ghost" size="icon-xs"><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      {/* Modal Upload Bukti */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-800">
                {editingEntry ? 'Upload Bukti Nota' : 'Tambah Bukti Nota'}
              </h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Kode</label>
                  <input type="text" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} placeholder="A1, B1, C1..."
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Asal Transaksi</label>
                  <select value={form.asal} onChange={(e) => setForm({ ...form, asal: e.target.value as 'Pemasukan' | 'Pengeluaran' })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20">
                    <option value="Pemasukan">Pemasukan</option>
                    <option value="Pengeluaran">Pengeluaran</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Nama Item</label>
                <input type="text" value={form.namaItem} onChange={(e) => setForm({ ...form, namaItem: e.target.value })} placeholder="contoh: Dana Subsidi Tahap 1"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Tanggal</label>
                  <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Jumlah</label>
                  <input type="number" min={0} value={form.jumlah || ''} onChange={(e) => setForm({ ...form, jumlah: Number(e.target.value) })} placeholder="0"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>
              {form.asal === 'Pengeluaran' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Kategori</label>
                  <select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20">
                    <option value="">Pilih kategori</option>
                    <option value="Administrasi">Administrasi</option>
                    <option value="Perlengkapan Robot">Perlengkapan Robot</option>
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">File Bukti Nota</label>
                {buktiPreview ? (
                  <div className="relative overflow-hidden rounded-lg border border-zinc-200">
                    <img src={buktiPreview} alt="Preview bukti" className="h-48 w-full object-contain bg-zinc-50" />
                    <button type="button" onClick={() => { setBuktiPreview(null); setBuktiFile(null) }}
                      className="absolute right-2 top-2 rounded-md bg-black/50 p-1 text-white hover:bg-black/70">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 p-8 text-sm text-zinc-500 transition-colors hover:border-emerald-300 hover:text-emerald-600">
                    <Upload className="size-8" />
                    <span className="font-medium">Klik untuk upload file</span>
                    <span className="text-xs text-zinc-400">Format: JPG, PNG, PDF (Maks. 5MB)</span>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1200, useWebWorker: true })
                        const reader = new FileReader()
                        reader.onloadend = () => setBuktiPreview(reader.result as string)
                        reader.readAsDataURL(compressed)
                        setBuktiFile(file)
                      }
                    }} />
                  </label>
                )}
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">Jumlah Nilai</span>
                  <span className="font-semibold tabular-nums text-emerald-600">{rp(form.jumlah)}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Batal</Button>
              <Button size="sm" onClick={handleSave} disabled={!form.namaItem || saving}>
                {saving ? 'Menyimpan...' : editingEntry ? 'Upload & Simpan' : 'Tambah Bukti'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Bukti */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setShowPreview(null)} />
          <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-800">Bukti Nota — {showPreview.kode}</h2>
                <p className="text-sm text-zinc-500">{showPreview.namaItem}</p>
              </div>
              <button onClick={() => setShowPreview(null)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex items-center justify-center overflow-hidden rounded-lg border bg-zinc-50">
              {showPreview.bukti_url ? (
                <img src={showPreview.bukti_url} alt={showPreview.namaItem} className="max-h-[60vh] w-full object-contain" />
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
    </div>
  )
}
