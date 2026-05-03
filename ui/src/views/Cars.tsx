import { useEffect, useMemo, useState } from 'react'
import { api, formatNok, formatKm } from '../api'
import { getToken } from '../auth'
import { IconSearch } from '../components/Icon'

type Car = {
    id: number; make: string; model: string; year: number; price: number;
    mileage: number; image: string; status: string; listingType: string;
    assignedOfficeName?: string | null;
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
    const [error, setError] = useState<string | null>(null)
    const [showFilter, setShowFilter] = useState(false)
    const [q, setQ] = useState('')
    const [minPrice, setMinPrice] = useState('')
    const [maxPrice, setMaxPrice] = useState('')
    const [minYear, setMinYear] = useState('')
    const [maxKm, setMaxKm] = useState('')
    const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc' | 'km_asc' | 'year_desc'>('newest')
    const [listingType, setListingType] = useState('')
    const [onlyAuction, setOnlyAuction] = useState(false)

    const filter = useMemo(() => ({
        q, minPrice, maxPrice, minYear, maxKm, sort: sort === 'newest' ? undefined : sort,
        listingType, onlyAuction,
    }), [q, minPrice, maxPrice, minYear, maxKm, sort, listingType, onlyAuction])

    useEffect(() => {
        let cancelled = false
        const t = setTimeout(() => {
            api<Car[]>('listCars', { token: getToken(), filter }).then((res) => {
                if (cancelled) return
                if (res.ok) setCars(res.data)
                else setError(res.error)
            })
        }, 200)
        return () => { cancelled = true; clearTimeout(t) }
    }, [filter])

    if (error) return <div className="error-banner">{error}</div>

    return (
        <div>
            <div className="search-bar">
                <IconSearch />
                <input className="search-input" placeholder="Sok merke, modell..."
                    value={q} onChange={(e) => setQ(e.target.value)} />
                <button className="filter-btn" onClick={() => setShowFilter((v) => !v)}>
                    Filter {(minPrice || maxPrice || minYear || maxKm || listingType || onlyAuction) ? '•' : ''}
                </button>
            </div>

            {showFilter && (
                <div className="filter-panel">
                    <div className="row">
                        <div style={{ flex: 1 }}>
                            <label className="label">Pris fra</label>
                            <input className="input" inputMode="numeric" placeholder="0"
                                value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="label">Pris til</label>
                            <input className="input" inputMode="numeric" placeholder="∞"
                                value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                        </div>
                    </div>
                    <div className="row">
                        <div style={{ flex: 1 }}>
                            <label className="label">Ar fra</label>
                            <input className="input" inputMode="numeric" placeholder="2000"
                                value={minYear} onChange={(e) => setMinYear(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="label">Maks km</label>
                            <input className="input" inputMode="numeric" placeholder="∞"
                                value={maxKm} onChange={(e) => setMaxKm(e.target.value)} />
                        </div>
                    </div>
                    <label className="label">Type</label>
                    <select className="input" value={listingType} onChange={(e) => setListingType(e.target.value)}>
                        <option value="">Alle</option>
                        <option value="dealership">Forhandler</option>
                        <option value="consignment_in_shop">Konsignasjon</option>
                        <option value="consignment_remote">Privat med visning</option>
                    </select>
                    <label className="label">Sorter</label>
                    <select className="input" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                        <option value="newest">Nyeste forst</option>
                        <option value="price_asc">Pris stigende</option>
                        <option value="price_desc">Pris synkende</option>
                        <option value="km_asc">Lavest km</option>
                        <option value="year_desc">Nyeste arsmodell</option>
                    </select>
                    <div className="row" style={{ alignItems: 'center', marginTop: '0.6rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                            <input type="checkbox" checked={onlyAuction}
                                onChange={(e) => setOnlyAuction(e.target.checked)} />
                            Bare auksjoner
                        </label>
                        <button className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '0.4rem 0.7rem' }}
                            onClick={() => { setMinPrice(''); setMaxPrice(''); setMinYear(''); setMaxKm(''); setListingType(''); setOnlyAuction(false); setSort('newest') }}>
                            Nullstill
                        </button>
                    </div>
                </div>
            )}

            {!cars && <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>}
            {cars && cars.length === 0 && <div className="empty">Ingen biler matcher.</div>}

            <div className="car-grid">
                {(cars || []).map((c) => (
                    <div key={c.id} className="card car-card" onClick={() => onOpen(c.id)} role="button">
                        <img className="car-card-img" src={c.image || PLACEHOLDER}
                            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER }} alt="" />
                        <div className="car-card-body">
                            <div className="car-card-row">
                                <span className={c.status === 'auction' ? 'tag tag-blue' : 'tag'}>
                                    {c.status === 'auction' ? 'Auksjon' : TYPE_LABEL[c.listingType] || 'Bil'}
                                </span>
                                <span className="muted" style={{ fontSize: '0.7rem' }}>{c.year}</span>
                            </div>
                            <h3 className="car-card-title">{c.make} {c.model}</h3>
                            <div className="car-card-meta">
                                {formatKm(c.mileage)}
                                {c.assignedOfficeName && <> · {c.assignedOfficeName}</>}
                            </div>
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
