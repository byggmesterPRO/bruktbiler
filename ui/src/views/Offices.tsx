import { useEffect, useState } from 'react'
import { api } from '../api'
import { getToken } from '../auth'

type Office = { id: number; name: string; logo: string; commission_pct: number; member_count: number }
type Member = { user_id: number; role: string; tlfnr: string; joined_at: string }

export default function Offices() {
    const [offices, setOffices] = useState<Office[]>([])
    const [view, setView] = useState<'list' | 'edit' | 'members'>('list')
    const [editing, setEditing] = useState<Partial<Office> | null>(null)
    const [activeId, setActiveId] = useState<number | null>(null)
    const [msg, setMsg] = useState<string | null>(null)

    const load = () =>
        api<Office[]>('listOffices', { token: getToken() }).then((res) => {
            if (res.ok) setOffices(res.data)
        })
    useEffect(() => { load() }, [])

    const save = async () => {
        if (!editing) return
        const event = editing.id ? 'adminUpdateOffice' : 'adminCreateOffice'
        const res = await api(event, { token: getToken(), ...editing, commissionPct: editing.commission_pct })
        if (res.ok) { setMsg('Lagret'); setEditing(null); setView('list'); await load() }
        setTimeout(() => setMsg(null), 1500)
    }
    const del = async (id: number) => {
        await api('adminDeleteOffice', { token: getToken(), id })
        await load(); setMsg('Slettet')
        setTimeout(() => setMsg(null), 1500)
    }

    if (view === 'edit' && editing) {
        return (
            <div>
                <button className="btn btn-ghost" onClick={() => { setEditing(null); setView('list') }} style={{ padding: '0.4rem 0.7rem' }}>← Tilbake</button>
                <h3 className="section-title">{editing.id ? 'Rediger kontor' : 'Nytt kontor'}</h3>
                <label className="label">Navn</label>
                <input className="input" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <label className="label">Logo URL (valgfri)</label>
                <input className="input" value={editing.logo || ''} onChange={(e) => setEditing({ ...editing, logo: e.target.value })} />
                <label className="label">Provisjon (%)</label>
                <input className="input" inputMode="numeric" value={editing.commission_pct || ''}
                    onChange={(e) => setEditing({ ...editing, commission_pct: parseInt(e.target.value, 10) || 0 })} />
                <div style={{ height: 12 }} />
                <button className="btn btn-gold btn-block" onClick={save}>Lagre</button>
                {editing.id && (
                    <button className="btn btn-danger btn-block" style={{ marginTop: 8 }} onClick={() => del(editing.id!)}>Slett</button>
                )}
                {msg && <div className="success-banner">{msg}</div>}
            </div>
        )
    }

    if (view === 'members' && activeId !== null) {
        return <Members officeId={activeId} onBack={() => { setView('list'); setActiveId(null); load() }} />
    }

    return (
        <div>
            <button className="btn btn-gold btn-block" onClick={() => { setEditing({ commission_pct: 8 }); setView('edit') }}>+ Nytt kontor</button>
            <div style={{ height: 12 }} />
            {msg && <div className="success-banner">{msg}</div>}
            {offices.length === 0 && <div className="empty">Ingen kontorer enda.</div>}
            {offices.map((o) => (
                <div key={o.id} className="card" style={{ padding: '0.7rem 0.8rem', marginBottom: '0.5rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontWeight: 500 }}>{o.name}</div>
                            <div className="meta">{o.commission_pct}% provisjon · {o.member_count} ansatte</div>
                        </div>
                    </div>
                    <div className="row" style={{ marginTop: '0.5rem', gap: '0.4rem' }}>
                        <button className="btn btn-ghost" style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                            onClick={() => { setActiveId(o.id); setView('members') }}>Ansatte</button>
                        <button className="btn btn-ghost" style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                            onClick={() => { setEditing(o); setView('edit') }}>Rediger</button>
                    </div>
                </div>
            ))}
        </div>
    )
}

function Members({ officeId, onBack }: { officeId: number; onBack: () => void }) {
    const [members, setMembers] = useState<Member[]>([])
    const [tlfnr, setTlfnr] = useState('')
    const [role, setRole] = useState('seller')
    const [msg, setMsg] = useState<string | null>(null)

    const load = () =>
        api<Member[]>('adminListOfficeMembers', { token: getToken(), officeId }).then((res) => {
            if (res.ok) setMembers(res.data)
        })
    useEffect(() => { load() }, [officeId])

    const add = async () => {
        const res = await api('adminAddMember', { token: getToken(), officeId, tlfnr, role })
        if (res.ok) { setMsg('Lagt til'); setTlfnr(''); await load() }
        else setMsg(res.error)
        setTimeout(() => setMsg(null), 1800)
    }
    const remove = async (userId: number) => {
        await api('adminRemoveMember', { token: getToken(), officeId, userId })
        await load()
    }

    return (
        <div>
            <button className="btn btn-ghost" onClick={onBack} style={{ padding: '0.4rem 0.7rem' }}>← Tilbake</button>
            <h3 className="section-title">Ansatte</h3>
            <label className="label">Tlfnr</label>
            <input className="input" value={tlfnr} onChange={(e) => setTlfnr(e.target.value)} placeholder="12345678" />
            <label className="label">Rolle</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="seller">Selger</option>
                <option value="manager">Manager</option>
            </select>
            <div style={{ height: 8 }} />
            <button className="btn btn-gold btn-block" onClick={add}>Legg til</button>
            {msg && <div className="success-banner">{msg}</div>}

            <div style={{ height: 14 }} />
            {members.length === 0 && <div className="empty">Ingen ansatte enda.</div>}
            {members.map((m) => (
                <div key={m.user_id} className="card list-row" style={{ marginBottom: '0.4rem' }}>
                    <div>
                        <div style={{ fontWeight: 500 }}>{m.tlfnr}</div>
                        <div className="meta">{m.role}</div>
                    </div>
                    <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                        onClick={() => remove(m.user_id)}>Fjern</button>
                </div>
            ))}
        </div>
    )
}
