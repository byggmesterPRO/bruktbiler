import { useEffect, useState } from 'react'
import { api } from '../api'
import { getToken } from '../auth'

type Msg = {
    id: number; type: string; title: string; body: string;
    link_car_id: number | null; is_read: number; created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
    system: 'System', outbid: 'Overbudt', interest: 'Interesse',
    approved: 'Godkjent', rejected: 'Avvist', sale: 'Salg',
    broadcast: 'Kunngjoring', assignment: 'Tildeling', chat: 'Chat',
}

function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime()
    const m = Math.floor(ms / 60000)
    if (m < 1) return 'na'
    if (m < 60) return `${m}m siden`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}t siden`
    return new Date(iso).toLocaleDateString('no-NO')
}

export default function Inbox({ onOpenCar }: { onOpenCar: (id: number) => void }) {
    const [msgs, setMsgs] = useState<Msg[] | null>(null)

    const load = () =>
        api<Msg[]>('listMessages', { token: getToken() }).then((res) => {
            if (res.ok) setMsgs(res.data)
        })
    useEffect(() => { load() }, [])

    const markAll = async () => {
        await api('markAllRead', { token: getToken() })
        load()
    }
    const open = async (m: Msg) => {
        if (!m.is_read) await api('markMessageRead', { token: getToken(), id: m.id })
        if (m.link_car_id) onOpenCar(m.link_car_id)
        else load()
    }

    if (!msgs) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

    return (
        <div>
            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h2 className="section-title" style={{ margin: 0 }}>Innboks</h2>
                <button className="btn btn-ghost" style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }}
                    onClick={markAll}>Marker alle lest</button>
            </div>
            {msgs.length === 0 && <div className="empty">Ingen meldinger.</div>}
            {msgs.map((m) => (
                <div key={m.id} className={'card msg-card' + (m.is_read ? '' : ' unread')}
                    onClick={() => open(m)} role="button"
                    style={{ padding: '0.7rem 0.8rem', marginBottom: '0.5rem' }}>
                    <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="tag tag-grey" style={{ fontSize: '0.6rem' }}>{TYPE_LABEL[m.type] || m.type}</span>
                        <span className="muted" style={{ fontSize: '0.7rem' }}>{timeAgo(m.created_at)}</span>
                    </div>
                    <div style={{ fontWeight: 500, marginTop: '0.3rem' }}>{m.title}</div>
                    {m.body && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>{m.body}</div>}
                </div>
            ))}
        </div>
    )
}
