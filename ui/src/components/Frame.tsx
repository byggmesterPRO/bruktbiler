import { ReactNode, useEffect, useState } from 'react'

const frameStyle: React.CSSProperties = {
    width: '380px',
    height: '820px',
    background: '#000',
    borderRadius: '46px',
    border: '8px solid #1a1a1f',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
}

const notchStyle: React.CSSProperties = {
    position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
    width: 110, height: 26, background: '#000', borderRadius: 14, zIndex: 10,
}

export default function Frame({ children }: { children: ReactNode }) {
    const [time, setTime] = useState('00:00')
    useEffect(() => {
        const t = setInterval(() => {
            const d = new Date()
            setTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`)
        }, 1000)
        return () => clearInterval(t)
    }, [])

    return (
        <div style={frameStyle}>
            <div style={notchStyle} />
            <div style={{ position: 'absolute', top: 14, left: 30, color: '#fff', fontSize: 12, fontWeight: 500, zIndex: 11 }}>{time}</div>
            <div style={{ width: '100%', height: '100%' }}>{children}</div>
        </div>
    )
}
