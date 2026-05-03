import { useState } from 'react'

type Props = {
    onLogin: (tlfnr: string, password: string) => Promise<{ ok: boolean; error?: string }>
    onRegister: (tlfnr: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>
}

export default function Auth({ onLogin, onRegister }: Props) {
    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [tlfnr, setTlfnr] = useState('')
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const submit = async () => {
        setError(null); setLoading(true)
        const res = mode === 'login'
            ? await onLogin(tlfnr.trim(), password)
            : await onRegister(tlfnr.trim(), password, name.trim())
        setLoading(false)
        if (!res.ok) setError(res.error || 'Noe gikk galt')
    }

    return (
        <div className="auth-wrap">
            <div className="auth-hero">
                <h1>Bruktbiler</h1>
                <p>Premium kjop og salg.</p>
            </div>

            <div className="tab-switch">
                <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Logg inn</button>
                <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Registrer</button>
            </div>

            {mode === 'register' && (
                <>
                    <label className="label">Fullt navn</label>
                    <input className="input" placeholder="Ola Nordmann" value={name}
                        onChange={(e) => setName(e.target.value)} />
                </>
            )}
            <label className="label">Telefonnummer</label>
            <input className="input" inputMode="numeric" placeholder="f.eks. 12345678" value={tlfnr}
                onChange={(e) => setTlfnr(e.target.value)} />

            <label className="label">Passord</label>
            <input className="input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} />

            {error && <div className="error-banner">{error}</div>}

            <div style={{ height: 14 }} />
            <button className="btn btn-gold btn-block" onClick={submit} disabled={loading}>
                {loading ? '...' : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
            </button>

            <p className="muted" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem' }}>
                {mode === 'login'
                    ? 'Ny her? Bytt til Registrer for a opprette konto.'
                    : 'Telefonnummer brukes som brukernavn.'}
            </p>
        </div>
    )
}
