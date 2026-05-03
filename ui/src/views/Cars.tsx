import { useEffect, useMemo, useState } from 'react'
import { api, formatNok, formatKm } from '../api'
import { getToken } from '../auth'
import { IconSearch, IconClose } from '../components/Icon'

type Car = {
    id: number; make: string; model: string; year: number; price: number;
    mileage: number; image: string; status: string; listingType: string;
    assignedOfficeName?: string | null;
    assignedSellerTlfnr?: string | null;
}

const PLACEHOLDER = 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=900'
const TYPE_LABEL: Record<string, string> = {
    dealership: 'Forhandler',
    consignment_in_shop: 'Konsignasjon',
    consignment_remote: 'Privat (visning)',
    private: 'Privat',
}

const GRID_KEY = 'bb_grid'

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
    const [grid, setGrid] = useState<1 | 2>(() => {
        try { return localStorage.getItem(GRID_KEY) === '2' ? 2 : 1 } catch { return 1 }
    })

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

    const setGridMode = (g: 1 | 2) => {
        setGrid(g)
        try { localStorage.setItem(GRID_KEY, String(g)) } catch {}
    }

    const hasFilters = !!(minPrice || maxPrice || minYear || maxKm || listingType || onlyAuction)

    if (error) return <div className="error-banner">{error}</div>

    return (
        <div>
            <div className="search-bar">
                <IconSearch />
                <input className="search-input" placeholder="Sok merke, modell..."
                    value={q} onChange={(e) => setQ(e.target.value)} />
                <button className="filter-btn" onClick={() => setShowFilter(true)}>
                    Filter{hasFilters && <span style={{ color: 'var(--gold)', marginLeft: 4 }}>•</span>}
                </button>
            </div>

            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', margin: '0 0 0.5rem' }}>
                <span className="muted" style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {cars ? `${cars.length} biler` : 'Laster...'}
                </span>
                <div className="grid-toggle">
                    <button className={grid === 1 ? 'active' : ''} onClick={() => setGridMode(1)} title="Liste">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <rect x="2" y="3" width="12" height="2.5" rx="1" />
                            <rect x="2" y="7" width="12" height="2.5" rx="1" />
                            <rect x="2" y="11" width="12" height="2.5" rx="1" />
                        </svg>
                    </button>
                    <button className={grid === 2 ? 'active' : ''} onClick={() => setGridMode(2)} title="Rutenett">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <rect x="2" y="2" width="5" height="5" rx="1" />
                            <rect x="9" y="2" width="5" height="5" rx="1" />
                            <rect x="2" y="9" width="5" height="5" rx="1" />
                            <rect x="9" y="9" width="5" height="5" rx="1" />
                        </svg>
                    </button>
                </div>
            </div>

            {!cars && <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>}
            {cars && cars.length === 0 && <div className="empty">Ingen biler matcher.</div>}

            <div className={'car-grid' + (grid === 2 ? ' car-grid-2' : '')}>
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
                            {grid === 1 && (
                                <div className="car-card-meta">
                                    {formatKm(c.mileage)}
                                    {c.assignedOfficeName && <> · {c.assignedOfficeName}</>}
                                </div>
                            )}
                            <div className="car-card-row">
                                <span className="car-card-price">{formatNok(c.price)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showFilter && (
                <div className="modal-backdrop" onClick={() => setShowFilter(false)}>
                    <div className="filter-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <h3 className="section-title" style={{ margin: 0 }}>Filter</h3>
                            <button className="icon-btn" onClick={() => setShowFilter(false)}>
                                <IconClose width={16} height={16} />
                            </button>
                        </div>
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
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', marginTop: '0.6rem' }}>
                            <input type="checkbox" checked={onlyAuction}
                                onChange={(e) => setOnlyAuction(e.target.checked)} />
                            Bare auksjoner
                        </label>
                        <div className="row" style={{ marginTop: '0.8rem', gap: '0.4rem' }}>
                            <button className="btn btn-ghost" style={{ flex: 1 }}
                                onClick={() => { setMinPrice(''); setMaxPrice(''); setMinYear(''); setMaxKm(''); setListingType(''); setOnlyAuction(false); setSort('newest') }}>
                                Nullstill
                            </button>
                            <button className="btn btn-gold" style={{ flex: 1 }} onClick={() => setShowFilter(false)}>Bruk</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
