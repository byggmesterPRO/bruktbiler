import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'
import { popUp, startCall, formatPhoneNumber, takePhoto, pickFromGallery } from '../lbphone'
import {
    IconStats, IconCar, IconCheck, IconHandshake, IconStar, IconBuilding,
    IconSend, IconBell, IconSettings, IconBack, IconClose,
} from '../components/Icon'
import Stats from './Stats'
import Offices from './Offices'
import Settings from './Settings'
import Broadcast from './Broadcast'
import AuditLog from './AuditLog'
import OfficeGoals from './OfficeGoals'

type Tab = 'home' | 'stats' | 'cars' | 'pending' | 'auctions' | 'interests' | 'users' | 'offices' | 'goals' | 'broadcast' | 'audit' | 'settings'

const TILES: { id: Exclude<Tab, 'home'>; label: string; sub: string; Icon: any; color: string }[] = [
    { id: 'stats',     label: 'Statistikk', sub: 'Omsetning og salg',   Icon: IconStats,    color: '#d4af37' },
    { id: 'pending',   label: 'Venter',     sub: 'Annonser til godkj.', Icon: IconCheck,    color: '#4ade80' },
    { id: 'cars',      label: 'Biler',      sub: 'Alle biler',          Icon: IconCar,      color: '#6ea8ff' },
    { id: 'auctions',  label: 'Auksjoner',  sub: 'Start og avslutt',    Icon: IconHandshake,color: '#e6c659' },
    { id: 'interests', label: 'Interesser', sub: 'Alle interessenter',  Icon: IconStar,     color: '#d4af37' },
    { id: 'users',     label: 'Brukere',    sub: 'Tlfnr og passord',    Icon: IconBell,     color: '#9ca3af' },
    { id: 'offices',   label: 'Kontorer',   sub: 'Selger-kontor',       Icon: IconBuilding, color: '#6ea8ff' },
    { id: 'goals',     label: 'Mal og lonn',sub: 'Bonuspool og payouts',Icon: IconStats,    color: '#4ade80' },
    { id: 'broadcast', label: 'Kunngjor',   sub: 'Send til mange',      Icon: IconSend,     color: '#e6c659' },
    { id: 'audit',     label: 'Logg',       sub: 'Audit-historikk',     Icon: IconBell,     color: '#9ca3af' },
    { id: 'settings',  label: 'Innst.',     sub: 'Gebyr og provisjon',  Icon: IconSettings, color: '#9ca3af' },
]

type User = {
    id: number; tlfnr: string; name: string; is_admin: number; created_at: string;
    office_id: number | null; office_name: string | null; online: boolean;
}
type Car = {
    id: number; make: string; model: string; year: number; price: number;
    mileage: number; image: string; description: string; status: string;
    listingType: string; sellerTlfnr?: string; approved: boolean;
    assignedSellerTlfnr?: string; assignedOfficeName?: string;
}
type Interest = {
    id: number; tlfnr: string; user_id: number; car_id: number;
    make: string; model: string; year: number; message: string; created_at: string;
}

