import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'

type Item = {
    id: number; message: string; created_at: string;
    car_id: number; make: string; model: string; year: number; price: number;
    image: string; status: string;
}

export default function MyInterests({ onOpen }: { onOpen: (id: number) => void }) {
    const [items, setItems] = useState<Item[] | null>(null)

    useEffect(() => {
        api<Item[]>('listMyInterests', { token: getToken() }).then((res) => {
            if (res.ok) setItems(res.data)
            else setItems([])
        })
    }, [])

    if (!items) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
    if (items.length === 0) return <div className="empty">Du har ikke registrert interesse pa noen biler enda.</div>

    return (
        <div>
            <h2 className="section-title" style={{ marginTop: 0 }}>Mine interesser</h2>
            {items.map((i) => (
                <div key={i.id} className="card list-row" onClick={() => onOpen(i.car_id)} role="button"
                    style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0, marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', gap: '0.7rem', padding: '0.6rem' }}>
                        {i.image && <img src={i.image} style={{ width: 70, height: 50, objectFit: 'cover', borderRadius: 6 }} alt="" />}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{i.make} {i.model} ({i.year})</div>
                            <div className="muted" style={{ fontSize: '0.75rem' }}>{formatNok(i.price)}</div>
                            {i.message && <div style={{ fontSize: '0.78rem', marginTop: 4, color: 'var(--text-dim)' }}>"{i.message}"</div>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
