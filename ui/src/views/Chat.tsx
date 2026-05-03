import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { getToken } from '../auth'
import { useAuth } from '../auth'
import { IconBack, IconSend } from '../components/Icon'

type Thread = {
    id: number; car_id: number; customer_id: number; seller_id: number | null;
    make: string; model: string; year: number; image: string;
    customer_tlfnr: string; seller_tlfnr: string | null;
    last_msg: string | null; last_at: string | null;
}
type Msg = { id: number; sender_id: number; body: string; created_at: string; tlfnr: string }

export default function Chat({ initialThreadId, onClose }: { initialThreadId?: number; onClose?: () => void }) {
    const [threads, setThreads] = useState<Thread[] | null>(null)
    const [active, setActive] = useState<number | null>(initialThreadId || null)

    const load = () =>
        api<Thread[]>('listMyThreads', { token: getToken() }).then((res) => {
            if (res.ok) setThreads(res.data)
        })
    useEffect(() => { load() }, [])

    if (active !== null) {
        return <ChatView threadId={active} onBack={() => { setActive(null); load() }} />
    }

    if (!threads) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

    return (
        <div>
            <h2 className="section-title" style={{ marginTop: 0 }}>Samtaler</h2>
            {threads.length === 0 && <div className="empty">Ingen aktive samtaler.</div>}
            {threads.map((t) => (
                <div key={t.id} className="card" style={{ padding: '0.6rem', marginBottom: '0.5rem', cursor: 'pointer', display: 'flex', gap: '0.7rem' }}
                    onClick={() => setActive(t.id)}>
                    {t.image && <img src={t.image} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} alt="" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>{t.make} {t.model} ({t.year})</div>
                        <div className="muted" style={{ fontSize: '0.72rem' }}>
                            med {t.seller_tlfnr || '?'} ↔ {t.customer_tlfnr}
                        </div>
                        {t.last_msg && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 4,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {t.last_msg}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

function ChatView({ threadId, onBack }: { threadId: number; onBack: () => void }) {
    const [messages, setMessages] = useState<Msg[]>([])
    const [body, setBody] = useState('')
    const { me } = useAuth()
    const scrollRef = useRef<HTMLDivElement>(null)

    const load = () =>
        api<Msg[]>('listThreadMessages', { token: getToken(), threadId }).then((res) => {
            if (res.ok) setMessages(res.data)
        })
    useEffect(() => {
        load()
        const t = setInterval(load, 4000)
        return () => clearInterval(t)
    }, [threadId])
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages])

    const send = async () => {
        if (!body.trim()) return
        await api('sendThreadMessage', { token: getToken(), threadId, body })
        setBody('')
        load()
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="row" style={{ alignItems: 'center', marginBottom: '0.5rem' }}>
                <button className="icon-btn" onClick={onBack}><IconBack width={16} height={16} /></button>
                <h3 className="section-title" style={{ margin: '0 0 0 0.6rem' }}>Samtale</h3>
            </div>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0.4rem 0', minHeight: 200 }}>
                {messages.map((m) => {
                    const mine = m.sender_id === me?.id
                    return (
                        <div key={m.id} style={{
                            display: 'flex',
                            justifyContent: mine ? 'flex-end' : 'flex-start',
                            margin: '0.3rem 0',
                        }}>
                            <div style={{
                                maxWidth: '78%',
                                background: mine ? 'linear-gradient(180deg, var(--gold-soft), var(--gold))' : 'var(--bg-2)',
                                color: mine ? '#18130b' : 'var(--text)',
                                padding: '0.5rem 0.75rem',
                                borderRadius: 14,
                                fontSize: '0.85rem',
                                border: mine ? 'none' : '1px solid var(--line)',
                            }}>
                                {!mine && <div style={{ fontSize: '0.65rem', color: 'var(--text-faint)', marginBottom: 2 }}>{m.tlfnr}</div>}
                                <div>{m.body}</div>
                            </div>
                        </div>
                    )
                })}
                {messages.length === 0 && <div className="empty" style={{ padding: '2rem 0' }}>Start samtalen!</div>}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--line)' }}>
                <input className="input" value={body} onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') send() }} placeholder="Skriv en melding..." />
                <button className="btn btn-gold" onClick={send} style={{ padding: '0.5rem 0.8rem' }}>
                    <IconSend width={18} height={18} />
                </button>
            </div>
        </div>
    )
}
