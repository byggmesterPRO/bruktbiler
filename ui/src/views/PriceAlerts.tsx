import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'

type Alert = {
    id: number; make: string | null; model: string | null;
    max_price: number | null; min_year: number | null; max_km: number | null;
    active: number; created_at: string;
}

export default function PriceAlerts() {
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [adding, setAdding] = useState(false)
    const [make, setMake] = useState(''); const [model, setModel] = useState('')
    const [maxPrice, setMaxPrice] = useState(''); const [minYear, setMinYear] = useState('')
    const [maxKm, setMaxKm] = useState('')
    const [msg, setMsg] = useState<string | null>(null)

    const load = () =>
        api<Alert[]>('listPriceAlerts', { token: getToken() }).then((res) => {
            if (res.ok) setAlerts(res.data)
        })
    useEffect(() => { load() }, [])

    const create = async () => {
        const res = await api('createPriceAlert', {
            token: getToken(), make, model,
            maxPrice: parseInt(maxPrice, 10) || undefined,
            minYear: parseInt(minYear, 10) || undefined,
            maxKm: parseInt(maxKm, 10) || undefined,
        })
        if (res.ok) {
            setMake(''); setModel(''); setMaxPrice(''); setMinYear(''); setMaxKm('')
            setAdding(false); setMsg('Lagt til')
            await load()
        } else setMsg(res.error)
        setTimeout(() => setMsg(null), 1500)
    }
    const del = async (id: number) => {
        await api('deletePriceAlert', { token: getToken(), id }); await load()
    }

    return (
        <div>
            <button className="btn btn-gold btn-block" onClick={() => setAdding(!adding)}>
                {adding ? 'Avbryt' : '+ Nytt prisvarsel'}
            </button>
            {msg && <div className="success-banner">{msg}</div>}
            {adding && (
                <div className="card" style={{ padding: '0.7rem', marginTop: '0.6rem' }}>
                    <p className="muted" style={{ fontSize: '0.78rem', marginTop: 0 }}>
                        Tomme felt = matche alle. Du varsles om biler som matcher kriteriene.
                    </p>
                    <div className="row">
                        <div style={{ flex: 1 }}>
                            <label className="label">Merke</label>
                            <input className="input" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Audi" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="label">Modell</label>
                            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="RS6" />
                        </div>
                    </div>
                    <label className="label">Maks pris (kr)</label>
                    <input className="input" inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                    <div className="row">
                        <div style={{ flex: 1 }}>
                            <label className="label">Min ar</label>
                            <input className="input" inputMode="numeric" value={minYear} onChange={(e) => setMinYear(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="label">Maks km</label>
                            <input className="input" inputMode="numeric" value={maxKm} onChange={(e) => setMaxKm(e.target.value)} />
                        </div>
                    </div>
                    <div style={{ height: 8 }} />
                    <button className="btn btn-gold btn-block" onClick={create}>Lagre varsel</button>
                </div>
            )}

            <h3 className="section-title">Mine varsler</h3>
            {alerts.length === 0 && <div className="empty">Ingen varsler enda.</div>}
            {alerts.map((a) => (
                <div key={a.id} className="card" style={{ padding: '0.6rem 0.8rem', marginBottom: '0.4rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 500 }}>
                            {a.make || 'Alle merker'} {a.model || ''}
                        </div>
                        <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                            onClick={() => del(a.id)}>Slett</button>
                    </div>
                    <div className="meta" style={{ fontSize: '0.74rem' }}>
                        {a.max_price ? `Maks ${formatNok(a.max_price)}` : 'Ingen pris-grense'}
                        {a.min_year && ` · Fra ${a.min_year}`}
                        {a.max_km && ` · Maks ${a.max_km.toLocaleString('no-NO')} km`}
                    </div>
                </div>
            ))}
        </div>
    )
}
