import { useEffect, useState } from 'react'
import { api } from '../api'
import { getToken } from '../auth'

type Entry = {
    id: number; actor_id: number | null; actor_tlfnr: string | null;
    action: string; target_type: string | null; target_id: number | null;
    details: string | null; created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
    approve_listing: 'Godkjent annonse',
    reject_listing: 'Avvist annonse',
    create_car: 'Opprettet bil',
    create_auction: 'Startet auksjon',
    complete_sale: 'Fullfort salg',
    create_offer: 'Sendt tilbud',
    accept_offer: 'Godtatt tilbud',
    reject_offer: 'Avvist tilbud',
    counter_offer: 'Mottilbud',
    add_image: 'Lagt til bilde',
    remove_image: 'Fjernet bilde',
    set_office_goal: 'Satt mal',
    create_payout: 'Tildelt bonus',
    mark_payout_paid: 'Markert utbetalt',
}

function timeAgo(iso: string) {
    const ms = Date.now() - new Date(iso).getTime()
    const m = Math.floor(ms / 60000)
    if (m < 1) return 'na'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}t`
    return new Date(iso).toLocaleDateString('no-NO')
}

export default function AuditLog() {
    const [entries, setEntries] = useState<Entry[]>([])

    useEffect(() => {
        api<Entry[]>('adminAuditLog', { token: getToken() }).then((res) => {
            if (res.ok) setEntries(res.data)
        })
    }, [])

    if (entries.length === 0) return <div className="empty">Ingen logginnslag enda.</div>

    return (
        <div>
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 0 }}>
                Siste 200 admin- og selger-handlinger.
            </p>
            {entries.map((e) => (
                <div key={e.id} className="card" style={{ padding: '0.55rem 0.75rem', marginBottom: '0.35rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontWeight: 500, fontSize: '0.82rem' }}>
                            {ACTION_LABEL[e.action] || e.action}
                        </div>
                        <span className="muted" style={{ fontSize: '0.7rem' }}>{timeAgo(e.created_at)}</span>
                    </div>
                    <div className="meta" style={{ fontSize: '0.7rem' }}>
                        av {e.actor_tlfnr || 'system'}
                        {e.target_type && ` · ${e.target_type} #${e.target_id}`}
                    </div>
                    {e.details && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 3,
                            fontFamily: 'monospace', wordBreak: 'break-all' }}>
                            {e.details}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
