import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'

type Car = { id: number; make: string; model: string; year: number; price: number; image: string; status: string }

export default function Wishlist({ onOpen }: { onOpen: (id: number) => void }) {
    const [cars, setCars] = useState<Car[] | null>(null)

    useEffect(() => {
        api<Car[]>('listWishlist', { token: getToken() }).then((res) => {
            if (res.ok) setCars(res.data)
        })
    }, [])

    if (!cars) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
    if (cars.length === 0) return <div className="empty">Ingen biler i ønskelisten enda. Klikk stjernen pa en bil for å lagre den.</div>

    return (
        <div>
            {cars.map((c) => (
                <div key={c.id} className="card list-row" onClick={() => onOpen(c.id)} role="button"
                    style={{ marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flex: 1 }}>
                        {c.image && <img src={c.image} style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 6 }} alt="" />}
                        <div>
                            <div style={{ fontWeight: 500 }}>{c.make} {c.model}</div>
                            <div className="meta">{c.year} · {formatNok(c.price)}</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
