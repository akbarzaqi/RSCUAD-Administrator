'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useYear } from '@/app/contexts/year-context'
import { logout } from '@/app/actions/auth'
import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  FileText,
  History,
  LogOut,
  Lock,
} from 'lucide-react'

const menuItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Pemasukan', href: '/dashboard/pemasukan', icon: ArrowUpRight },
  { label: 'Pengeluaran', href: '/dashboard/pengeluaran', icon: ArrowDownRight },
  { label: 'Bukti Nota', href: '/dashboard/bukti-nota', icon: Receipt },
  { label: 'Laporan', href: '/dashboard/laporan', icon: FileText },
  { label: 'Riwayat', href: '/dashboard/riwayat', icon: History },
]

export default function Sidebar({ email }: { email: string }) {
  const { selectedYear } = useYear()
  const pathname = usePathname()
  const locked = selectedYear === null

  return (
    <aside className="flex w-56 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-5">
        <span className="text-base font-semibold tracking-tight">RSCUAD</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          const disabled = locked && item.href !== '/dashboard' && item.href !== '/dashboard/riwayat'

          if (disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-300 cursor-not-allowed select-none"
                title="Pilih periode tahun terlebih dahulu"
              >
                <Icon className="size-4" />
                {item.label}
                <Lock className="ml-auto size-3 text-zinc-300" />
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-emerald-50 font-medium text-emerald-700'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t px-4 py-3">
        <p className="mb-2 truncate text-xs text-zinc-500">{email}</p>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-2 text-xs font-medium text-red-600 transition-colors hover:text-red-700"
          >
            <LogOut className="size-3.5" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
