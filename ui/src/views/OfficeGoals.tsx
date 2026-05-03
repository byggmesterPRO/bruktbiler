import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'

type Goal = {
    officeId: number; period: string; officeName: string;
    revenueTarget: number; salesTarget: number; notes: string;
    actualRevenue: number; actualSales: number; actualCommission: number;
    floorPct: number; floorAmount: number; bonusPool: number;
}

type Office = { id: number; name: string }
type Earner = { id: number; name: string; tlfnr: string; role: string;
    commission: number; sales: number; revenue: number; outstanding: number }

const currentPeriod = () => new Date().toISOString().slice(0, 7)

export default function OfficeGoals() {
    const [offices, setOffices] = useState<Office[]>([])
    const [officeId, setOfficeId] = useState<number | null>(null)
    const [period, setPeriod] = useState(currentPeriod())
    const [goal, setGoal] = useState<Goal | null>(null)
    const [revenueTarget, setRevenueTarget] = useState('')
    const [salesTarget, setSalesTarget] = useState('')
    const [earners, setEarners] = useState<Earner[]>([])
    const [msg, setMsg] = useState<string | null>(null)
    const [payoutFor, setPayoutFor] = useState<Earner | null>(null)
    const [payoutAmount, setPayoutAmount] = useState('')
    const [payoutNote, setPayoutNote] = useState('')

    useEffect(() => {
        api<Office[]>('listOffices', { token: getToken() }).then((res) => {
            if (res.ok) {
                setOffices(res.data)
                if (res.data.length > 0 && !officeId) setOfficeId(res.data[0].id)
            }
        })
    }, [])

    const load = () => {
        if (!officeId) return
        api<Goal>('getOfficeGoal', { token: getToken(), officeId, period }).then((res) => {
            if (res.ok) {
                setGoal(res.data)
                setRevenueTarget(String(res.data.revenueTarget || ''))
                setSalesTarget(String(res.data.salesTarget || ''))
            }
        })
        api<Earner[]>('officeEarnings', { token: getToken(), officeId, period }).then((res) => {
            if (res.ok) setEarners(res.data)
        })
    }
    useEffect(() => { load() }, [officeId, period])

    const saveGoal = async () => {
        const res = await api('setOfficeGoal', {
            token: getToken(), officeId, period,
            revenueTarget: parseInt(revenueTarget, 10) || 0,
            salesTarget: parseInt(salesTarget, 10) || 0,
        })
        if (res.ok) { setMsg('Mal lagret'); await load() }
        else setMsg(res.error)
        setTimeout(() => setMsg(null), 1800)
    }

    const submitPayout = async () => {
        if (!payoutFor) return
        const amount = parseInt(payoutAmount, 10)
        if (!amount || amount <= 0) { setMsg('Ugyldig sum'); return }
        const res = await api('createPayout', {
            token: getToken(), officeId, userId: payoutFor.id, amount, note: payoutNote, period,
        })
        if (res.ok) {
            setMsg('Bonus tildelt')
            setPayoutFor(null); setPayoutAmount(''); setPayoutNote('')
            await load()
        } else setMsg(res.error)
        setTimeout(() => setMsg(null), 1800)
    }

    if (!goal) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

    const revenuePct = goal.revenueTarget ? Math.min(100, (goal.actualRevenue / goal.revenueTarget) * 100) : 0
    const salesPct = goal.salesTarget ? Math.min(100, (goal.actualSales / goal.salesTarget) * 100) : 0
    const allocated = earners.reduce((s, e) => s + (e.outstanding || 0), 0)
    const remaining = Math.max(0, goal.bonusPool - allocated)

    return (
        <div>
            <div className="row" style={{ gap: '0.4rem' }}>
                <select className="input" style={{ flex: 1 }} value={officeId ?? ''}
                    onChange={(e) => setOfficeId(parseInt(e.target.value, 10) || null)}>
                    {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <input className="input" style={{ width: 110 }} value={period}
                    onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" />
            </div>

            {msg && <div className="success-banner">{msg}</div>}

            <h3 className="section-title">Maned-mal</h3>
            <div className="card" style={{ padding: '0.7rem' }}>
                <label className="label">Omsetnings-mal (kr)</label>
                <input className="input" inputMode="numeric" value={revenueTarget}
                    onChange={(e) => setRevenueTarget(e.target.value)} />
                <label className="label">Salgs-mal (antall)</label>
                <input className="input" inputMode="numeric" value={salesTarget}
                    onChange={(e) => setSalesTarget(e.target.value)} />
                <div style={{ height: 8 }} />
                <button className="btn btn-gold btn-block" onClick={saveGoal}>Lagre mal</button>
            </div>

            <div className="stat-grid" style={{ marginTop: '0.8rem' }}>
                <div className="stat-card">
                    <div className="stat-label">Omsetning</div>
                    <div className="stat-value">{formatNok(goal.actualRevenue)}</div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: revenuePct + '%' }} /></div>
                    <div className="muted" style={{ fontSize: '0.65rem', marginTop: 2 }}>
                        {Math.round(revenuePct)}% av {formatNok(goal.revenueTarget || 0)}
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Salg</div>
                    <div className="stat-value">{goal.actualSales}</div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: salesPct + '%' }} /></div>
                    <div className="muted" style={{ fontSize: '0.65rem', marginTop: 2 }}>
                        {Math.round(salesPct)}% av {goal.salesTarget || 0}
                    </div>
                </div>
            </div>

            <h3 className="section-title">Provisjon og bonuspool</h3>
            <div className="card" style={{ padding: '0.7rem 0.8rem' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted" style={{ fontSize: '0.78rem' }}>Total provisjon perioden</span>
                    <span style={{ fontWeight: 600 }}>{formatNok(goal.actualCommission)}</span>
                </div>
                <hr className="hr" />
                <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted" style={{ fontSize: '0.78rem' }}>Til selskapet ({goal.floorPct}%)</span>
                    <span>{formatNok(goal.floorAmount)}</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted" style={{ fontSize: '0.78rem' }}>Bonus-pool</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{formatNok(goal.bonusPool)}</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted" style={{ fontSize: '0.78rem' }}>Allerede tildelt (utestaende)</span>
                    <span>{formatNok(allocated)}</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted" style={{ fontSize: '0.78rem' }}>Ikke fordelt</span>
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>{formatNok(remaining)}</span>
                </div>
            </div>

            <h3 className="section-title">Selgere</h3>
            {earners.length === 0 && <div className="empty">Ingen ansatte i kontoret.</div>}
            {earners.map((e) => (
                <div key={e.id} className="card" style={{ padding: '0.7rem 0.8rem', marginBottom: '0.5rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                            <div style={{ fontWeight: 500 }}>{e.name || e.tlfnr}</div>
                            <div className="meta" style={{ fontSize: '0.72rem' }}>{e.role}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 600, color: 'var(--gold)' }}>{formatNok(e.commission)}</div>
                            <div className="meta" style={{ fontSize: '0.7rem' }}>{e.sales} salg</div>
                        </div>
                    </div>
                    {e.outstanding > 0 && (
                        <div className="muted" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                            Utestaende bonus: {formatNok(e.outstanding)}
                        </div>
                    )}
                    <button className="btn btn-ghost btn-block" style={{ marginTop: '0.4rem', padding: '0.4rem' }}
                        onClick={() => { setPayoutFor(e); setPayoutAmount(''); setPayoutNote('') }}>
                        Tildel bonus
                    </button>
                </div>
            ))}

            {payoutFor && (
                <div className="modal-backdrop" onClick={() => setPayoutFor(null)}>
                    <div className="modal" onClick={(ev) => ev.stopPropagation()}>
                        <h3>Bonus til {payoutFor.name || payoutFor.tlfnr}</h3>
                        <p className="muted" style={{ fontSize: '0.78rem' }}>
                            Tilgjengelig pool: {formatNok(remaining)}
                        </p>
                        <input className="input" inputMode="numeric" placeholder="Belop (kr)"
                            value={payoutAmount} onChange={(ev) => setPayoutAmount(ev.target.value)} />
                        <div style={{ height: 6 }} />
                        <input className="input" placeholder="Notat (valgfri)"
                            value={payoutNote} onChange={(ev) => setPayoutNote(ev.target.value)} />
                        <div style={{ height: 10 }} />
                        <button className="btn btn-gold btn-block" onClick={submitPayout}>Tildel</button>
                        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }}
                            onClick={() => setPayoutFor(null)}>Avbryt</button>
                    </div>
                </div>
            )}
        </div>
    )
}
