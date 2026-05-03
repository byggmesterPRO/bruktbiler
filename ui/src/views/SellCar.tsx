import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'
import { takePhoto, pickFromGallery } from '../lbphone'

const TYPE_OPTIONS = [
    {
        value: 'consignment_in_shop',
        label: 'Konsignasjon hos forhandler',
        desc: 'Vi tar bilen inn pa forhandlertomten og selger den. Provisjon ved salg.',
    },
    {
        value: 'consignment_remote',
        label: 'Privat med visning hos deg',
        desc: 'Vi annonserer bilen, du har den selv og holder visning. Provisjon ved salg.',
    },
] as const

type SellReq = {
    id: number; make: string; model: string; year: number; expected_price: number;
    status: string; listing_type: string; created_at: string;
    office_name?: string | null; seller_tlfnr?: string | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    pending:  { label: 'Venter pa selger', cls: 'tag-grey' },
    assigned: { label: 'Selger tildelt',   cls: 'tag-blue' },
    listed:   { label: 'Lagt ut',          cls: 'tag-green' },
    closed:   { label: 'Ferdig',           cls: 'tag' },
    rejected: { label: 'Avvist',           cls: 'tag-red' },
}

export default function SellCar() {
    const [view, setView] = useState<'mine' | 'choose' | 'form'>('mine')
    const [type, setType] = useState<string | null>(null)
    const [make, setMake] = useState('')
    const [model, setModel] = useState('')
    const [year, setYear] = useState('')
    const [price, setPrice] = useState('')
    const [mileage, setMileage] = useState('')
    const [image, setImage] = useState('')
    const [description, setDescription] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [mine, setMine] = useState<SellReq[]>([])

    const loadMine = () =>
        api<SellReq[]>('listMySellRequests', { token: getToken() }).then((res) => {
            if (res.ok) setMine(res.data)
        })

    useEffect(() => { loadMine() }, [])

    const submit = async () => {
        setError(null)
        if (!make || !model || !year || !price) {
            setError('Fyll inn alle felt'); return
        }
        const res = await api('submitSellRequest', {
            token: getToken(), listingType: type, make, model,
            year: parseInt(year, 10), expectedPrice: parseInt(price, 10),
            mileage: parseInt(mileage || '0', 10), image, description,
        })
        if (res.ok) {
            setSuccess('Forespørsel sendt! En selger vil kontakte deg.')
            setMake(''); setModel(''); setYear(''); setPrice(''); setMileage(''); setImage(''); setDescription('')
            await loadMine()
            setTimeout(() => { setSuccess(null); setView('mine') }, 1500)
        } else setError(res.error)
    }

    if (view === 'choose') {
        return (
            <div>
                <button className="btn btn-ghost" onClick={() => setView('mine')} style={{ padding: '0.4rem 0.7rem', marginBottom: '0.6rem' }}>← Tilbake</button>
                <h2 className="section-title" style={{ marginTop: 0 }}>Hvordan vil du selge?</h2>
                <p className="muted" style={{ fontSize: '0.78rem', marginTop: 0 }}>
                    Begge alternativer involverer en selger fra et av vare kontorer som handterer kontakten med interesserte.
                </p>
                <div className="col">
                    {TYPE_OPTIONS.map((o) => (
                        <div key={o.value} className="card" style={{ padding: '0.9rem', cursor: 'pointer' }}
                            onClick={() => { setType(o.value); setView('form') }}>
                            <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '1rem' }}>{o.label}</div>
                            <div className="muted" style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>{o.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (view === 'form') {
        const opt = TYPE_OPTIONS.find((o) => o.value === type)
        return (
            <div>
                <button className="btn btn-ghost" onClick={() => setView('choose')} style={{ padding: '0.4rem 0.7rem', marginBottom: '0.6rem' }}>← Tilbake</button>
                <h2 className="section-title" style={{ marginTop: 0 }}>Ny forespørsel</h2>
                <p className="muted" style={{ fontSize: '0.78rem' }}>{opt?.label}</p>

                <label className="label">Merke</label>
                <input className="input" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Audi" />
                <label className="label">Modell</label>
                <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="A4" />
                <div className="row">
                    <div style={{ flex: 1 }}>
                        <label className="label">Arsmodell</label>
                        <input className="input" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label className="label">Km</label>
                        <input className="input" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="50000" />
                    </div>
                </div>
                <label className="label">Onsket pris (kr)</label>
                <input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
                <label className="label">Bilde av bilen</label>
                {image && (
                    <img src={image} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 6, objectFit: 'cover', maxHeight: 160 }} />
                )}
                <div className="row" style={{ gap: '0.4rem' }}>
                    <button className="btn btn-ghost" style={{ flex: 1, padding: '0.5rem' }}
                        onClick={async () => { const r = await takePhoto(); if (r) setImage(r.url) }}>
                        Ta bilde
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1, padding: '0.5rem' }}
                        onClick={async () => { const r = await pickFromGallery(); if (r) setImage(r.url) }}>
                        Velg fra galleri
                    </button>
                </div>
                <label className="label">Beskrivelse</label>
                <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />

                {error && <div className="error-banner">{error}</div>}
                {success && <div className="success-banner">{success}</div>}

                <div style={{ height: 12 }} />
                <button className="btn btn-gold btn-block" onClick={submit}>Send forespørsel</button>
            </div>
        )
    }

    return (
        <div>
            <button className="btn btn-gold btn-block" onClick={() => setView('choose')}>+ Selg en bil</button>
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.7rem' }}>
                Send en forespørsel sa kontakter en av vare selgere deg.
            </p>
            <h2 className="section-title">Mine forespørsler</h2>
            {mine.length === 0 && <div className="empty">Du har ikke sendt noen forespørsler enda.</div>}
            {mine.map((r) => {
                const s = STATUS_LABEL[r.status] || { label: r.status, cls: 'tag-grey' }
                return (
                    <div key={r.id} className="card" style={{ padding: '0.7rem 0.8rem', marginBottom: '0.5rem' }}>
                        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 500 }}>{r.make} {r.model} ({r.year})</div>
                            <span className={'tag ' + s.cls}>{s.label}</span>
                        </div>
                        <div className="muted" style={{ fontSize: '0.74rem', marginTop: '0.2rem' }}>
                            Onsket pris: {formatNok(r.expected_price)}
                            {r.seller_tlfnr && <> · Selger: {r.seller_tlfnr}</>}
                            {r.office_name && <> · {r.office_name}</>}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
