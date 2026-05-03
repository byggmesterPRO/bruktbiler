import { useEffect, useState } from 'react'
import { api, formatNok, formatKm } from '../api'
import { getToken } from '../auth'

type Car = {
    id: number; make: string; model: string; year: number; price: number;
    mileage: number; image: string; status: string; listingType: string;
    sellerTlfnr?: string | null;
}

const PLACEHOLDER = 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=900'

const TYPE_LABEL: Record<string, string> = {
    dealership: 'Forhandler',
    consignment_in_shop: 'Konsignasjon',
    consignment_remote: 'Privat (visning)',
    private: 'Privat',
}

export default function Cars({ onOpen }: { onOpen: (id: number) => void }) {
    const [cars, setCars] = useState<Car[] | null>(null)
    const [filter, setFilter] = useState<'all' | 'auction' | 'private'>('all')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        api<Car[]>('listCars', { token: getToken() }).then((res) => {
            if (res.ok) setCars(res.data)
            else setError(res.error)
        })
    }, [])

    if (error) return <div className="error-banner">{error}</div>
    if (!cars) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

    const filtered = cars.filter((c) => {
        if (filter === 'auction') return c.status === 'auction'
        if (filter === 'private') return c.listingType === 'private' || c.listingType === 'consignment_remote'
        return true
    })

    return (
        <div>
            <div className="tabs">
                <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Alle</button>
                <button className={filter === 'auction' ? 'active' : ''} onClick={() => setFilter('auction')}>Auksjon</button>
                <button className={filter === 'private' ? 'active' : ''} onClick={() => setFilter('private')}>Privat</button>
            </div>

            {filtered.length === 0 && <div className="empty">Ingen biler matcher.</div>}

            <div className="car-grid">
                {filtered.map((c) => (
                    <div key={c.id} className="card car-card" onClick={() => onOpen(c.id)} role="button">
                        <img className="car-card-img" src={c.image || PLACEHOLDER}
                            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER }} alt="" />
                        <div className="car-card-body">
                            <div className="car-card-row">
                                <span className={
                                    c.status === 'auction' ? 'tag tag-blue' :
                                    c.listingType === 'private' ? 'tag tag-grey' : 'tag'
                                }>{c.status === 'auction' ? 'Auksjon' : TYPE_LABEL[c.listingType] || 'Bil'}</span>
                                <span className="muted" style={{ fontSize: '0.7rem' }}>{c.year}</span>
                            </div>
                            <h3 className="car-card-title">{c.make} {c.model}</h3>
                            <div className="car-card-meta">{formatKm(c.mileage)}</div>
                            <div className="car-card-row">
                                <span className="car-card-price">{formatNok(c.price)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
