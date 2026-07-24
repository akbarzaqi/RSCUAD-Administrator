'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/server'

export type AuthState = {
  error?: string
} | undefined

export async function login(prevState: AuthState, formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(prevState: AuthState, formData: FormData) {
  const supabase = await createClient()

  const nama = formData.get('full_name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: nama } },
  })

  if (error) {
    return { error: error.message }
  }

  const userId = authData.user?.id
  if (userId) {
    const { error: insertError } = await supabase.from('users').insert({
      id: userId,
      nama,
      email,
      role: 'admin',
    })

    if (insertError) {
      return { error: insertError.message }
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/login')
}