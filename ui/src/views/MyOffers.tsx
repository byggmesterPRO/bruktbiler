import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'

type Offer = {
    id: number; car_id: number; amount: number; message: string; status: string;
    created_at: string; parent_offer_id: number | null;
    make: string; model: string; year: number; image: string; price: number;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Venter', cls: 'tag-grey' },
    accepted: { label: 'Godtatt', cls: 'tag-green' },
    rejected: { label: 'Avvist', cls: 'tag-red' },
    countered: { label: 'Mottilbud', cls: 'tag-blue' },
    expired: { label: 'Utlopt', cls: 'tag' },
}

export default function MyOffers({ onOpen }: { onOpen: (id: number) => void }) {
    const [offers, setOffers] = useState<Offer[] | null>(null)

    useEffect(() => {
        api<Offer[]>('listMyOffers', { token: getToken() }).then((res) => {
            if (res.ok) setOffers(res.data)
        })
    }, [])

    if (!offers) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
    if (offers.length === 0) return <div className="empty">Du har ikke sendt noen tilbud enda.</div>

    return (
        <div>
            {offers.map((o) => {
                const s = STATUS_LABEL[o.status] || { label: o.status, cls: 'tag-grey' }
                return (
                    <div key={o.id} className="card" style={{ padding: '0.7rem 0.8rem', marginBottom: '0.5rem', cursor: 'pointer' }}
                        onClick={() => onOpen(o.car_id)}>
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <div style={{ fontWeight: 500 }}>{o.make} {o.model} ({o.year})</div>
                            <span className={'tag ' + s.cls}>{s.label}</span>
                        </div>
                        <div className="meta" style={{ fontSize: '0.74rem' }}>
                            Mitt tilbud: <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{formatNok(o.amount)}</span>
                            {o.price && o.amount < o.price && <> · {Math.round((1 - o.amount / o.price) * 100)}% under utropt</>}
                        </div>
                        {o.message && <div style={{ fontSize: '0.78rem', marginTop: 4, color: 'var(--text-dim)' }}>"{o.message}"</div>}
                    </div>
                )
            })}
        </div>
    )
}
