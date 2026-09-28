'use client'

import { useState, useEffect, useCallback } from 'react'
import imageCompression from 'browser-image-compression'
import { useYear } from '@/app/contexts/year-context'
import { createClient } from '@/app/lib/supabase/client'
import type { Database } from '@/app/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Plus,
  Wallet,
  PiggyBank,
  Pencil,
  Trash2,
  X,
  Upload,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

type KategoriRow = Database['public']['Tables']['kategori_pengeluaran']['Row']
type PengeluaranRow = Database['public']['Tables']['pengeluaran']['Row']

type KategoriWithItems = KategoriRow & { items: PengeluaranRow[] }
type SortKey = 'no' | 'nama' | 'tanggal' | 'satuan' | 'unit' | 'harga' | 'jumlah' | 'kode'

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

const emptyCatForm = { nama: '' }
const emptyItemForm = { nama: '', satuan: 'Kali', unit: 1, harga: 0, kode: '', tanggal: '' }

export default function PengeluaranPage() {
  const { selectedYear, periodeId } = useYear()
  const supabase = createClient()
  const [kategori, setKategori] = useState<KategoriWithItems[]>([])
  const [totalPemasukan, setTotalPemasukan] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; asc: boolean }>({ key: 'kode', asc: true })

  const [showCatModal, setShowCatModal] = useState(false)
  const [catForm, setCatForm] = useState(emptyCatForm)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)

  const [showItemModal, setShowItemModal] = useState(false)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [itemTargetCatId, setItemTargetCatId] = useState<string>('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [buktiPreview, setBuktiPreview] = useState<string | null>(null)
  const [buktiFile, setBuktiFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!periodeId) return
    setLoading(true)

    const [kategoriRes, pemasukanRes] = await Promise.all([
      supabase.from('kategori_pengeluaran').select('*').eq('periode_id', periodeId).order('urutan'),
      supabase.from('pemasukan').select('jumlah').eq('periode_id', periodeId),
    ])

    const kategoriRows = kategoriRes.data
    const pemTotal = (pemasukanRes.data || []).reduce((s, r) => s + Number(r.jumlah), 0)
    setTotalPemasukan(pemTotal)

    const kategoriList: KategoriWithItems[] = []

    for (const k of kategoriRows || []) {
      const { data: items } = await supabase
        .from('pengeluaran')
        .select('*')
        .eq('kategori_id', k.id)

      const sortedItems = (items || []).sort((a, b) =>
        (a.kode || '').localeCompare(b.kode || '', undefined, { numeric: true, sensitivity: 'base' })
      )

      kategoriList.push({ ...k, items: sortedItems })
    }

    setKategori(kategoriList)
    setLoading(false)
  }, [periodeId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const grandTotal = kategori.reduce(
    (s, k) => s + k.items.reduce((ss, r) => ss + Number(r.jumlah), 0),
    0,
  )

  const getNextKode = (catIndex: number) => {
    const prefix = String.fromCharCode(66 + catIndex)
    const catItems = kategori[catIndex]?.items || []
    let maxNum = 0
    for (const item of catItems) {
      if (item.kode && item.kode.startsWith(prefix)) {
        const numPart = parseInt(item.kode.slice(prefix.length), 10)
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart
        }
      }
    }
    return `${prefix}${maxNum + 1}`
  }

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => ({ key, asc: prev.key === key ? !prev.asc : true }))
  }

  const getSortedItems = (items: PengeluaranRow[]) => {
    return [...items].sort((a, b) => {
      let cmp = 0
      switch (sortConfig.key) {
        case 'kode':
          cmp = (a.kode || '').localeCompare(b.kode || '', undefined, { numeric: true, sensitivity: 'base' })
          break
        case 'nama':
          cmp = (a.nama_item || '').localeCompare(b.nama_item || '')
          break
        case 'tanggal':
          cmp = (a.tanggal || '').localeCompare(b.tanggal || '')
          break
        case 'satuan':
          cmp = (a.satuan || '').localeCompare(b.satuan || '')
          break
        case 'unit':
          cmp = Number(a.qty) - Number(b.qty)
          break
        case 'harga':
          cmp = Number(a.harga_satuan) - Number(b.harga_satuan)
          break
        case 'jumlah':
          cmp = Number(a.jumlah) - Number(b.jumlah)
          break
      }
      return sortConfig.asc ? cmp : -cmp
    })
  }

  const openAddCat = () => {
    setEditingCatId(null)
    setCatForm(emptyCatForm)
    setShowCatModal(true)
  }

  const openEditCat = (k: KategoriWithItems) => {
    setEditingCatId(k.id)
    setCatForm({ nama: k.nama_kategori })
    setShowCatModal(true)
  }

  const handleSaveCat = async () => {
    if (!catForm.nama || !periodeId) return
    setSaving(true)

    if (editingCatId) {
      await supabase.from('kategori_pengeluaran').update({ nama_kategori: catForm.nama }).eq('id', editingCatId)
    } else {
      const maxUrutan = kategori.length > 0 ? Math.max(...kategori.map((k) => k.urutan)) + 1 : 1
      await supabase.from('kategori_pengeluaran').insert({
        periode_id: periodeId,
        nama_kategori: catForm.nama,
        urutan: maxUrutan,
      })
    }

    setShowCatModal(false)
    setCatForm(emptyCatForm)
    setEditingCatId(null)
    setSaving(false)
    fetchData()
  }

  const handleDeleteCat = async (id: string) => {
    await supabase.from('kategori_pengeluaran').delete().eq('id', id)
    fetchData()
  }

  const openAddItem = (catId: string, catIndex: number) => {
    setItemTargetCatId(catId)
    setEditingItemId(null)
    setItemForm({ ...emptyItemForm, kode: getNextKode(catIndex) })
    setBuktiPreview(null)
    setBuktiFile(null)
    setShowItemModal(true)
  }

  const openEditItem = (catId: string, item: PengeluaranRow, catIndex: number) => {
    setItemTargetCatId(catId)
    setEditingItemId(item.id)
    setItemForm({
      nama: item.nama_item,
      satuan: item.satuan || 'Kali',
      unit: Number(item.qty),
      harga: Number(item.harga_satuan),
      kode: item.kode || '',
      tanggal: item.tanggal || '',
    })
    setBuktiPreview(item.bukti_url || null)
    setBuktiFile(null)
    setShowItemModal(true)
  }

  const uploadBukti = async (file: File): Promise<string | null> => {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
    })
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
    const filePath = `bukti-pengeluaran/${fileName}`

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

  const handleSaveItem = async () => {
    if (!itemForm.nama || !itemForm.tanggal) return
    setSaving(true)

    let buktiUrl: string | null = editingItemId ? (buktiPreview?.startsWith('http') ? buktiPreview : null) : null

    if (buktiFile) {
      const uploaded = await uploadBukti(buktiFile)
      if (uploaded) {
        buktiUrl = uploaded
      } else {
        setSaving(false)
        return
      }
    }

    const unit = Number(itemForm.unit)
    const harga = Number(itemForm.harga)
    const jumlah = unit * harga

    const payload = {
      kategori_id: itemTargetCatId,
      kode: itemForm.kode,
      nama_item: itemForm.nama,
      satuan: itemForm.satuan,
      qty: unit,
      harga_satuan: harga,
      jumlah,
      bukti_url: buktiUrl || null,
      tanggal: itemForm.tanggal,
    }

    if (editingItemId) {
      await supabase.from('pengeluaran').update(payload).eq('id', editingItemId)
    } else {
      await supabase.from('pengeluaran').insert(payload)
    }

    setShowItemModal(false)
    setItemForm(emptyItemForm)
    setEditingItemId(null)
    setBuktiPreview(null)
    setBuktiFile(null)
    setSaving(false)
    fetchData()
  }

  const handleDeleteItem = async (id: string) => {
    await supabase.from('pengeluaran').delete().eq('id', id)
    fetchData()
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
          <h1 className="text-xl font-semibold tracking-tight">Detail Pengeluaran</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Realisasi anggaran KRSBI Humanoid Tahun {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openAddCat}>
            <Plus className="size-4" />
            Tambah Kategori
          </Button>
          {kategori.length > 0 && (
            <Button size="sm" onClick={() => openAddItem(kategori[0].id, 0)}>
              <Plus className="size-4" />
              Tambah Item
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Total Terpakai</CardTitle>
            <Wallet className="size-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-red-600">{rp(grandTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Sisa Saldo Anggaran</CardTitle>
            <PiggyBank className="size-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-emerald-600">{rp(totalPemasukan - grandTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto p-4">
          {kategori.map((kat, katIdx) => {
            const totalKat = kat.items.reduce((s, r) => s + Number(r.jumlah), 0)
            return (
              <div key={kat.id} className="mb-4">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th colSpan={9} className="border border-zinc-400 bg-zinc-200 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold uppercase tracking-wider text-zinc-700">{kat.nama_kategori}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openAddItem(kat.id, katIdx)} className="rounded p-1 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-800" title="Tambah Item">
                              <Plus className="size-3.5" />
                            </button>
                            <button onClick={() => openEditCat(kat)} className="rounded p-1 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-800" title="Edit Kategori">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => handleDeleteCat(kat.id)} className="rounded p-1 text-zinc-500 hover:bg-red-200 hover:text-red-700" title="Hapus Kategori">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </th>
                    </tr>
                    <tr>
                      <th className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-8">NO</th>
                      <th
                        className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-left font-bold text-zinc-700 cursor-pointer select-none hover:bg-zinc-300"
                        onClick={() => toggleSort('nama')}
                      >
                        <div className="flex items-center gap-1">
                          <span>AKUN</span>
                          {sortConfig.key === 'nama' ? (
                            sortConfig.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                          ) : (
                            <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-28 cursor-pointer select-none hover:bg-zinc-300"
                        onClick={() => toggleSort('tanggal')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>TANGGAL</span>
                          {sortConfig.key === 'tanggal' ? (
                            sortConfig.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                          ) : (
                            <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-16 cursor-pointer select-none hover:bg-zinc-300"
                        onClick={() => toggleSort('satuan')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>SATUAN</span>
                          {sortConfig.key === 'satuan' ? (
                            sortConfig.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                          ) : (
                            <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-12 cursor-pointer select-none hover:bg-zinc-300"
                        onClick={() => toggleSort('unit')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>UNIT</span>
                          {sortConfig.key === 'unit' ? (
                            sortConfig.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                          ) : (
                            <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-right font-bold text-zinc-700 w-28 cursor-pointer select-none hover:bg-zinc-300"
                        onClick={() => toggleSort('harga')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>HARGA</span>
                          {sortConfig.key === 'harga' ? (
                            sortConfig.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                          ) : (
                            <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-right font-bold text-zinc-700 w-28 cursor-pointer select-none hover:bg-zinc-300"
                        onClick={() => toggleSort('jumlah')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>JUMLAH</span>
                          {sortConfig.key === 'jumlah' ? (
                            sortConfig.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                          ) : (
                            <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-12 cursor-pointer select-none hover:bg-zinc-300"
                        onClick={() => toggleSort('kode')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>KODE</span>
                          {sortConfig.key === 'kode' ? (
                            sortConfig.asc ? <ArrowUp className="size-3 text-teal-600" /> : <ArrowDown className="size-3 text-teal-600" />
                          ) : (
                            <ArrowUpDown className="size-3 text-zinc-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th className="border border-zinc-400 bg-zinc-200 px-3 py-2 text-center font-bold text-zinc-700 w-20">AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedItems(kat.items).map((r, itemIdx) => (
                      <tr key={r.id}>
                        <td className="border border-zinc-400 px-3 py-1.5 text-center tabular-nums text-zinc-700">{itemIdx + 1}</td>
                        <td className="border border-zinc-400 px-3 py-1.5 text-zinc-700">{r.nama_item}</td>
                        <td className="border border-zinc-400 px-3 py-1.5 text-center whitespace-nowrap text-zinc-600">
                          {r.tanggal
                            ? new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '-'}
                        </td>
                        <td className="border border-zinc-400 px-3 py-1.5 text-center text-zinc-700">{r.satuan}</td>
                        <td className="border border-zinc-400 px-3 py-1.5 text-center tabular-nums text-zinc-700">{Number(r.qty)}</td>
                        <td className="border border-zinc-400 px-3 py-1.5 text-right tabular-nums text-zinc-700">{rpShort(Number(r.harga_satuan))}</td>
                        <td className="border border-zinc-400 px-3 py-1.5 text-right tabular-nums text-zinc-700">{rpShort(Number(r.jumlah))}</td>
                        <td className="border border-zinc-400 px-3 py-1.5 text-center font-mono text-zinc-700">{r.kode}</td>
                        <td className="border border-zinc-400 px-3 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <button onClick={() => openEditItem(kat.id, r, katIdx)} className="rounded p-1 text-zinc-400 hover:bg-blue-100 hover:text-blue-600">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => handleDeleteItem(r.id)} className="rounded p-1 text-zinc-400 hover:bg-red-100 hover:text-red-600">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-orange-50/60 font-bold">
                      <td colSpan={6} className="border border-zinc-400 px-3 py-2 text-right text-orange-800">Total {kat.nama_kategori}</td>
                      <td className="border border-zinc-400 px-3 py-2 text-right tabular-nums text-orange-700">{rp(totalKat)}</td>
                      <td className="border border-zinc-400 px-3 py-2"></td>
                      <td className="border border-zinc-400 px-3 py-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })}

          {kategori.length > 0 && (
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="border-2 border-zinc-500 bg-zinc-100/80 px-4 py-2.5 text-sm font-bold text-zinc-800">TOTAL PENGELUARAN</td>
                  <td className="border-2 border-zinc-500 bg-zinc-100/80 px-4 py-2.5 text-right text-base font-bold tabular-nums text-orange-700 w-48">{rp(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Modal Tambah/Edit Kategori */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowCatModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-800">{editingCatId ? 'Edit Kategori' : 'Tambah Kategori'}</h2>
              <button onClick={() => setShowCatModal(false)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Nama Kategori</label>
                <input type="text" value={catForm.nama} onChange={(e) => setCatForm({ nama: e.target.value })} placeholder="contoh: Administrasi"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCatModal(false)}>Batal</Button>
              <Button size="sm" onClick={handleSaveCat} disabled={!catForm.nama || saving}>
                {saving ? 'Menyimpan...' : editingCatId ? 'Simpan Perubahan' : 'Tambah Kategori'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Item */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowItemModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-800">{editingItemId ? 'Edit Item' : 'Tambah Item'}</h2>
              <button onClick={() => setShowItemModal(false)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Kategori</label>
                <select value={itemTargetCatId} onChange={(e) => setItemTargetCatId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20">
                  {kategori.map((k, i) => (
                    <option key={k.id} value={k.id}>{k.nama_kategori}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Kode</label>
                  <input type="text" value={itemForm.kode} onChange={(e) => setItemForm({ ...itemForm, kode: e.target.value })} placeholder="B1"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
                  <p className="mt-1 text-[11px] text-zinc-500">Item dalam nota yang sama menggunakan kode yang sama.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Tanggal</label>
                  <input type="date" value={itemForm.tanggal} onChange={(e) => setItemForm({ ...itemForm, tanggal: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Nama Item</label>
                <input type="text" value={itemForm.nama} onChange={(e) => setItemForm({ ...itemForm, nama: e.target.value })} placeholder="contoh: Servo Motor"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Satuan</label>
                  <select value={itemForm.satuan} onChange={(e) => setItemForm({ ...itemForm, satuan: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20">
                    <option value="Kali">Kali</option>
                    <option value="Buah">Buah</option>
                    <option value="Paket">Paket</option>
                    <option value="Unit">Unit</option>
                    <option value="Liter">Liter</option>
                    <option value="Meter">Meter</option>
                    <option value="Set">Set</option>
                    <option value="Botol">Botol</option>
                    <option value="Malam">Malam</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Unit</label>
                  <input type="number" min={1} value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Harga Satuan</label>
                  <input type="number" min={0} value={itemForm.harga || ''} onChange={(e) => setItemForm({ ...itemForm, harga: Number(e.target.value) })} placeholder="0"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">Jumlah</span>
                  <span className="font-semibold tabular-nums text-orange-600">{rp(itemForm.unit * itemForm.harga)}</span>
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
              <Button variant="outline" size="sm" onClick={() => setShowItemModal(false)}>Batal</Button>
              <Button size="sm" onClick={handleSaveItem} disabled={!itemForm.nama || !itemForm.tanggal || saving}>
                {saving ? 'Menyimpan...' : editingItemId ? 'Simpan Perubahan' : 'Tambah Item'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
