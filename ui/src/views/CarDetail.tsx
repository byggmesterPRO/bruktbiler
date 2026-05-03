import { useEffect, useState } from 'react'
import { api, formatNok, formatKm } from '../api'
import { getToken } from '../auth'

type Bid = { amount: number; tlfnr: string; created_at: string }
type Car = {
    id: number; make: string; model: string; year: number; price: number;
    mileage: number; image: string; description: string; status: string;
    listingType: string; sellerTlfnr?: string | null;
    transferFee?: number;
    assignedOfficeName?: string | null; assignedSellerTlfnr?: string | null;
    auction?: {
        id: number; startPrice: number; currentBid: number;
        currentBidderId: number | null; endsAt: string; status: string;
        bids: Bid[];
    }
}

const PLACEHOLDER = 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=900'
const TYPE_LABEL: Record<string, string> = {
    dealership: 'Solgt av forhandler',
    consignment_in_shop: 'Konsignasjon hos forhandler',
    consignment_remote: 'Privat — visning hos selger',
    private: 'Privatperson',
}

function timeLeft(endsAt: string): string {
    const ms = new Date(endsAt).getTime() - Date.now()
    if (ms <= 0) return 'Utlopt'
    const s = Math.floor(ms / 1000)
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (d > 0) return `${d}d ${h}t ${m}m`
    if (h > 0) return `${h}t ${m}m ${sec}s`
    return `${m}m ${sec}s`
}

export default function CarDetail({ id, onBack }: { id: number; onBack: () => void }) {
    const [car, setCar] = useState<Car | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [showInterest, setShowInterest] = useState(false)
    const [showBid, setShowBid] = useState(false)
    const [interestMsg, setInterestMsg] = useState('')
    const [bidAmount, setBidAmount] = useState('')
    const [now, setNow] = useState(Date.now())

    const load = () =>
        api<Car>('getCar', { token: getToken(), id }).then((res) => {
            if (res.ok) setCar(res.data)
            else setError(res.error)
        })

    useEffect(() => { load() }, [id])
    useEffect(() => {
        if (!car?.auction) return
        const t = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(t)
    }, [car?.auction])

    if (error) return <div className="error-banner">{error}</div>
    if (!car) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

    const submitInterest = async () => {
        const res = await api('expressInterest', {
            token: getToken(), carId: car.id, message: interestMsg
        })
        if (res.ok) {
            setSuccess('Interesse registrert!')
            setShowInterest(false); setInterestMsg('')
            setTimeout(() => setSuccess(null), 2500)
        } else setError(res.error)
    }

    const submitBid = async () => {
        const amount = parseInt(bidAmount, 10)
        if (!car.auction) return
        if (!amount || amount <= car.auction.currentBid) {
            setError('Budet ma vaere over ' + formatNok(car.auction.currentBid))
            return
        }
        const res = await api('placeBid', {
            token: getToken(), auctionId: car.auction.id, amount
        })
        if (res.ok) {
            setSuccess('Bud lagt inn!')
            setShowBid(false); setBidAmount('')
            await load()
            setTimeout(() => setSuccess(null), 2500)
        } else setError(res.error)
    }

    return (
        <div>
            <div className="row" style={{ alignItems: 'center', marginBottom: '0.5rem' }}>
                <button className="btn btn-ghost" onClick={onBack} style={{ padding: '0.4rem 0.7rem' }}>← Tilbake</button>
            </div>

            <img className="detail-hero" src={car.image || PLACEHOLDER}
                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER }} alt="" />

            <div className="row" style={{ alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                {car.status === 'auction' && <span className="tag tag-blue">Auksjon</span>}
                <span className="tag">{TYPE_LABEL[car.listingType] || 'Bil'}</span>
            </div>

            <h1 className="detail-title">{car.make} {car.model}</h1>
            <p className="detail-sub">{car.year} • {formatKm(car.mileage)}</p>

            <div className="detail-price">{formatNok(car.price)}</div>

            <div className="spec-grid">
                <div className="spec"><div className="spec-label">Arsmodell</div><div className="spec-value">{car.year}</div></div>
                <div className="spec"><div className="spec-label">Km</div><div className="spec-value">{formatKm(car.mileage)}</div></div>
                <div className="spec"><div className="spec-label">Type</div><div className="spec-value">{TYPE_LABEL[car.listingType]}</div></div>
                {car.sellerTlfnr && (
                    <div className="spec"><div className="spec-label">Selger</div><div className="spec-value">{car.sellerTlfnr}</div></div>
                )}
            </div>

            {car.auction && (
                <div className="auction-box">
                    <div className="auction-row">
                        <div>
                            <div className="muted" style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Hoyeste bud</div>
                            <div className="auction-bid">{formatNok(car.auction.currentBid)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div className="muted" style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Tid igjen</div>
                            <div className="auction-time">{timeLeft(car.auction.endsAt)}</div>
                            <div style={{ display: 'none' }}>{now}</div>
                        </div>
                    </div>
                    <button className="btn btn-gold btn-block" style={{ marginTop: '0.7rem' }}
                        onClick={() => setShowBid(true)}>By pa bilen</button>
                    {car.auction.bids?.length > 0 && (
                        <div className="bid-list">
                            {car.auction.bids.map((b, i) => (
                                <div key={i} className="bid-row">
                                    <span>{b.tlfnr}</span>
                                    <span className="muted">{formatNok(b.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <h3 className="section-title">Beskrivelse</h3>
            <p className="description">{car.description || 'Ingen beskrivelse.'}</p>

            <div style={{ height: 20 }} />
            <button className="btn btn-gold btn-block" onClick={() => setShowInterest(true)}>Vis interesse</button>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={async () => {
                await api('openThread', { token: getToken(), carId: car.id })
                setSuccess('Samtale apnet — gå til Mine → Samtaler')
                setTimeout(() => setSuccess(null), 2500)
            }}>Chat med selger</button>
            {car.transferFee && car.transferFee > 0 && (
                <p className="muted" style={{ fontSize: '0.72rem', textAlign: 'center', marginTop: 8 }}>
                    Overforingsgebyr: {formatNok(car.transferFee)} (betales av kjoper)
                </p>
            )}

            {success && <div className="success-banner">{success}</div>}
            {error && <div className="error-banner">{error}</div>}

            {showInterest && (
                <div className="modal-backdrop" onClick={() => setShowInterest(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Send melding</h3>
                        <p className="muted" style={{ fontSize: '0.8rem' }}>Selger far telefonnummeret ditt og meldingen.</p>
                        <textarea className="input" rows={4} value={interestMsg}
                            onChange={(e) => setInterestMsg(e.target.value)}
                            placeholder="Hei, jeg er interessert i bilen..." />
                        <div style={{ height: 10 }} />
                        <button className="btn btn-gold btn-block" onClick={submitInterest}>Send</button>
                        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setShowInterest(false)}>Avbryt</button>
                    </div>
                </div>
            )}

            {showBid && car.auction && (
                <div className="modal-backdrop" onClick={() => setShowBid(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Legg inn bud</h3>
                        <p className="muted" style={{ fontSize: '0.8rem' }}>Hoyeste bud: {formatNok(car.auction.currentBid)}</p>
                        <input className="input" type="number" inputMode="numeric"
                            value={bidAmount} onChange={(e) => setBidAmount(e.target.value)}
                            placeholder="Bud i kr" />
                        <div style={{ height: 10 }} />
                        <button className="btn btn-gold btn-block" onClick={submitBid}>Bekreft bud</button>
                        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setShowBid(false)}>Avbryt</button>
                    </div>
                </div>
            )}
        </div>
    )
}
