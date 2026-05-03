// Tynt API-lag som proxy-er alt over den generiske `bruktbiler:call`-broen.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

const devMode = !(window as any)?.invokeNative

let mockUsers: any[] = [{ id: 1, tlfnr: '00000000', is_admin: 1, created_at: new Date().toISOString() }]
let mockCars: any[] = [
    { id: 1, make: 'Audi', model: 'RS6 Avant', year: 2022, price: 1450000, mileage: 18000,
      image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=900',
      description: 'Plettfri RS6 i Mythos Black. Full historikk.',
      status: 'available', listingType: 'dealership', sellerUserId: null, sellerTlfnr: null,
      commissionPct: 0, approved: true, createdAt: new Date().toISOString() },
    { id: 2, make: 'Porsche', model: '911 GT3', year: 2021, price: 2390000, mileage: 9500,
      image: 'https://images.unsplash.com/photo-1611821064430-0d40291922d2?w=900',
      description: 'GT3 i Guards Red, manuell. Ett ar gjenstaende garanti.',
      status: 'auction', listingType: 'consignment_in_shop', sellerUserId: 2, sellerTlfnr: '12345678',
      commissionPct: 8, approved: true, createdAt: new Date().toISOString() },
    { id: 3, make: 'BMW', model: 'M3 Competition', year: 2023, price: 1190000, mileage: 12000,
      image: 'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=900',
      description: 'Isle of Man Green, full utstyr.',
      status: 'available', listingType: 'consignment_remote', sellerUserId: 3, sellerTlfnr: '87654321',
      commissionPct: 6, approved: true, createdAt: new Date().toISOString() },
]
let mockSessionToken: string | null = null
let mockMe: any = null

function mockRespond(event: string, data: any): ApiResult<any> {
    switch (event) {
        case 'login': {
            if (data.tlfnr === '00000000' && data.password === 'admin') {
                mockSessionToken = 'mock-token-admin'
                mockMe = { id: 1, tlfnr: '00000000', isAdmin: true }
                return { ok: true, data: { token: mockSessionToken, isAdmin: true, tlfnr: '00000000' } }
            }
            if (data.tlfnr && data.password) {
                mockSessionToken = 'mock-token-user'
                mockMe = { id: 99, tlfnr: data.tlfnr, isAdmin: false }
                return { ok: true, data: { token: mockSessionToken, isAdmin: false, tlfnr: data.tlfnr } }
            }
            return { ok: false, error: 'Feil telefonnummer eller passord' }
        }
        case 'register': {
            mockSessionToken = 'mock-token-user'
            mockMe = { id: 99, tlfnr: data.tlfnr, isAdmin: false }
            return { ok: true, data: { token: mockSessionToken, isAdmin: false, tlfnr: data.tlfnr } }
        }
        case 'me':
            return mockMe ? { ok: true, data: mockMe } : { ok: false, error: 'Ikke innlogget' }
        case 'logout':
            mockSessionToken = null; mockMe = null
            return { ok: true, data: true }
        case 'listCars':
            return { ok: true, data: mockCars.filter((c) => c.approved && (c.status === 'available' || c.status === 'auction')) }
        case 'getCar': {
            const car = mockCars.find((c) => c.id === data.id)
            if (!car) return { ok: false, error: 'Bilen finnes ikke' }
            const c = { ...car }
            if (car.status === 'auction') {
                c.auction = {
                    id: 100, startPrice: car.price, currentBid: car.price + 50000,
                    currentBidderId: 1, endsAt: new Date(Date.now() + 3600 * 1000 * 5).toISOString(),
                    status: 'active', bids: [{ amount: car.price + 50000, tlfnr: '11223344', created_at: new Date().toISOString() }],
                }
            }
            return { ok: true, data: c }
        }
        case 'expressInterest':
            return { ok: true, data: true }
        case 'listMyInterests':
            return { ok: true, data: [] }
        case 'submitListing': {
            const id = mockCars.length + 1
            mockCars.push({ id, ...data, status: 'pending', approved: false,
                sellerUserId: mockMe?.id, sellerTlfnr: mockMe?.tlfnr,
                commissionPct: 0, createdAt: new Date().toISOString() })
            return { ok: true, data: { id } }
        }
        case 'listMyListings':
            return { ok: true, data: mockCars.filter((c) => c.sellerUserId === mockMe?.id) }
        case 'placeBid':
            return { ok: true, data: true }
        case 'adminListUsers':
            return { ok: true, data: mockUsers }
        case 'adminListInterests':
            return { ok: true, data: [] }
        case 'adminListPending':
            return { ok: true, data: mockCars.filter((c) => !c.approved) }
        default:
            return { ok: true, data: null }
    }
}

export async function api<T = any>(event: string, data: any = {}): Promise<ApiResult<T>> {
    if (devMode) {
        await new Promise((r) => setTimeout(r, 80))
        return mockRespond(event, data) as ApiResult<T>
    }
    try {
        const res = await (window as any).fetchNui('bruktbiler:call', { event, data })
        if (!res) return { ok: false, error: 'Tom respons fra server' }
        return res as ApiResult<T>
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Ukjent feil' }
    }
}

export function formatNok(amount: number): string {
    if (typeof amount !== 'number' || !isFinite(amount)) return '-'
    return amount.toLocaleString('no-NO') + ' kr'
}

export function formatKm(km: number): string {
    if (!km) return '0 km'
    return km.toLocaleString('no-NO') + ' km'
}
