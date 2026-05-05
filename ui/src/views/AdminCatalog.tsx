import { useEffect, useState } from 'react'
import { api, formatNok } from '../api'
import { getToken } from '../auth'
import { takePhoto, pickFromGallery } from '../lbphone'

type Model = {
    id: number; firma: string; make: string; model: string; variant: string | null;
    new_price: number; image: string; description: string; active: number;
}

export default function AdminCatalog() {
    const [models, setModels] = useState<Model[]>([])
    const [editing, setEditing] = useState<Partial<Model> | null>(null)
    const [msg, setMsg] = useState<string | null>(null)

    const load = () =>
        api<Model[]>('adminListCatalog', { token: getToken() }).then((res) => {
            if (res.ok) setModels(res.data)
        })
    useEffect(() => { load() }, [])

    const save = async () => {
        if (!editing) return
        const res = await api('adminUpsertCatalog', {
            token: getToken(), id: editing.id,
            firma: editing.firma, make: editing.make, model: editing.model,
            variant: editing.variant, newPrice: editing.new_price,
            image: editing.image, description: editing.description,
        })
        if (res.ok) { setMsg('Lagret'); setEditing(null); await load() }
        else setMsg(res.error)
        setTimeout(() => setMsg(null), 1800)
    }
    const del = async (id: number) => {
        await api('adminDeleteCatalog', { token: getToken(), id })
        await load(); setMsg('Slettet')
        setTimeout(() => setMsg(null), 1500)
    }

    if (editing) {
        return (
            <div>
                <button className="btn btn-ghost" onClick={() => setEditing(null)} style={{ padding: '0.4rem 0.7rem' }}>← Tilbake</button>
                <h3 className="section-title">{editing.id ? 'Rediger modell' : 'Ny modell'}</h3>
                <label className="label">Firma / forhandler</label>
                <input className="input" value={editing.firma || ''} placeholder="Gubbens / Nordic / ..."
                    onChange={(e) => setEditing({ ...editing, firma: e.target.value })} />
                <label className="label">Merke</label>
                <input className="input" value={editing.make || ''}
                    onChange={(e) => setEditing({ ...editing, make: e.target.value })} placeholder="Audi" />
                <label className="label">Modell</label>
                <input className="input" value={editing.model || ''}
                    onChange={(e) => setEditing({ ...editing, model: e.target.value })} placeholder="RS6 Avant" />
                <label className="label">Variant (valgfri)</label>
                <input className="input" value={editing.variant || ''}
                    onChange={(e) => setEditing({ ...editing, variant: e.target.value })} placeholder="Performance / S Line" />
                <label className="label">Nypris (kr)</label>
                <input className="input" inputMode="numeric" value={editing.new_price || ''}
                    onChange={(e) => setEditing({ ...editing, new_price: parseInt(e.target.value, 10) || 0 })} />
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
                <label className="label">Beskrivelse</label>
                <textarea className="input" rows={3} value={editing.description || ''}
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
            <button className="btn btn-gold btn-block" onClick={() => setEditing({})}>+ Ny modell</button>
            {msg && <div className="success-banner">{msg}</div>}
            <div style={{ height: 10 }} />
            {models.length === 0 && <div className="empty">Ingen modeller i katalogen.</div>}
            {models.map((m) => (
                <div key={m.id} className="card list-row" onClick={() => setEditing(m)} role="button" style={{ marginBottom: '0.4rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>{m.make} {m.model} {m.variant && <span className="muted" style={{ fontWeight: 400 }}>· {m.variant}</span>}</div>
                        <div className="meta">{m.firma} · {formatNok(m.new_price)}</div>
                    </div>
                    <span className="muted">›</span>
                </div>
            ))}
        </div>
    )
}
