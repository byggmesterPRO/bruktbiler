import { useEffect, useState, useCallback } from 'react'
import { api } from './api'

export type Me = { id: number; tlfnr: string; name: string; isAdmin: boolean; isSeller: boolean; officeId: number | null } | null

const TOKEN_KEY = 'bb_token'

export function getToken(): string {
    try {
        return localStorage.getItem(TOKEN_KEY) || ''
    } catch {
        return ''
    }
}

export function setToken(token: string | null) {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token)
        else localStorage.removeItem(TOKEN_KEY)
    } catch {}
}

export function useAuth() {
    const [me, setMe] = useState<Me>(null)
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async () => {
        const token = getToken()
        if (!token) {
            setMe(null); setLoading(false); return
        }
        const res = await api('me', { token })
        if (res.ok) setMe(res.data)
        else { setMe(null); setToken(null) }
        setLoading(false)
    }, [])

    useEffect(() => { refresh() }, [refresh])

    const login = useCallback(async (tlfnr: string, password: string) => {
        const res = await api<{ token: string; isAdmin: boolean; tlfnr: string }>(
            'login', { tlfnr, password }
        )
        if (res.ok) {
            setToken(res.data.token)
            setMe({ id: 0, tlfnr: res.data.tlfnr, name: (res.data as any).name || '', isAdmin: res.data.isAdmin, isSeller: (res.data as any).isSeller || false, officeId: null })
            await refresh()
        }
        return res
    }, [refresh])

    const register = useCallback(async (tlfnr: string, password: string, name: string) => {
        const res = await api<{ token: string; isAdmin: boolean; tlfnr: string }>(
            'register', { tlfnr, password, name }
        )
        if (res.ok) {
            setToken(res.data.token)
            setMe({ id: 0, tlfnr: res.data.tlfnr, name: (res.data as any).name || '', isAdmin: res.data.isAdmin, isSeller: (res.data as any).isSeller || false, officeId: null })
            await refresh()
        }
        return res
    }, [refresh])

    const logout = useCallback(async () => {
        const token = getToken()
        await api('logout', { token })
        setToken(null)
        setMe(null)
    }, [])

    return { me, loading, login, register, logout, refresh }
}
