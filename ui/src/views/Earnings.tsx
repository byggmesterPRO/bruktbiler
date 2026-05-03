import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'

type Payout = {
    id: number; period: string; amount: number; note: string;
    paid: number; paid_at: string | null; created_at: string;
}
type Earnings = {
    period: string; sales: number; revenue: number; commission: number; outstanding: number;
    payouts: Payout[];
}

export default function Earnings() {
    const [data, setData] = useState<Earnings | null>(null)

    useEffect(() => {
        api<Earnings>('myEarnings', { token: getToken() }).then((res) => {
            if (res.ok) setData(res.data)
        })
    }, [])

    if (!data) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

    return (
        <div>
            <h2 className="section-title" style={{ marginTop: 0 }}>Min provisjon ({data.period})</h2>
            <div className="stat-grid">
                <div className="stat-card" style={{ borderColor: 'rgba(212,175,55,0.4)' }}>
                    <div className="stat-label">Provisjon i ar</div>
                    <div className="stat-value" style={{ color: 'var(--gold)' }}>{formatNok(data.commission)}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Salg</div>
                    <div className="stat-value">{data.sales}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Omsetning</div>
                    <div className="stat-value">{formatNok(data.revenue)}</div>
                </div>
                <div className="stat-card" style={{ borderColor: data.outstanding > 0 ? 'rgba(74,222,128,0.4)' : undefined }}>
                    <div className="stat-label">Til utbetaling</div>
                    <div className="stat-value" style={{ color: data.outstanding > 0 ? 'var(--success)' : undefined }}>
                        {formatNok(data.outstanding)}
                    </div>
                </div>
            </div>
            <p className="muted" style={{ fontSize: '0.74rem', textAlign: 'center', marginBottom: '0.7rem' }}>
                Appen er regnskap. Penger flyttes manuelt mellom partene.
            </p>

            <h3 className="section-title">Mine bonuser</h3>
            {data.payouts.length === 0 && <div className="empty">Ingen bonuser tildelt enda.</div>}
            {data.payouts.map((p) => (
                <div key={p.id} className="card" style={{ padding: '0.6rem 0.8rem', marginBottom: '0.4rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                            <div style={{ fontWeight: 500 }}>{formatNok(p.amount)}</div>
                            {p.note && <div className="meta">{p.note}</div>}
                        </div>
                        <span className={'tag ' + (p.paid ? 'tag-green' : 'tag-grey')}>
                            {p.paid ? 'Utbetalt' : 'Venter'}
                        </span>
                    </div>
                    <div className="meta" style={{ fontSize: '0.7rem', marginTop: 4 }}>
                        {p.period}
                        {p.paid_at && ` · ${new Date(p.paid_at).toLocaleDateString('no-NO')}`}
                    </div>
                </div>
            ))}
        </div>
    )
}
