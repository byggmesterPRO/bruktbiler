import { useEffect, useState } from 'react'
import { api } from '../api'
import { getToken } from '../auth'

type Setting = { key: string; value: string }

const LABELS: Record<string, { label: string; desc: string }> = {
    transfer_fee: { label: 'Overforingsgebyr (kr)', desc: 'Trekkes fra kjoper i tillegg til prisen.' },
    default_commission_pct: { label: 'Default provisjon (%)', desc: 'Brukes som standard for nye kontor og listings.' },
    auction_increment_min: { label: 'Min. budokning (kr)', desc: 'Minste tillatte okning over hoyeste bud.' },
    enable_p2p_chat: { label: 'Aktivert chat (1/0)', desc: 'Kjoper-selger direktechat pa annonser.' },
}

export default function Settings() {
    const [settings, setSettings] = useState<Setting[]>([])
    const [msg, setMsg] = useState<string | null>(null)

    const load = () =>
        api<Setting[]>('adminGetSettings', { token: getToken() }).then((res) => {
            if (res.ok) setSettings(res.data)
        })
    useEffect(() => { load() }, [])

    const update = async (key: string, value: string) => {
        await api('adminSetSetting', { token: getToken(), key, value })
        setMsg('Lagret'); setTimeout(() => setMsg(null), 1200)
    }

    return (
        <div>
            <h2 className="section-title" style={{ marginTop: 0 }}>Innstillinger</h2>
            {msg && <div className="success-banner">{msg}</div>}
            {settings.map((s) => {
                const meta = LABELS[s.key] || { label: s.key, desc: '' }
                return (
                    <div key={s.key} className="card" style={{ padding: '0.7rem 0.8rem', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 500 }}>{meta.label}</div>
                        {meta.desc && <div className="muted" style={{ fontSize: '0.74rem', marginTop: 2 }}>{meta.desc}</div>}
                        <input className="input" style={{ marginTop: '0.4rem' }} value={s.value}
                            onChange={(e) => setSettings((arr) => arr.map((x) => x.key === s.key ? { ...x, value: e.target.value } : x))}
                            onBlur={(e) => update(s.key, e.target.value)} />
                    </div>
                )
            })}
        </div>
    )
}
