import { useEffect, useState } from 'react'
import { api, formatNok, formatKm } from '../api'
import { getToken } from '../auth'
import { popUp, startCall, shareCar, formatPhoneNumber, takePhoto, pickFromGallery } from '../lbphone'
import { IconStar } from '../components/Icon'

type Bid = { amount: number; tlfnr: string; created_at: string }
type Car = {
    id: number; make: string; model: string; year: number; price: number;
    mileage: number; image: string; description: string; status: string;
    listingType: string; sellerTlfnr?: string | null;
    transferFee?: number;
    images?: { id: number; url: string }[];
    wishlisted?: boolean;
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
    const [showOffer, setShowOffer] = useState(false)
    const [interestMsg, setInterestMsg] = useState('')
    const [bidAmount, setBidAmount] = useState('')
    const [offerAmount, setOfferAmount] = useState('')
    const [offerMessage, setOfferMessage] = useState('')
    const [activeImage, setActiveImage] = useState(0)
    const [now, setNow] = useState(Date.now())
    const [wishlisted, setWishlisted] = useState(false)

    const load = () =>
        api<Car>('getCar', { token: getToken(), id }).then((res) => {
            if (res.ok) {
                setCar(res.data)
                setWishlisted(!!res.data.wishlisted)
            }
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
            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <button className="btn btn-ghost" onClick={onBack} style={{ padding: '0.4rem 0.7rem' }}>← Tilbake</button>
                <button className="icon-btn" title={wishlisted ? 'Fjern fra ønskeliste' : 'Legg i ønskeliste'}
                    onClick={async () => {
                        const res = await api<{ saved: boolean }>('toggleWishlist', { token: getToken(), carId: car.id })
                        if (res.ok) setWishlisted(res.data.saved)
                    }}
                    style={{ color: wishlisted ? 'var(--gold)' : 'var(--text-faint)' }}>
                    <IconStar width={18} height={18} fill={wishlisted ? 'currentColor' : 'none'} />
                </button>
            </div>

            <Gallery main={car.image || PLACEHOLDER} extra={(car.images || []).map((i) => i.url)}
                active={activeImage} onSelect={setActiveImage} />

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
                {car.assignedSellerTlfnr && (
                    <div className="spec">
                        <div className="spec-label">Ansvarlig selger</div>
                        <div className="spec-value">{formatPhoneNumber(car.assignedSellerTlfnr)}</div>
                    </div>
                )}
                {car.sellerTlfnr && !car.assignedSellerTlfnr && (
                    <div className="spec">
                        <div className="spec-label">Eier</div>
                        <div className="spec-value">{formatPhoneNumber(car.sellerTlfnr)}</div>
                    </div>
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

            <OffersPanel carId={car.id} />


            <div style={{ height: 20 }} />
            <button className="btn btn-gold btn-block" onClick={() => setShowOffer(true)}>Send tilbud</button>
            <button className="btn btn-block" style={{ marginTop: 8 }} onClick={() => setShowInterest(true)}>Vis interesse</button>
            <div className="row" style={{ gap: '0.4rem', marginTop: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={async () => {
                    await api('openThread', { token: getToken(), carId: car.id })
                    setSuccess('Samtale apnet — ga til Mine → Samtaler')
                    setTimeout(() => setSuccess(null), 2500)
                }}>Chat</button>
                {car.assignedSellerTlfnr && (
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => {
                        popUp({
                            title: 'Ring selger',
                            description: `${formatPhoneNumber(car.assignedSellerTlfnr!)}`,
                            buttons: [
                                { title: 'Avbryt', color: 'red' },
                                { title: 'Ring', color: 'blue', cb: () => startCall(car.assignedSellerTlfnr!) },
                            ],
                        })
                    }}>Ring selger</button>
                )}
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => shareCar(car)}>Del</button>
            </div>
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

            {showOffer && (
                <div className="modal-backdrop" onClick={() => setShowOffer(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Send tilbud</h3>
                        <p className="muted" style={{ fontSize: '0.78rem' }}>Foresporres pris: {formatNok(car.price)}</p>
                        <input className="input" type="number" inputMode="numeric"
                            value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)}
                            placeholder="Tilbudssum (kr)" />
                        <div style={{ height: 6 }} />
                        <textarea className="input" rows={3}
                            value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)}
                            placeholder="Begrunnelse (valgfritt)" />
                        <div style={{ height: 10 }} />
                        <button className="btn btn-gold btn-block" onClick={async () => {
                            const amount = parseInt(offerAmount, 10)
                            if (!amount || amount <= 0) { setError('Ugyldig sum'); return }
                            const res = await api('createOffer', {
                                token: getToken(), carId: car.id, amount, message: offerMessage,
                            })
                            if (res.ok) {
                                setSuccess('Tilbud sendt!')
                                setShowOffer(false); setOfferAmount(''); setOfferMessage('')
                                setTimeout(() => setSuccess(null), 2500)
                            } else setError(res.error)
                        }}>Send tilbud</button>
                        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }}
                            onClick={() => setShowOffer(false)}>Avbryt</button>
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

function OffersPanel({ carId }: { carId: number }) {
    const [offers, setOffers] = useState<any[]>([])
    const [counter, setCounter] = useState<{ id: number; amount: string } | null>(null)

    const load = () =>
        api('listOffersForCar', { token: getToken(), carId }).then((res) => {
            if (res.ok) setOffers(res.data)
        })
    useEffect(() => { load() }, [carId])

    const respond = async (id: number, action: 'accept' | 'reject' | 'counter', amount?: number) => {
        const res = await api('respondToOffer', {
            token: getToken(), offerId: id, action, amount,
        })
        if (res.ok) { setCounter(null); await load() }
    }

    if (offers.length === 0) return null
    return (
        <div style={{ marginTop: '1rem' }}>
            <h3 className="section-title">Tilbud ({offers.length})</h3>
            {offers.map((o) => (
                <div key={o.id} className="card" style={{ padding: '0.6rem 0.8rem', marginBottom: '0.4rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                            <div style={{ fontWeight: 500, color: 'var(--gold)' }}>{formatNok(o.amount)}</div>
                            <div className="meta" style={{ fontSize: '0.72rem' }}>
                                {o.buyer_name || o.buyer_tlfnr} · {o.status}
                            </div>
                        </div>
                        {o.status === 'pending' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <button className="btn btn-gold" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => respond(o.id, 'accept')}>Godta</button>
                                <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => setCounter({ id: o.id, amount: '' })}>Mottilbud</button>
                                <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => respond(o.id, 'reject')}>Avvis</button>
                            </div>
                        )}
                    </div>
                    {o.message && <div style={{ fontSize: '0.78rem', marginTop: 4, color: 'var(--text-dim)' }}>"{o.message}"</div>}
                    {counter?.id === o.id && (
                        <div className="row" style={{ marginTop: '0.5rem', gap: '0.4rem' }}>
                            <input className="input" placeholder="Mottilbud (kr)" inputMode="numeric"
                                value={counter.amount}
                                onChange={(e) => setCounter({ id: o.id, amount: e.target.value })} />
                            <button className="btn btn-gold" style={{ padding: '0.4rem 0.7rem' }}
                                onClick={() => {
                                    const amt = parseInt(counter.amount, 10)
                                    if (amt > 0) respond(o.id, 'counter', amt)
                                }}>OK</button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

function Gallery({ main, extra, active, onSelect }: {
    main: string; extra: string[]; active: number; onSelect: (i: number) => void
}) {
    const all = [main, ...extra]
    const cur = all[Math.min(active, all.length - 1)] || main
    return (
        <div>
            <img className="detail-hero" src={cur}
                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER }} alt="" />
            {all.length > 1 && (
                <div className="thumb-strip">
                    {all.map((u, i) => (
                        <img key={i} src={u} className={'thumb' + (i === active ? ' active' : '')}
                            onClick={() => onSelect(i)} alt="" />
                    ))}
                </div>
            )}
        </div>
    )
}
