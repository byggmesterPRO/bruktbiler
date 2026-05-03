import { useEffect, useState } from 'react'
import { api } from '../api'
import { getToken } from '../auth'

type Office = { id: number; name: string }

const FILTERS = [
    { value: 'all', label: 'Alle brukere' },
    { value: 'sellers', label: 'Alle selgere' },
    { value: 'office', label: 'Et bestemt kontor' },
    { value: 'interested', label: 'Alle med registrert interesse' },
]

export default function Broadcast() {
    const [filter, setFilter] = useState('all')
    const [officeId, setOfficeId] = useState<number | ''>('')
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [offices, setOffices] = useState<Office[]>([])
    const [msg, setMsg] = useState<string | null>(null)

    useEffect(() => {
        api<Office[]>('listOffices', { token: getToken() }).then((res) => {
            if (res.ok) setOffices(res.data)
        })
    }, [])

    const send = async () => {
        if (!title.trim()) { setMsg('Tittel pakrevd'); return }
        const res = await api<{ sent: number }>('adminBroadcast', {
            token: getToken(), filter, officeId: officeId || null, title, body,
        })
        if (res.ok) {
            setMsg(`Sendt til ${res.data.sent} brukere`)
            setTitle(''); setBody('')
        } else setMsg(res.error)
        setTimeout(() => setMsg(null), 2500)
    }

    return (
        <div>
            <h2 className="section-title" style={{ marginTop: 0 }}>Send kunngjoring</h2>
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 0 }}>
                Genererer push-varsel + innboks-melding til mottakerne.
            </p>

            <label className="label">Mottakere</label>
            <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
                {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>

            {filter === 'office' && (
                <>
                    <label className="label">Velg kontor</label>
                    <select className="input" value={officeId} onChange={(e) => setOfficeId(parseInt(e.target.value, 10) || '')}>
                        <option value="">Velg...</option>
                        {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                </>
            )}

            <label className="label">Tittel</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />

            <label className="label">Tekst</label>
            <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />

            {msg && <div className="success-banner">{msg}</div>}

            <div style={{ height: 12 }} />
            <button className="btn btn-gold btn-block" onClick={send}>Send</button>
        </div>
    )
}
