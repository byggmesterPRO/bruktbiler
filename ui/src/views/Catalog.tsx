import { useEffect, useMemo, useState } from 'react'
import { api, formatNok, formatKm } from '../api'
import { getToken } from '../auth'
import { IconBack, IconSearch } from '../components/Icon'

type Model = {
    id: number; firma: string; make: string; model: string; variant: string | null;
    new_price: number; image: string; description: string;
    used_count: number; lowest_used_price: number | null;
}

type Firma = { firma: string; model_count: number }

type Used = {
    id: number; make: string; model: string; year: number; price: number;
    mileage: number; image: string; status: string; original_price: number | null;
    listingType: string;
}

const PLACEHOLDER = 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=900'

export default function Catalog({ onOpen }: { onOpen: (id: number) => void }) {
    const [firmaer, setFirmaer] = useState<Firma[]>([])
    const [activeFirma, setActiveFirma] = useState<string>('')
    const [q, setQ] = useState('')
    const [models, setModels] = useState<Model[] | null>(null)
    const [activeModel, setActiveModel] = useState<number | null>(null)

    useEffect(() => {
        api<Firma[]>('listCatalogFirmaer', { token: getToken() }).then((res) => {
            if (res.ok) setFirmaer(res.data)
        })
    }, [])

    useEffect(() => {
        let cancelled = false
        const t = setTimeout(() => {
            api<Model[]>('listCatalog', { token: getToken(), firma: activeFirma, q }).then((res) => {
                if (cancelled) return
                if (res.ok) setModels(res.data)
            })
        }, 200)
        return () => { cancelled = true; clearTimeout(t) }
    }, [activeFirma, q])

    const grouped = useMemo(() => {
        const g: Record<string, Model[]> = {}
        for (const m of models || []) {
            if (!g[m.firma]) g[m.firma] = []
            g[m.firma].push(m)
        }
        return g
    }, [models])

    if (activeModel !== null) {
        return <ModelDetail id={activeModel} onBack={() => setActiveModel(null)} onOpen={onOpen} />
    }

    return (
        <div>
            <div className="search-bar">
                <IconSearch />
                <input className="search-input" placeholder="Sok i katalog..."
                    value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            {firmaer.length > 0 && (
                <div className="firma-strip">
                    <button className={activeFirma === '' ? 'active' : ''} onClick={() => setActiveFirma('')}>
                        Alle
                    </button>
                    {firmaer.map((f) => (
                        <button key={f.firma} className={activeFirma === f.firma ? 'active' : ''}
                            onClick={() => setActiveFirma(f.firma)}>
                            {f.firma}
                            <span className="firma-count">{f.model_count}</span>
                        </button>
                    ))}
                </div>
            )}

            {!models && <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>}
            {models && models.length === 0 && <div className="empty">Ingen modeller i katalogen.</div>}

            {Object.keys(grouped).map((firma) => (
                <div key={firma} style={{ marginBottom: '1rem' }}>
                    {!activeFirma && (
                        <h3 className="section-title" style={{ marginTop: '0.6rem' }}>{firma}</h3>
                    )}
                    {grouped[firma].map((m) => (
                        <div key={m.id} className="card catalog-card" onClick={() => setActiveModel(m.id)} role="button">
                            <img src={m.image || PLACEHOLDER}
                                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER }}
                                alt="" />
                            <div className="catalog-card-body">
                                <div className="catalog-card-row">
                                    <div>
                                        <div className="catalog-card-title">{m.make} {m.model}</div>
                                        {m.variant && <div className="muted" style={{ fontSize: '0.7rem' }}>{m.variant}</div>}
                                    </div>
                                    <span className="tag tag-grey" style={{ fontSize: '0.55rem' }}>{m.firma}</span>
                                </div>
                                <div className="catalog-card-row" style={{ marginTop: '0.5rem' }}>
                                    <div>
                                        <div className="muted" style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Nypris</div>
                                        <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{formatNok(m.new_price)}</div>
                                    </div>
                                    {m.used_count > 0 ? (
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="muted" style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                                Bruktpris fra
                                            </div>
                                            <div style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatNok(m.lowest_used_price || 0)}</div>
                                            <div className="muted" style={{ fontSize: '0.65rem' }}>{m.used_count} brukte</div>
                                        </div>
                                    ) : (
                                        <div className="muted" style={{ fontSize: '0.7rem', textAlign: 'right' }}>
                                            Ingen brukte<br/>tilgjengelig
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    )
}

function ModelDetail({ id, onBack, onOpen }: { id: number; onBack: () => void; onOpen: (id: number) => void }) {
    const [model, setModel] = useState<(Model & { cars: Used[] }) | null>(null)

    useEffect(() => {
        api<Model & { cars: Used[] }>('getCatalogModel', { token: getToken(), id }).then((res) => {
            if (res.ok) setModel(res.data)
        })
    }, [id])

    if (!model) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

    return (
        <div>
            <button className="btn btn-ghost" onClick={onBack} style={{ padding: '0.4rem 0.7rem', marginBottom: '0.5rem' }}>← Tilbake</button>
            <img src={model.image || PLACEHOLDER}
                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER }}
                style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', borderRadius: 12, marginBottom: '0.6rem' }} alt="" />
            <span className="tag tag-grey" style={{ fontSize: '0.6rem' }}>{model.firma}</span>
            <h1 className="detail-title" style={{ marginTop: 6 }}>{model.make} {model.model}</h1>
            {model.variant && <p className="detail-sub">{model.variant}</p>}

            <div className="card" style={{ padding: '0.8rem 0.9rem', marginTop: '0.7rem' }}>
                <div className="muted" style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Nypris</div>
                <div style={{ fontFamily: 'var(--display)', color: 'var(--gold)', fontSize: '1.4rem', fontWeight: 600 }}>
                    {formatNok(model.new_price)}
                </div>
            </div>

            {model.description && (
                <p className="description" style={{ marginTop: '0.5rem' }}>{model.description}</p>
            )}

            <h3 className="section-title">Tilgjengelig brukt ({model.cars.length})</h3>
            {model.cars.length === 0 && <div className="empty">Ingen brukte for salg akkurat na.</div>}
            {model.cars.map((c) => {
                const savings = (c.original_price || model.new_price) - c.price
                const savingsPct = Math.round((savings / (c.original_price || model.new_price)) * 100)
                return (
                    <div key={c.id} className="card list-row" onClick={() => onOpen(c.id)} role="button"
                        style={{ marginBottom: '0.4rem', padding: '0.5rem 0.7rem' }}>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flex: 1 }}>
                            {c.image && <img src={c.image} style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 6 }} alt="" />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{c.year} · {formatKm(c.mileage)}</div>
                                <div className="muted" style={{ fontSize: '0.7rem' }}>
                                    {c.status === 'auction' ? 'Auksjon' : 'Bruktbil'}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{formatNok(c.price)}</div>
                                {savings > 0 && (
                                    <div style={{ color: 'var(--success)', fontSize: '0.7rem' }}>
                                        Sparer {savingsPct}%
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
