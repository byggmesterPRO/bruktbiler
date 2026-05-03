import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'

type App = {
    id: number; car_id: number; status: string;
    sale_price: number; down_payment: number; term_months: number;
    interest_pct: number; monthly_payment: number; total_payable: number;
    amount_paid: number; next_due: string | null;
    make: string; model: string; year: number; image: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Venter', cls: 'tag-grey' },
    approved: { label: 'Godkjent', cls: 'tag-green' },
    rejected: { label: 'Avvist', cls: 'tag-red' },
    active: { label: 'Aktiv', cls: 'tag-blue' },
    completed: { label: 'Nedbetalt', cls: 'tag' },
    cancelled: { label: 'Avbrutt', cls: 'tag-grey' },
}

export default function MyFinancing({ onOpen }: { onOpen: (id: number) => void }) {
    const [apps, setApps] = useState<App[] | null>(null)

    useEffect(() => {
        api<App[]>('listMyFinancing', { token: getToken() }).then((res) => {
            if (res.ok) setApps(res.data)
        })
    }, [])

    if (!apps) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
    if (apps.length === 0) return <div className="empty">Du har ikke sokt finansiering enda.</div>

    return (
        <div>
            {apps.map((a) => {
                const s = STATUS_LABEL[a.status] || { label: a.status, cls: 'tag-grey' }
                const pct = a.total_payable ? Math.min(100, (a.amount_paid / a.total_payable) * 100) : 0
                return (
                    <div key={a.id} className="card" style={{ padding: '0.7rem 0.8rem', marginBottom: '0.5rem', cursor: 'pointer' }}
                        onClick={() => onOpen(a.car_id)}>
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <div style={{ fontWeight: 500 }}>{a.make} {a.model} ({a.year})</div>
                            <span className={'tag ' + s.cls}>{s.label}</span>
                        </div>
                        <div className="meta" style={{ fontSize: '0.74rem', marginTop: 4 }}>
                            {formatNok(a.monthly_payment)}/mnd · {a.term_months} mnd · {a.interest_pct}%
                        </div>
                        {a.status === 'active' || a.status === 'approved' ? (
                            <>
                                <div className="bar-track" style={{ marginTop: '0.4rem' }}>
                                    <div className="bar-fill" style={{ width: pct + '%' }} />
                                </div>
                                <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                                    <span className="muted" style={{ fontSize: '0.7rem' }}>
                                        {formatNok(a.amount_paid)} av {formatNok(a.total_payable)}
                                    </span>
                                    {a.next_due && (
                                        <span className="muted" style={{ fontSize: '0.7rem' }}>
                                            Neste {new Date(a.next_due).toLocaleDateString('no-NO')}
                                        </span>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}