export default function Admin() {
    const [tab, setTab] = useState<Tab>('home')

    if (tab === 'home') {
        return (
            <div>
                <h2 className="section-title" style={{ marginTop: 0 }}>Admin-panel</h2>
                <p className="muted" style={{ fontSize: '0.78rem', marginTop: 0 }}>Velg en seksjon</p>
                <div className="admin-tile-grid">
                    {TILES.map((t) => (
                        <button key={t.id} className="admin-tile" onClick={() => setTab(t.id)}>
                            <span className="admin-tile-icon" style={{ background: t.color + '22', color: t.color }}>
                                <t.Icon width={20} height={20} />
                            </span>
                            <span className="admin-tile-label">{t.label}</span>
                            <span className="admin-tile-sub">{t.sub}</span>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    const tile = TILES.find((t) => t.id === tab)
    return (
        <div>
            <div className="row" style={{ alignItems: 'center', marginBottom: '0.5rem' }}>
                <button className="icon-btn" onClick={() => setTab('home')}><IconBack width={16} height={16} /></button>
                <h2 className="section-title" style={{ margin: '0 0 0 0.6rem' }}>{tile?.label}</h2>
            </div>
            {tab === 'stats' && <Stats />}
            {tab === 'cars' && <AdminCars />}
            {tab === 'pending' && <AdminPending />}
            {tab === 'auctions' && <AdminAuctions />}
            {tab === 'interests' && <AdminInterests />}
            {tab === 'users' && <AdminUsers />}
            {tab === 'offices' && <Offices />}
            {tab === 'goals' && <OfficeGoals />}
            {tab === 'broadcast' && <Broadcast />}
            {tab === 'audit' && <AuditLog />}
            {tab === 'settings' && <Settings />}
        </div>
    )
}

function AdminUsers() {
    const [users, setUsers] = useState<User[]>([])
    const [resetting, setResetting] = useState<number | null>(null)
    const [newPw, setNewPw] = useState('')
    const [msg, setMsg] = useState<string | null>(null)

    const load = () =>
        api<User[]>('adminListUsers', { token: getToken() }).then((res) => {
            if (res.ok) setUsers(res.data)
        })
    useEffect(() => { load() }, [])

    const reset = async (id: number) => {
        if (!newPw || newPw.length < 4) { setMsg('Passord for kort'); return }
        const res = await api('adminResetPassword', {
            token: getToken(), targetUserId: id, newPassword: newPw,
        })
        if (res.ok) { setMsg('Passord oppdatert'); setResetting(null); setNewPw('') }
        else setMsg(res.error)
        setTimeout(() => setMsg(null), 2000)
    }
    const toggle = async (u: User) => {
        await api('adminToggleAdmin', {
            token: getToken(), targetUserId: u.id, isAdmin: u.is_admin !== 1,
        })
        await load()
    }

    const callFromUser = async (u: User) => {
        popUp({
            title: 'Ring fra ' + (u.name || u.tlfnr),
            description: 'Tlfnr som skal ringes (selger/admin):',
            input: { type: 'tel', placeholder: '12345678', onChange: (v) => ((u as any)._target = v) },
            buttons: [
                { title: 'Avbryt', color: 'red' },
                { title: 'Ring', color: 'blue', cb: async () => {
                    const target = (u as any)._target
                    if (!target) return
                    const res = await api('placeCallFromUser', {
                        token: getToken(), fromUserId: u.id, toTlfnr: target,
                    })
                    setMsg(res.ok ? 'Anrop startet pa ' + (u.name || u.tlfnr) : res.error || 'Feilet')
                    setTimeout(() => setMsg(null), 2500)
                } },
            ],
        })
    }
    const directCall = (u: User) => startCall(u.tlfnr)

    return (
        <div>
            {msg && <div className="success-banner">{msg}</div>}
            {users.map((u) => (
                <div key={u.id} className="card list-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span className={'online-dot ' + (u.online ? 'online' : '')} title={u.online ? 'Online' : 'Offline'} />
                                {u.name || '(uten navn)'}
                                {u.is_admin === 1 && <span className="tag" style={{ fontSize: '0.55rem' }}>Admin</span>}
                                {u.office_name && <span className="tag tag-blue" style={{ fontSize: '0.55rem' }}>{u.office_name}</span>}
                            </div>
                            <div className="meta">{formatPhoneNumber(u.tlfnr)} · opprettet {new Date(u.created_at).toLocaleDateString('no-NO')}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {u.online && (
                                <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => callFromUser(u)} title="Ring fra denne brukerens telefon">
                                    Ring fra
                                </button>
                            )}
                            <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem' }}
                                onClick={() => directCall(u)}>
                                Ring
                            </button>
                            <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem' }}
                                onClick={() => setResetting(resetting === u.id ? null : u.id)}>
                                Reset pw
                            </button>
                        </div>
                    </div>
                    {resetting === u.id && (
                        <div style={{ marginTop: '0.5rem' }}>
                            <input className="input" type="text" placeholder="Nytt passord"
                                value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                            <div className="row" style={{ marginTop: '0.4rem' }}>
                                <button className="btn btn-gold" style={{ flex: 1 }} onClick={() => reset(u.id)}>Lagre</button>
                                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => toggle(u)}>
                                    {u.is_admin === 1 ? 'Fjern admin' : 'Gjor admin'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

function AdminCars() {
    const [cars, setCars] = useState<Car[]>([])
    const [editing, setEditing] = useState<Partial<Car> | null>(null)
    const [msg, setMsg] = useState<string | null>(null)

    const load = () =>
        api<Car[]>('listCars', { token: getToken() }).then((res) => {
            if (res.ok) setCars(res.data)
        })
    useEffect(() => { load() }, [])

    const save = async () => {
        if (!editing) return
        const event = editing.id ? 'adminUpdateCar' : 'adminCreateCar'
        const res = await api(event, { token: getToken(), ...editing })
        if (res.ok) { setEditing(null); setMsg('Lagret'); await load() }
        else setMsg(res.error)
        setTimeout(() => setMsg(null), 2000)
    }
    const del = async (id: number) => {
        const res = await api('adminDeleteCar', { token: getToken(), id })
        if (res.ok) { await load(); setMsg('Slettet') }
        setTimeout(() => setMsg(null), 1500)
    }

    if (editing) {
        return (
            <div>
                <button className="btn btn-ghost" onClick={() => setEditing(null)} style={{ padding: '0.4rem 0.7rem' }}>← Tilbake</button>
                <h3 className="section-title">{editing.id ? 'Rediger bil' : 'Ny bil'}</h3>
                <input className="input" placeholder="Merke" value={editing.make || ''} onChange={(e) => setEditing({ ...editing, make: e.target.value })} />
                <div style={{ height: 6 }} />
                <input className="input" placeholder="Modell" value={editing.model || ''} onChange={(e) => setEditing({ ...editing, model: e.target.value })} />
                <div style={{ height: 6 }} />
                <input className="input" placeholder="Ar" inputMode="numeric" value={editing.year || ''}
                    onChange={(e) => setEditing({ ...editing, year: parseInt(e.target.value, 10) || 0 })} />
                <div style={{ height: 6 }} />
                <input className="input" placeholder="Pris" inputMode="numeric" value={editing.price || ''}
                    onChange={(e) => setEditing({ ...editing, price: parseInt(e.target.value, 10) || 0 })} />
                <div style={{ height: 6 }} />
                <input className="input" placeholder="Km" inputMode="numeric" value={editing.mileage || ''}
                    onChange={(e) => setEditing({ ...editing, mileage: parseInt(e.target.value, 10) || 0 })} />
                <div style={{ height: 6 }} />
                <label className="label">Bilde</label>
                {editing.image && (
                    <img src={editing.image} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 6, objectFit: 'cover', maxHeight: 160 }} />
                )}
                <div className="row" style={{ gap: '0.4rem' }}>
                    <button className="btn btn-ghost" style={{ flex: 1, padding: '0.4rem' }}
                        onClick={async () => { const r = await takePhoto(); if (r) setEditing({ ...editing, image: r.url }) }}>Ta bilde</button>
                    <button className="btn btn-ghost" style={{ flex: 1, padding: '0.4rem' }}
                        onClick={async () => { const r = await pickFromGallery(); if (r) setEditing({ ...editing, image: r.url }) }}>Galleri</button>
                </div>
                <div style={{ height: 6 }} />
                <textarea className="input" rows={3} placeholder="Beskrivelse" value={editing.description || ''}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                <div style={{ height: 12 }} />
                <button className="btn btn-gold btn-block" onClick={save}>Lagre</button>
                {editing.id && (
                    <button className="btn btn-danger btn-block" style={{ marginTop: 8 }} onClick={() => del(editing.id!)}>Slett</button>
                )}
                {msg && <div className="success-banner">{msg}</div>}
            </div>
        )
    }

    return (
        <div>
            <button className="btn btn-gold btn-block" onClick={() => setEditing({})}>+ Ny bil</button>
            <div style={{ height: 12 }} />
            {msg && <div className="success-banner">{msg}</div>}
            {cars.map((c) => (
                <div key={c.id} className="card list-row" onClick={() => setEditing(c)} role="button">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>{c.make} {c.model}</div>
                        <div className="meta">{c.year} · {formatNok(c.price)} · {c.status}</div>
                        {(c.assignedSellerTlfnr || c.assignedOfficeName) && (
                            <div className="meta" style={{ marginTop: 2 }}>
                                {c.assignedOfficeName && <span className="tag tag-blue" style={{ fontSize: '0.55rem' }}>{c.assignedOfficeName}</span>}
                                {c.assignedSellerTlfnr && <> · Selger: {formatPhoneNumber(c.assignedSellerTlfnr)}</>}
                            </div>
                        )}
                    </div>
                    <span className="muted">›</span>
                </div>
            ))}
        </div>
    )
}

function AdminPending() {
    const [items, setItems] = useState<Car[]>([])
    const [commission, setCommission] = useState('8')
    const [msg, setMsg] = useState<string | null>(null)

    const load = () =>
        api<Car[]>('adminListPending', { token: getToken() }).then((res) => {
            if (res.ok) setItems(res.data)
        })
    useEffect(() => { load() }, [])

    const approve = async (id: number) => {
        const res = await api('adminApproveListing', {
            token: getToken(), carId: id, commissionPct: parseInt(commission || '0', 10),
        })
        if (res.ok) { setMsg('Godkjent'); await load() }
        setTimeout(() => setMsg(null), 1500)
    }
    const reject = async (id: number) => {
        const res = await api('adminRejectListing', { token: getToken(), carId: id })
        if (res.ok) { setMsg('Avvist'); await load() }
        setTimeout(() => setMsg(null), 1500)
    }

    if (items.length === 0) return <div className="empty">Ingen ventende annonser.</div>

    return (
        <div>
            <label className="label">Provisjon (%)</label>
            <input className="input" inputMode="numeric" value={commission} onChange={(e) => setCommission(e.target.value)} />
            {msg && <div className="success-banner">{msg}</div>}
            <div style={{ height: 8 }} />
            {items.map((c) => (
                <div key={c.id} className="card" style={{ padding: '0.7rem 0.8rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 500 }}>{c.make} {c.model} ({c.year})</div>
                    <div className="meta" style={{ fontSize: '0.74rem' }}>
                        {formatNok(c.price)} · {c.listingType} · selger {c.sellerTlfnr || '-'}
                    </div>
                    {c.description && <div style={{ fontSize: '0.78rem', margin: '0.4rem 0', color: 'var(--text-dim)' }}>{c.description}</div>}
                    <div className="row" style={{ marginTop: '0.5rem' }}>
                        <button className="btn btn-gold" style={{ flex: 1 }} onClick={() => approve(c.id)}>Godkjenn</button>
                        <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => reject(c.id)}>Avvis</button>
                    </div>
                </div>
            ))}
        </div>
    )
}

function AdminAuctions() {
    const [cars, setCars] = useState<Car[]>([])
    const [carId, setCarId] = useState('')
    const [startPrice, setStartPrice] = useState('')
    const [hours, setHours] = useState('24')
    const [msg, setMsg] = useState<string | null>(null)

    const load = () =>
        api<Car[]>('listCars', { token: getToken() }).then((res) => {
            if (res.ok) setCars(res.data)
        })
    useEffect(() => { load() }, [])

    const create = async () => {
        const res = await api('adminCreateAuction', {
            token: getToken(),
            carId: parseInt(carId, 10), startPrice: parseInt(startPrice, 10),
            durationHours: parseInt(hours, 10),
        })
        if (res.ok) { setMsg('Auksjon startet'); await load() }
        else setMsg(res.error)
        setTimeout(() => setMsg(null), 2000)
    }

    const auctionCars = cars.filter((c) => c.status === 'auction')

    return (
        <div>
            <h3 className="section-title" style={{ marginTop: 0 }}>Start auksjon</h3>
            <select className="input" value={carId} onChange={(e) => setCarId(e.target.value)}>
                <option value="">Velg bil</option>
                {cars.filter((c) => c.status === 'available').map((c) => (
                    <option key={c.id} value={c.id}>{c.make} {c.model} ({c.year})</option>
                ))}
            </select>
            <div style={{ height: 6 }} />
            <input className="input" placeholder="Startpris" inputMode="numeric"
                value={startPrice} onChange={(e) => setStartPrice(e.target.value)} />
            <div style={{ height: 6 }} />
            <input className="input" placeholder="Varighet (timer)" inputMode="numeric"
                value={hours} onChange={(e) => setHours(e.target.value)} />
            <div style={{ height: 8 }} />
            <button className="btn btn-gold btn-block" onClick={create}>Start auksjon</button>
            {msg && <div className="success-banner">{msg}</div>}

            <h3 className="section-title">Aktive</h3>
            {auctionCars.length === 0 && <div className="empty">Ingen aktive auksjoner.</div>}
            {auctionCars.map((c) => (
                <div key={c.id} className="card list-row">
                    <div>
                        <div style={{ fontWeight: 500 }}>{c.make} {c.model}</div>
                        <div className="meta">{formatNok(c.price)}</div>
                    </div>
                </div>
            ))}
        </div>
    )
}

function AdminInterests() {
    const [items, setItems] = useState<Interest[]>([])

    useEffect(() => {
        api<Interest[]>('adminListInterests', { token: getToken() }).then((res) => {
            if (res.ok) setItems(res.data)
        })
    }, [])

    if (items.length === 0) return <div className="empty">Ingen interesser registrert enda.</div>

    return (
        <div>
            {items.map((i) => (
                <div key={i.id} className="card" style={{ padding: '0.7rem 0.8rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 500 }}>{i.make} {i.model} ({i.year})</div>
                        <span className="muted" style={{ fontSize: '0.7rem' }}>
                            {new Date(i.created_at).toLocaleDateString('no-NO')}
                        </span>
                    </div>
                    <div className="meta" style={{ fontSize: '0.74rem' }}>fra {i.tlfnr}</div>
                    {i.message && <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: 'var(--text-dim)' }}>"{i.message}"</div>}
                </div>
            ))}
        </div>
    )
}
