import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'

type Stats = {
    totalUsers: number; totalCars: number; activeListings: number;
    pendingListings: number; activeAuctions: number; totalSales: number;
    totalRevenue: number; totalCommission: number; totalTransferFees: number;
    topBrands: { make: string; cnt: number }[];
    topSellers: { tlfnr: string; cnt: number; commission: number }[];
    officeRevenue: { name: string; sales: number; revenue: number; commission: number }[];
    recentSales: { sale_price: number; commission_amount: number; sold_at: string;
        make: string; model: string; year: number; buyer_tlfnr: string }[];
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="stat-card" style={{ borderColor: accent ? 'rgba(212,175,55,0.4)' : undefined }}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color: accent ? 'var(--gold)' : undefined }}>{value}</div>
        </div>
    )
}

export default function Stats() {
    const [s, setS] = useState<Stats | null>(null)

    useEffect(() => {
        api<Stats>('adminStats', { token: getToken() }).then((res) => {
            if (res.ok) setS(res.data)
        })
    }, [])

    if (!s) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

    const maxRev = Math.max(1, ...s.officeRevenue.map((o) => o.revenue))

    return (
        <div>
            <h2 className="section-title" style={{ marginTop: 0 }}>Oversikt</h2>
            <div className="stat-grid">
                <StatCard label="Total omsetning" value={formatNok(s.totalRevenue)} accent />
                <StatCard label="Total provisjon" value={formatNok(s.totalCommission)} accent />
                <StatCard label="Salg totalt" value={String(s.totalSales)} />
                <StatCard label="Overforingsgebyr" value={formatNok(s.totalTransferFees)} />
                <StatCard label="Aktive annonser" value={String(s.activeListings)} />
                <StatCard label="Aktive auksjoner" value={String(s.activeAuctions)} />
                <StatCard label="Brukere" value={String(s.totalUsers)} />
                <StatCard label="Ventende" value={String(s.pendingListings)} />
            </div>

            <h3 className="section-title">Omsetning per kontor</h3>
            {s.officeRevenue.length === 0 && <div className="empty">Ingen salg enda.</div>}
            {s.officeRevenue.map((o) => (
                <div key={o.name} className="card" style={{ padding: '0.7rem 0.8rem', marginBottom: '0.4rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontWeight: 500 }}>{o.name}</div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>{o.sales} salg</div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 600 }}>
                        {formatNok(o.revenue)}
                    </div>
                    <div className="bar-track">
                        <div className="bar-fill" style={{ width: ((o.revenue / maxRev) * 100) + '%' }} />
                    </div>
                    <div className="muted" style={{ fontSize: '0.7rem', marginTop: 4 }}>
                        Provisjon: {formatNok(o.commission)}
                    </div>
                </div>
            ))}

            <h3 className="section-title">Topp selgere</h3>
            {s.topSellers.map((t) => (
                <div key={t.tlfnr} className="list-row card" style={{ marginBottom: '0.4rem' }}>
                    <div>
                        <div style={{ fontWeight: 500 }}>{t.tlfnr}</div>
                        <div className="meta">{t.cnt} salg · provisjon {formatNok(t.commission)}</div>
                    </div>
                </div>
            ))}

            <h3 className="section-title">Topp merker</h3>
            <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
                {s.topBrands.map((b) => (
                    <span key={b.make} className="tag">{b.make} · {b.cnt}</span>
                ))}
            </div>

            <h3 className="section-title">Siste salg</h3>
            {s.recentSales.map((r, i) => (
                <div key={i} className="card" style={{ padding: '0.6rem 0.8rem', marginBottom: '0.35rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontWeight: 500 }}>{r.make} {r.model} ({r.year})</div>
                        <div className="muted" style={{ fontSize: '0.7rem' }}>
                            {new Date(r.sold_at).toLocaleDateString('no-NO')}
                        </div>
                    </div>
                    <div className="muted" style={{ fontSize: '0.74rem' }}>
                        Kjoper: {r.buyer_tlfnr} · {formatNok(r.sale_price)} · provisjon {formatNok(r.commission_amount)}
                    </div>
                </div>
            ))}
        </div>
    )
}
