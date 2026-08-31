'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearLocalMode, enableLocalMode } from '@/lib/auth-mode'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const client = getSupabaseBrowserClient()
    if (!client) {
      router.replace('/')
      return
    }
    let active = true
    client.auth.getSession().then(({ data }) => {
      if (!active) return
      if (data.session?.user) router.replace('/')
      else setChecking(false)
    })
    return () => {
      active = false
    }
  }, [router])

  async function submit(mode: 'signin' | 'signup') {
    const client = getSupabaseBrowserClient()
    if (!client) return continueLocally()
    setBusy(true)
    setMessage(null)
    const result =
      mode === 'signin'
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password })
    if (result.error) {
      setBusy(false)
      setMessage(result.error.message)
      return
    }
    if (!result.data.session) {
      setBusy(false)
      setMessage('Check your email, then come back and sign in.')
      return
    }
    clearLocalMode()
    router.replace('/')
  }

  function continueLocally() {
    enableLocalMode()
    router.replace('/')
  }

  if (checking) {
    return (
      <main className="center-page">
        <div className="loader" />
        <p>Checking your session…</p>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Workout log</h1>
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void submit('signin') }}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
          <button className="primary-button" type="submit" disabled={busy || !email || password.length < 6}>Sign in</button>
          <button className="secondary-button" type="button" disabled={busy || !email || password.length < 6} onClick={() => submit('signup')}>Create account</button>
        </form>
        <button className="text-button" onClick={continueLocally}>Try it locally first</button>
        {message && <p className="form-message">{message}</p>}
      </section>
    </main>
  )
}
