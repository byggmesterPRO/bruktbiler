import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'

type Tab = 'users' | 'cars' | 'pending' | 'interests' | 'auctions'

type User = { id: number; tlfnr: string; is_admin: number; created_at: string }
type Car = {
    id: number; make: string; model: string; year: number; price: number;
    mileage: number; image: string; description: string; status: string;
    listingType: string; sellerTlfnr?: string; approved: boolean;
}
type Interest = {
    id: number; tlfnr: string; user_id: number; car_id: number;
    make: string; model: string; year: number; message: string; created_at: string;
}

export default function Admin() {
    const [tab, setTab] = useState<Tab>('cars')

    return (
        <div>
            <h2 className="section-title" style={{ marginTop: 0 }}>Admin-panel</h2>
            <div className="tabs">
                <button className={tab === 'cars' ? 'active' : ''} onClick={() => setTab('cars')}>Biler</button>
                <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>Venter</button>
                <button className={tab === 'auctions' ? 'active' : ''} onClick={() => setTab('auctions')}>Auksjoner</button>
                <button className={tab === 'interests' ? 'active' : ''} onClick={() => setTab('interests')}>Interesser</button>
                <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Brukere</button>
            </div>
            {tab === 'cars' && <AdminCars />}
            {tab === 'pending' && <AdminPending />}
            {tab === 'auctions' && <AdminAuctions />}
            {tab === 'interests' && <AdminInterests />}
            {tab === 'users' && <AdminUsers />}
        </div>
    )
}

// ================= USERS =================

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

    return (
        <div>
            {msg && <div className="success-banner">{msg}</div>}
            {users.map((u) => (
                <div key={u.id} className="card list-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontWeight: 500 }}>{u.tlfnr} {u.is_admin === 1 && <span className="tag" style={{ marginLeft: 6 }}>Admin</span>}</div>
                            <div className="meta">Opprettet {new Date(u.created_at).toLocaleDateString('no-NO')}</div>
                        </div>
                        <button className="btn btn-ghost" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => setResetting(resetting === u.id ? null : u.id)}>
                            Reset pw
                        </button>
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

// ================= CARS =================

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
                <input className="input" placeholder="Bilde URL" value={editing.image || ''} onChange={(e) => setEditing({ ...editing, image: e.target.value })} />
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
                    <div>
                        <div style={{ fontWeight: 500 }}>{c.make} {c.model}</div>
                        <div className="meta">{c.year} · {formatNok(c.price)} · {c.status}</div>
                    </div>
                    <span className="muted">›</span>
                </div>
            ))}
        </div>
    )
}

// ================= PENDING =================

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

// ================= AUCTIONS =================

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
    const end = async (id: number) => {
        const res = await api('adminEndAuction', { token: getToken(), auctionId: id })
        if (res.ok) { setMsg('Auksjon avsluttet'); await load() }
        setTimeout(() => setMsg(null), 1500)
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
                    <button className="btn btn-danger" onClick={() => end((c as any).auctionId || c.id)}
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>Avslutt</button>
                </div>
            ))}
        </div>
    )
}

// ================= INTERESTS =================

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
