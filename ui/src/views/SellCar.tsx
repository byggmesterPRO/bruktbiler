import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'

const TYPE_OPTIONS = [
    {
        value: 'consignment_in_shop',
        label: 'Konsignasjon hos forhandler',
        desc: 'Vi tar bilen inn og selger den. Vi tar provisjon ved salg.',
    },
    {
        value: 'consignment_remote',
        label: 'Privat med visning hos deg',
        desc: 'Vi annonserer bilen, du har den selv og holder visning.',
    },
    {
        value: 'private',
        label: 'Privat salg',
        desc: 'Du legger ut bilen som privatperson, uten forhandler.',
    },
] as const

type MyCar = {
    id: number; make: string; model: string; year: number; price: number;
    status: string; approved: boolean; listingType: string;
}

export default function SellCar() {
    const [view, setView] = useState<'choose' | 'form' | 'mine'>('mine')
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
    const [mine, setMine] = useState<MyCar[]>([])

    const loadMine = () =>
        api<MyCar[]>('listMyListings', { token: getToken() }).then((res) => {
            if (res.ok) setMine(res.data)
        })

    useEffect(() => { loadMine() }, [])

    const submit = async () => {
        setError(null)
        if (!make || !model || !year || !price) {
            setError('Fyll inn alle felt'); return
        }
        const res = await api('submitListing', {
            token: getToken(), listingType: type, make, model,
            year: parseInt(year, 10), price: parseInt(price, 10),
            mileage: parseInt(mileage || '0', 10), image, description,
        })
        if (res.ok) {
            setSuccess('Annonse sendt! Den vises etter godkjenning.')
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
                <h2 className="section-title" style={{ marginTop: 0 }}>Ny annonse</h2>
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
                <label className="label">Pris (kr)</label>
                <input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
                <label className="label">Bilde-URL</label>
                <input className="input" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." />
                <label className="label">Beskrivelse</label>
                <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />

                {error && <div className="error-banner">{error}</div>}
                {success && <div className="success-banner">{success}</div>}

                <div style={{ height: 12 }} />
                <button className="btn btn-gold btn-block" onClick={submit}>Send inn for godkjenning</button>
            </div>
        )
    }

    return (
        <div>
            <button className="btn btn-gold btn-block" onClick={() => setView('choose')}>+ Selg en bil</button>
            <div style={{ height: 14 }} />
            <h2 className="section-title" style={{ marginTop: 0 }}>Mine annonser</h2>
            {mine.length === 0 && <div className="empty">Du har ingen annonser enda.</div>}
            {mine.map((c) => (
                <div key={c.id} className="card list-row" style={{ marginBottom: '0.4rem' }}>
                    <div>
                        <div style={{ fontWeight: 500 }}>{c.make} {c.model} ({c.year})</div>
                        <div className="meta">{formatNok(c.price)}</div>
                    </div>
                    <div>
                        {c.status === 'pending' && <span className="tag tag-grey">Venter</span>}
                        {c.status === 'available' && <span className="tag tag-green">Aktiv</span>}
                        {c.status === 'sold' && <span className="tag">Solgt</span>}
                        {c.status === 'auction' && <span className="tag tag-blue">Auksjon</span>}
                        {c.status === 'withdrawn' && <span className="tag tag-red">Trukket</span>}
                    </div>
                </div>
            ))}
        </div>
    )
}
