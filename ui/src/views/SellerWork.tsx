import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken, useAuth } from '../auth'

type SellReq = {
    id: number; user_id: number; owner_tlfnr: string; make: string; model: string; year: number;
    expected_price: number; mileage: number; image: string; description: string;
    listing_type: string; status: string; assigned_seller_id: number | null;
}

export default function SellerWork() {
    const { me } = useAuth()
    const [items, setItems] = useState<SellReq[]>([])
    const [active, setActive] = useState<SellReq | null>(null)
    const [commission, setCommission] = useState('8')
    const [msg, setMsg] = useState<string | null>(null)
    const [completing, setCompleting] = useState<number | null>(null)
    const [buyerTlfnr, setBuyerTlfnr] = useState('')
    const [salePrice, setSalePrice] = useState('')

    const load = () =>
        api<SellReq[]>('listOpenSellRequests', { token: getToken() }).then((res) => {
            if (res.ok) setItems(res.data)
        })
    useEffect(() => { load() }, [])

    const claim = async (id: number) => {
        const res = await api('claimSellRequest', { token: getToken(), requestId: id })
        if (res.ok) { setMsg('Tatt'); await load() }
        else setMsg(res.error)
        setTimeout(() => setMsg(null), 1800)
    }
    const promote = async () => {
        if (!active) return
        const res = await api('promoteSellRequestToListing', {
            token: getToken(), requestId: active.id, commissionPct: parseInt(commission, 10) || 8,
        })
        if (res.ok) { setMsg('Lagt ut for salg'); setActive(null); await load() }
        else setMsg(res.error)
        setTimeout(() => setMsg(null), 1800)
    }
    const complete = async (carId: number) => {
        const res = await api<{ commission: number; transferFee: number }>('completeSale', {
            token: getToken(), carId, buyerTlfnr, salePrice: parseInt(salePrice, 10),
        })
        if (res.ok) {
            setMsg(`Salg fullfort! Provisjon ${formatNok(res.data.commission)}, gebyr ${formatNok(res.data.transferFee)}`)
            setCompleting(null); setBuyerTlfnr(''); setSalePrice('')
        } else setMsg(res.error)
        setTimeout(() => setMsg(null), 3500)
    }

    if (active) {
        return (
            <div>
                <button className="btn btn-ghost" onClick={() => setActive(null)} style={{ padding: '0.4rem 0.7rem' }}>← Tilbake</button>
                <h3 className="section-title">{active.make} {active.model} ({active.year})</h3>
                {active.image && <img src={active.image} style={{ width: '100%', borderRadius: 12, marginBottom: 8 }} alt="" />}
                <p className="muted" style={{ fontSize: '0.78rem' }}>
                    Eier: {active.owner_tlfnr} · {formatNok(active.expected_price)} · {active.mileage.toLocaleString('no-NO')} km
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{active.description}</p>

                <label className="label">Provisjon (%)</label>
                <input className="input" inputMode="numeric" value={commission} onChange={(e) => setCommission(e.target.value)} />
                <div style={{ height: 10 }} />
                <button className="btn btn-gold btn-block" onClick={promote}>Legg ut for salg</button>
                {msg && <div className="success-banner">{msg}</div>}
            </div>
        )
    }

    return (
        <div>
            <h2 className="section-title" style={{ marginTop: 0 }}>Selger-arbeidsflate</h2>
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 0 }}>
                Innkomne salgsforespørsler {me?.officeId ? '· du er pa kontor #' + me.officeId : ''}
            </p>
            {msg && <div className="success-banner">{msg}</div>}

            <h3 className="section-title">Apne forespørsler</h3>
            {items.length === 0 && <div className="empty">Ingen ledige forespørsler.</div>}
            {items.map((r) => (
                <div key={r.id} className="card" style={{ padding: '0.7rem 0.8rem', marginBottom: '0.5rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontWeight: 500 }}>{r.make} {r.model} ({r.year})</div>
                            <div className="meta">
                                {r.owner_tlfnr} · {formatNok(r.expected_price)}
                            </div>
                        </div>
                        <span className={'tag ' + (r.status === 'pending' ? 'tag-grey' : 'tag-blue')}>
                            {r.status === 'pending' ? 'Apen' : 'Tildelt'}
                        </span>
                    </div>
                    <div className="row" style={{ marginTop: '0.5rem', gap: '0.4rem' }}>
                        {r.status === 'pending' && (
                            <button className="btn btn-gold" style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                                onClick={() => claim(r.id)}>Ta foresporselen</button>
                        )}
                        {r.assigned_seller_id === me?.id && (
                            <button className="btn btn-ghost" style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                                onClick={() => setActive(r)}>Apne</button>
                        )}
                    </div>
                </div>
            ))}

            <h3 className="section-title">Fullfor salg</h3>
            <p className="muted" style={{ fontSize: '0.78rem' }}>
                Skriv inn bil-ID og kjopers tlfnr for a registrere et salg.
            </p>
            {completing !== null ? (
                <div className="card" style={{ padding: '0.8rem' }}>
                    <label className="label">Kjopers tlfnr</label>
                    <input className="input" value={buyerTlfnr} onChange={(e) => setBuyerTlfnr(e.target.value)} />
                    <label className="label">Salgssum (kr)</label>
                    <input className="input" inputMode="numeric" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
                    <div style={{ height: 8 }} />
                    <div className="row">
                        <button className="btn btn-gold" style={{ flex: 1 }} onClick={() => complete(completing)}>Bekreft salg</button>
                        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setCompleting(null)}>Avbryt</button>
                    </div>
                </div>
            ) : (
                <input className="input" placeholder="Bil-ID" inputMode="numeric"
                    onKeyDown={(e) => { if (e.key === 'Enter') setCompleting(parseInt((e.target as HTMLInputElement).value, 10)) }} />
            )}
        </div>
    )
}
