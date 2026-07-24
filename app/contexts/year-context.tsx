'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import type { Database } from '@/app/lib/supabase/database.types'

type Periode = Database['public']['Tables']['periode_anggaran']['Row']

type YearContextType = {
  selectedYear: number | null
  setSelectedYear: (year: number | null) => void
  periodeId: string | null
  selectedPeriode: Periode | null
  availableYears: Periode[]
  loading: boolean
  createPeriode: (tahun: string, namaOrganisasi: string) => Promise<void>
  refreshPeriode: () => Promise<void>
}

const YearContext = createContext<YearContextType | null>(null)

export function YearProvider({ children }: { children: ReactNode }) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [periodeId, setPeriodeId] = useState<string | null>(null)
  const [selectedPeriode, setSelectedPeriode] = useState<Periode | null>(null)
  const [availableYears, setAvailableYears] = useState<Periode[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchPeriode = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('periode_anggaran')
      .select('*')
      .order('tahun', { ascending: false })

    if (data) {
      setAvailableYears(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchPeriode()
  }, [])

  useEffect(() => {
    if (selectedYear && availableYears.length > 0) {
      const match = availableYears.find((p) => p.tahun === String(selectedYear))
      if (match) {
        setPeriodeId(match.id)
        setSelectedPeriode(match)
      } else {
        setPeriodeId(null)
        setSelectedPeriode(null)
      }
    } else {
      setPeriodeId(null)
      setSelectedPeriode(null)
    }
  }, [selectedYear, availableYears])

  const createPeriode = async (tahun: string, namaOrganisasi: string) => {
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('periode_anggaran').insert({
      tahun,
      nama_organisasi: namaOrganisasi,
      dibuat_oleh: user?.id || null,
      status: 'Draft',
    })

    if (error) throw error

    await fetchPeriode()
  }

  const refreshPeriode = async () => {
    await fetchPeriode()
  }

  return (
    <YearContext.Provider
      value={{
        selectedYear,
        setSelectedYear,
        periodeId,
        selectedPeriode,
        availableYears,
        loading,
        createPeriode,
        refreshPeriode,
      }}
    >
      {children}
    </YearContext.Provider>
  )
}

export function useYear() {
  const ctx = useContext(YearContext)
  if (!ctx) throw new Error('useYear must be used within YearProvider')
  return ctx
}
