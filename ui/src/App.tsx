import { ReactNode, useEffect, useState } from 'react'
import { useAuth } from './auth'
import Auth from './views/Auth'
import Cars from './views/Cars'
import CarDetail from './views/CarDetail'
import MyInterests from './views/MyInterests'
import SellCar from './views/SellCar'
import Admin from './views/Admin'
import Frame from './components/Frame'

const devMode = !(window as any)?.invokeNative

type View = 'cars' | 'car' | 'interests' | 'sell' | 'admin'

function Shell() {
    const { me, loading, login, register, logout } = useAuth()
    const [view, setView] = useState<View>('cars')
    const [carId, setCarId] = useState<number | null>(null)

    if (loading) {
        return (
            <div className="app">
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner" />
                </div>
            </div>
        )
    }

    if (!me) {
        return (
            <div className="app">
                <Auth onLogin={login} onRegister={register} />
            </div>
        )
    }

    const openCar = (id: number) => { setCarId(id); setView('car') }
    const back = () => setView('cars')

    return (
        <div className="app">
            <div className="top-bar">
                <div>
                    <div className="app-title" style={{ fontSize: '1.4rem' }}>Bruktbiler</div>
                    <div className="muted" style={{ fontSize: '0.7rem' }}>Logget inn som {me.tlfnr}</div>
                </div>
                <button className="icon-btn" title="Logg ut" onClick={logout}>↪</button>
            </div>

            <div className="app-body">
                {view === 'cars' && <Cars onOpen={openCar} />}
                {view === 'car' && carId !== null && <CarDetail id={carId} onBack={back} />}
                {view === 'interests' && <MyInterests onOpen={openCar} />}
                {view === 'sell' && <SellCar />}
                {view === 'admin' && me.isAdmin && <Admin />}
            </div>

            <BottomNav view={view} setView={(v) => { setView(v); setCarId(null) }} isAdmin={me.isAdmin} />
        </div>
    )
}

function BottomNav({ view, setView, isAdmin }: { view: View; setView: (v: View) => void; isAdmin: boolean }) {
    const item = (id: View, icon: string, label: string) => (
        <button className={view === id || (id === 'cars' && view === 'car') ? 'active' : ''} onClick={() => setView(id)}>
            <span className="icon">{icon}</span>
            <span>{label}</span>
        </button>
    )
    return (
        <div className="bottom-nav">
            {item('cars', '🚗', 'Biler')}
            {item('sell', '➕', 'Selg')}
            {item('interests', '★', 'Mine')}
            {isAdmin && item('admin', '⚙', 'Admin')}
        </div>
    )
}

export default function App() {
    useEffect(() => {
        document.body.style.visibility = 'visible'
    }, [])

    if (devMode) {
        return (
            <DevWrapper>
                <Shell />
            </DevWrapper>
        )
    }
    return <Shell />
}

function DevWrapper({ children }: { children: ReactNode }) {
    useEffect(() => {
        const handleResize = () => {
            const { innerWidth, innerHeight } = window
            const aspectRatio = innerWidth / innerHeight
            const phoneAspectRatio = 27.6 / 59
            if (phoneAspectRatio < aspectRatio) document.documentElement.style.fontSize = '1.66vh'
            else document.documentElement.style.fontSize = '3.4vw'
        }
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])
    return (
        <div className="dev-wrapper">
            <Frame>{children}</Frame>
        </div>
    )
}
