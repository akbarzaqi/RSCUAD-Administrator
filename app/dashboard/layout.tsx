import { createClient } from '@/app/lib/supabase/server'
import { redirect } from 'next/navigation'
import { YearProvider } from '@/app/contexts/year-context'
import Sidebar from './sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    redirect('/login')
  }

  return (
    <YearProvider>
      <div className="flex h-full flex-1">
        <Sidebar email={data.user.email ?? ''} />
        <main className="flex-1 overflow-auto bg-white">
          {children}
        </main>
      </div>
    </YearProvider>
  )
}