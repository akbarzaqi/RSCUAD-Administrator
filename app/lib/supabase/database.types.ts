export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          nama: string
          email: string
          role: string
        }
        Insert: {
          id: string
          nama: string
          email: string
          role?: string
        }
        Update: {
          id?: string
          nama?: string
          email?: string
          role?: string
        }
      }
      periode_anggaran: {
        Row: {
          id: string
          dibuat_oleh: string | null
          tahun: string
          nama_organisasi: string
          kop_surat: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          dibuat_oleh?: string | null
          tahun: string
          nama_organisasi: string
          kop_surat?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          dibuat_oleh?: string | null
          tahun?: string
          nama_organisasi?: string
          kop_surat?: string | null
          status?: string
          created_at?: string
        }
      }
      pemasukan: {
        Row: {
          id: string
          periode_id: string
          kode: string | null
          nama_akun: string
          satuan: string | null
          qty: number
          harga_satuan: number
          jumlah: number
          bukti_url: string | null
          tanggal: string | null
        }
        Insert: {
          id?: string
          periode_id: string
          kode?: string | null
          nama_akun: string
          satuan?: string | null
          qty?: number
          harga_satuan?: number
          jumlah?: number
          bukti_url?: string | null
          tanggal?: string | null
        }
        Update: {
          id?: string
          periode_id?: string
          kode?: string | null
          nama_akun?: string
          satuan?: string | null
          qty?: number
          harga_satuan?: number
          jumlah?: number
          bukti_url?: string | null
          tanggal?: string | null
        }
      }
      kategori_pengeluaran: {
        Row: {
          id: string
          periode_id: string
          nama_kategori: string
          urutan: number
        }
        Insert: {
          id?: string
          periode_id: string
          nama_kategori: string
          urutan?: number
        }
        Update: {
          id?: string
          periode_id?: string
          nama_kategori?: string
          urutan?: number
        }
      }
      pengeluaran: {
        Row: {
          id: string
          kategori_id: string
          kode: string | null
          nama_item: string
          satuan: string | null
          qty: number
          harga_satuan: number
          jumlah: number
          bukti_url: string | null
        }
        Insert: {
          id?: string
          kategori_id: string
          kode?: string | null
          nama_item: string
          satuan?: string | null
          qty?: number
          harga_satuan?: number
          jumlah?: number
          bukti_url?: string | null
        }
        Update: {
          id?: string
          kategori_id?: string
          kode?: string | null
          nama_item?: string
          satuan?: string | null
          qty?: number
          harga_satuan?: number
          jumlah?: number
          bukti_url?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
