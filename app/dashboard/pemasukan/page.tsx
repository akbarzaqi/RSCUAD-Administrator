'use client'

import { useState, useEffect, useCallback } from 'react'
import imageCompression from 'browser-image-compression'
import { useYear } from '@/app/contexts/year-context'
import { createClient } from '@/app/lib/supabase/client'
import type { Database } from '@/app/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
} from 'lucide-react'

type PemasukanRow = Database['public']['Tables']['pemasukan']['Row']

function rp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

const emptyForm = {
  kode: '',
  tanggal: '',
  namaAkun: '',
  satuan: 'Kali',
  qty: 1,
  hargaSatuan: 0,
}

export default function PemasukanPage() {
  const { selectedYear, periodeId } = useYear()
  const supabase = createClient()
  const [data, setData] = useState<PemasukanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [buktiPreview, setBuktiPreview] = useState<string | null>(null)
  const [buktiFile, setBuktiFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!periodeId) return
    setLoading(true)
    const { data: rows } = await supabase
      .from('pemasukan')
      .select('*')
      .eq('periode_id', periodeId)
      .order('kode')
    setData(rows || [])
    setLoading(false)
  }, [periodeId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPemasukan = data.reduce((s, r) => s + Number(r.jumlah), 0)

  const openAdd = () => {
    setEditingId(null)
    const nextKode = `A${data.length + 1}`
    setForm({ ...emptyForm, kode: nextKode })
    setBuktiPreview(null)
    setBuktiFile(null)
    setShowModal(true)
  }

  const openEdit = (item: PemasukanRow) => {
    setEditingId(item.id)
    setForm({
      kode: item.kode || '',
      tanggal: item.tanggal || '',
      namaAkun: item.nama_akun,
      satuan: item.satuan || 'Kali',
      qty: Number(item.qty),
      hargaSatuan: Number(item.harga_satuan),
    })
    setBuktiPreview(item.bukti_url || null)
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
    const filePath = `bukti-pemasukan/${fileName}`

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
    if (!form.namaAkun || !form.tanggal || !periodeId) return
    setSaving(true)

    let buktiUrl: string | null = editingId ? (buktiPreview?.startsWith('http') ? buktiPreview : null) : null

    if (buktiFile) {
      const uploaded = await uploadBukti(buktiFile)
      if (uploaded) {
        buktiUrl = uploaded
      } else {
        setSaving(false)
        return
      }
    }

    const qty = Number(form.qty)
    const hargaSatuan = Number(form.hargaSatuan)
    const jumlah = qty * hargaSatuan

    const payload = {
      periode_id: periodeId,
      kode: form.kode,
      tanggal: form.tanggal,
      nama_akun: form.namaAkun,
      satuan: form.satuan,
      qty,
      harga_satuan: hargaSatuan,
      jumlah,
      bukti_url: buktiUrl || null,
    }

    if (editingId) {
      const { error } = await supabase.from('pemasukan').update(payload).eq('id', editingId)
      if (error) console.error('Update error:', error)
    } else {
      const { error } = await supabase.from('pemasukan').insert(payload)
      if (error) console.error('Insert error:', error)
    }

    setShowModal(false)
    setForm(emptyForm)
    setEditingId(null)
    setBuktiPreview(null)
    setBuktiFile(null)
    setSaving(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('pemasukan').delete().eq('id', id)
    if (!error) fetchData()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Daftar Pemasukan</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Tahun Anggaran {selectedYear}</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4" />
          Tambah Pemasukan
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Total Pemasukan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-emerald-600">{rp(totalPemasukan)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Jumlah Transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{data.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Kode</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama Akun</TableHead>
                <TableHead>Satuan</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Harga Satuan</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="pr-6 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-sm text-zinc-400">Memuat data...</TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-sm text-zinc-400">Belum ada data pemasukan</TableCell>
                </TableRow>
              ) : (
                data.map((row, i) => (
                  <TableRow key={row.id} className={i % 2 === 1 ? 'bg-zinc-50/50' : ''}>
                    <TableCell className="pl-6">
                      <Badge variant="outline" className="text-[10px] font-mono tracking-wide">{row.kode}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-zinc-600">
                      {row.tanggal
                        ? new Date(row.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '-'}
                    </TableCell>
                    <TableCell>{row.nama_akun}</TableCell>
                    <TableCell className="text-zinc-600">{row.satuan}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(row.qty)}</TableCell>
                    <TableCell className="text-right tabular-nums">{rp(Number(row.harga_satuan))}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-emerald-600">{rp(Number(row.jumlah))}</TableCell>
                    <TableCell className="pr-6 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => openEdit(row)} className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-blue-50 hover:text-blue-600">
                          <Pencil className="size-4" />
                        </button>
                        <button onClick={() => handleDelete(row.id)} className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Menampilkan {data.length} dari {data.length} data</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" disabled><ChevronLeft className="size-4" /></Button>
          <Button variant="default" size="xs" className="min-w-8">1</Button>
          <Button variant="ghost" size="icon-xs"><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-800">
                {editingId ? 'Edit Pemasukan' : 'Tambah Pemasukan'}
              </h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Kode</label>
                  <input type="text" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} placeholder="A1"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Tanggal</label>
                  <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Nama Akun</label>
                <input type="text" value={form.namaAkun} onChange={(e) => setForm({ ...form, namaAkun: e.target.value })} placeholder="contoh: Dana Subsidi Tahap 1"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Satuan</label>
                  <select value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20">
                    <option value="Kali">Kali</option>
                    <option value="Buah">Buah</option>
                    <option value="Paket">Paket</option>
                    <option value="Unit">Unit</option>
                    <option value="Liter">Liter</option>
                    <option value="Meter">Meter</option>
                    <option value="Set">Set</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Qty</label>
                  <input type="number" min={1} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Harga Satuan</label>
                  <input type="number" min={0} value={form.hargaSatuan || ''} onChange={(e) => setForm({ ...form, hargaSatuan: Number(e.target.value) })} placeholder="0"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">Jumlah</span>
                  <span className="font-semibold tabular-nums text-emerald-600">{rp(form.qty * form.hargaSatuan)}</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Bukti Nota (opsional)</label>
                {buktiPreview ? (
                  <div className="relative overflow-hidden rounded-lg border border-zinc-200">
                    <img src={buktiPreview} alt="Preview bukti nota" className="h-40 w-full object-contain bg-zinc-50" />
                    <button type="button" onClick={() => { setBuktiPreview(null); setBuktiFile(null) }}
                      className="absolute right-2 top-2 rounded-md bg-black/50 p-1 text-white hover:bg-black/70">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 p-6 text-sm text-zinc-500 transition-colors hover:border-emerald-300 hover:text-emerald-600">
                    <Upload className="size-5" />
                    <span>Klik untuk upload bukti nota</span>
                    <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
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
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Batal</Button>
              <Button size="sm" onClick={handleSave} disabled={!form.namaAkun || !form.tanggal || saving}>
                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Pemasukan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
