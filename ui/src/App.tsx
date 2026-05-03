import { ReactNode, useEffect, useState } from 'react'
import { useAuth } from './auth'
import { api } from './api'
import { getToken } from './auth'
import Auth from './views/Auth'
import Cars from './views/Cars'
import CarDetail from './views/CarDetail'
import MyInterests from './views/MyInterests'
import SellCar from './views/SellCar'
import SellerWork from './views/SellerWork'
import Admin from './views/Admin'
import Inbox from './views/Inbox'
import Chat from './views/Chat'
import Wishlist from './views/Wishlist'
import PriceAlerts from './views/PriceAlerts'
import MyOffers from './views/MyOffers'
import Earnings from './views/Earnings'
import ValueEstimate from './views/ValueEstimate'
import MyFinancing from './views/MyFinancing'
import Frame from './components/Frame'
import {
    IconCar, IconHandshake, IconStar, IconChat, IconBell, IconSettings, IconLogout,
} from './components/Icon'

const devMode = !(window as any)?.invokeNative

type View = 'cars' | 'car' | 'sell' | 'mine' | 'inbox' | 'chat' | 'admin'

function Shell() {
    const { me, loading, login, register, logout } = useAuth()
    const [view, setView] = useState<View>('cars')
    const [carId, setCarId] = useState<number | null>(null)
    const [mineTab, setMineTab] = useState<'wishlist' | 'offers' | 'finance' | 'interests' | 'threads' | 'alerts' | 'earnings'>('wishlist')
    const [unread, setUnread] = useState(0)

    useEffect(() => {
        if (!me) return
        const tick = () => api<number>('unreadCount', { token: getToken() }).then((r) => {
            if (r.ok) setUnread(r.data)
        })
        tick()
        const t = setInterval(tick, 8000)
        return () => clearInterval(t)
    }, [me, view])

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
        return <div className="app"><Auth onLogin={login} onRegister={register} /></div>
    }

    const openCar = (id: number) => { setCarId(id); setView('car') }
    const back = () => setView('cars')

    return (
        <div className="app">
            <div className="top-bar">
                <div>
                    <div className="app-title" style={{ fontSize: '1.4rem' }}>Bruktbiler</div>
                    <div className="muted" style={{ fontSize: '0.7rem' }}>
                        {me.tlfnr}
                        {me.isAdmin && <span className="tag" style={{ marginLeft: 6, fontSize: '0.55rem' }}>Admin</span>}
                        {me.isSeller && <span className="tag tag-blue" style={{ marginLeft: 6, fontSize: '0.55rem' }}>Selger</span>}
                    </div>
                </div>
                <button className="icon-btn" title="Logg ut" onClick={logout}>
                    <IconLogout width={16} height={16} />
                </button>
            </div>

            <div className="app-body">
                {view === 'cars' && <Cars onOpen={openCar} />}
                {view === 'car' && carId !== null && <CarDetail id={carId} onBack={back} />}
                {view === 'sell' && (me.isSeller || me.isAdmin ? <SellerWork /> : <SellCar />)}
                {view === 'mine' && (
                    <div>
                        <div className="tabs">
                            <button className={mineTab === 'wishlist' ? 'active' : ''} onClick={() => setMineTab('wishlist')}>Onskeliste</button>
                            <button className={mineTab === 'offers' ? 'active' : ''} onClick={() => setMineTab('offers')}>Tilbud</button>
                            <button className={mineTab === 'finance' ? 'active' : ''} onClick={() => setMineTab('finance')}>Finansiering</button>
                            <button className={mineTab === 'interests' ? 'active' : ''} onClick={() => setMineTab('interests')}>Interesser</button>
                            <button className={mineTab === 'threads' ? 'active' : ''} onClick={() => setMineTab('threads')}>Samtaler</button>
                            <button className={mineTab === 'alerts' ? 'active' : ''} onClick={() => setMineTab('alerts')}>Varsler</button>
                            {(me.isSeller || me.isAdmin) && (
                                <button className={mineTab === 'earnings' ? 'active' : ''} onClick={() => setMineTab('earnings')}>Provisjon</button>
                            )}
                        </div>
                        {mineTab === 'wishlist' && <Wishlist onOpen={openCar} />}
                        {mineTab === 'offers' && <MyOffers onOpen={openCar} />}
                        {mineTab === 'finance' && <MyFinancing onOpen={openCar} />}
                        {mineTab === 'interests' && <MyInterests onOpen={openCar} />}
                        {mineTab === 'threads' && <Chat />}
                        {mineTab === 'alerts' && <PriceAlerts />}
                        {mineTab === 'earnings' && <Earnings />}
                    </div>
                )}
                {view === 'inbox' && <Inbox onOpenCar={openCar} />}
                {view === 'admin' && me.isAdmin && <Admin />}
            </div>

            <BottomNav view={view} setView={(v) => { setView(v); setCarId(null) }}
                isAdmin={me.isAdmin} unread={unread} />
        </div>
    )
}

function BottomNav({ view, setView, isAdmin, unread }: {
    view: View; setView: (v: View) => void; isAdmin: boolean; unread: number
}) {
    const item = (id: View, Icon: any, label: string, badge?: number) => (
        <button className={view === id || (id === 'cars' && view === 'car') ? 'active' : ''}
            onClick={() => setView(id)}>
            <span className="icon">
                <Icon width={20} height={20} />
                {badge && badge > 0 ? <span className="badge">{badge > 9 ? '9+' : badge}</span> : null}
            </span>
            <span>{label}</span>
        </button>
    )
    return (
        <div className="bottom-nav">
            {item('cars', IconCar, 'Biler')}
            {item('sell', IconHandshake, 'Selg')}
            {item('mine', IconStar, 'Mine')}
            {item('inbox', IconBell, 'Varsler', unread)}
            {isAdmin && item('admin', IconSettings, 'Admin')}
        </div>
    )
}

export default function App() {
    useEffect(() => { document.body.style.visibility = 'visible' }, [])

    if (devMode) {
        return <DevWrapper><Shell /></DevWrapper>
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
    return <div className="dev-wrapper"><Frame>{children}</Frame></div>
}
