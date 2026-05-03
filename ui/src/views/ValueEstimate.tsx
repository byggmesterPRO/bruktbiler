import { useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'

type Estimate = {
    sampleSize: number; listingSampleSize: number;
    avgSoldPrice: number | null; avgListingPrice: number | null;
    suggestedSellPrice: number | null; suggestedBuyPrice: number | null;
    recentSales: { sale_price: number; year: number; mileage: number }[];
}

export default function ValueEstimate() {
    const [make, setMake] = useState('')
    const [model, setModel] = useState('')
    const [year, setYear] = useState('')
    const [mileage, setMileage] = useState('')
    const [est, setEst] = useState<Estimate | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const compute = async () => {
        setError(null); setLoading(true)
        const res = await api<Estimate>('estimateValue', {
            token: getToken(), make, model,
            year: parseInt(year, 10) || undefined,
            mileage: parseInt(mileage, 10) || undefined,
        })
        setLoading(false)
        if (res.ok) setEst(res.data)
        else setError(res.error)
    }

    return (
        <div>
            <h2 className="section-title" style={{ marginTop: 0 }}>Verdianslag</h2>
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 0 }}>
                Beregn anbefalt salgspris basert pa historiske salg og aktive annonser.
            </p>

            <label className="label">Merke</label>
            <input className="input" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Audi" />
            <label className="label">Modell</label>
            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="RS6 Avant" />
            <div className="row">
                <div style={{ flex: 1 }}>
                    <label className="label">Arsmodell</label>
                    <input className="input" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                    <label className="label">Km</label>
                    <input className="input" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} />
                </div>
            </div>
            <div style={{ height: 10 }} />
            <button className="btn btn-gold btn-block" onClick={compute} disabled={loading}>
                {loading ? '...' : 'Beregn'}
            </button>
            {error && <div className="error-banner">{error}</div>}

            {est && (
                <div style={{ marginTop: '0.8rem' }}>
                    <div className="stat-grid">
                        <div className="stat-card" style={{ borderColor: 'rgba(212,175,55,0.4)' }}>
                            <div className="stat-label">Anbefalt salg</div>
                            <div className="stat-value" style={{ color: 'var(--gold)' }}>
                                {est.suggestedSellPrice ? formatNok(est.suggestedSellPrice) : '—'}
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Innkjop</div>
                            <div className="stat-value">
                                {est.suggestedBuyPrice ? formatNok(est.suggestedBuyPrice) : '—'}
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Snitt solgt</div>
                            <div className="stat-value" style={{ fontSize: '0.92rem' }}>
                                {est.avgSoldPrice ? formatNok(est.avgSoldPrice) : '—'}
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Snitt annonse</div>
                            <div className="stat-value" style={{ fontSize: '0.92rem' }}>
                                {est.avgListingPrice ? formatNok(est.avgListingPrice) : '—'}
                            </div>
                        </div>
                    </div>
                    <p className="muted" style={{ fontSize: '0.74rem', textAlign: 'center', marginTop: '0.5rem' }}>
                        Basert pa {est.sampleSize} salg og {est.listingSampleSize} aktive annonser.
                        Innkjop = ~85% av salgspris (gir margin).
                    </p>

                    {est.recentSales.length > 0 && (
                        <>
                            <h3 className="section-title">Siste salg</h3>
                            {est.recentSales.slice(0, 5).map((r, i) => (
                                <div key={i} className="card" style={{ padding: '0.5rem 0.7rem', marginBottom: '0.3rem' }}>
                                    <div className="row" style={{ justifyContent: 'space-between' }}>
                                        <span className="muted" style={{ fontSize: '0.75rem' }}>
                                            {r.year} · {r.mileage?.toLocaleString('no-NO')} km
                                        </span>
                                        <span style={{ fontWeight: 600 }}>{formatNok(r.sale_price)}</span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
