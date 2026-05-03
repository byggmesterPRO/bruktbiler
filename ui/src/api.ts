// Tynt API-lag som proxy-er alt over den generiske `bruktbiler:call`-broen.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

const devMode = !(window as any)?.invokeNative

let mockUsers: any[] = [
    { id: 1, tlfnr: '00000000', name: 'Total Sjef', is_admin: 1, online: true, created_at: new Date().toISOString(), office_id: null, office_name: null, office_role: null },
    { id: 2, tlfnr: '11111111', name: 'Lars Selger', is_admin: 0, online: true, created_at: new Date().toISOString(), office_id: 1, office_name: 'Vestfold Bil', office_role: 'manager' },
    { id: 3, tlfnr: '22222222', name: 'Kari Privat', is_admin: 0, online: false, created_at: new Date().toISOString(), office_id: null, office_name: null, office_role: null },
    { id: 4, tlfnr: '33333333', name: 'Per Kunde', is_admin: 0, online: true, created_at: new Date().toISOString(), office_id: null, office_name: null, office_role: null },
]
let mockOffices: any[] = [
    { id: 1, name: 'Vestfold Bil', logo: '', commission_pct: 8, created_at: new Date().toISOString(), member_count: 1 },
    { id: 2, name: 'Premium Auto AS', logo: '', commission_pct: 10, created_at: new Date().toISOString(), member_count: 0 },
]
let mockCars: any[] = [
    { id: 1, make: 'Audi', model: 'RS6 Avant', year: 2022, price: 1450000, mileage: 18000,
      image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=900',
      description: 'Plettfri RS6 i Mythos Black. Full historikk.',
      status: 'available', listingType: 'dealership', sellerUserId: null, sellerTlfnr: null,
      assignedOfficeId: 1, assignedOfficeName: 'Vestfold Bil',
      assignedSellerId: 2, assignedSellerTlfnr: '11111111',
      commissionPct: 0, approved: true, createdAt: new Date().toISOString() },
    { id: 2, make: 'Porsche', model: '911 GT3', year: 2021, price: 2390000, mileage: 9500,
      image: 'https://images.unsplash.com/photo-1611821064430-0d40291922d2?w=900',
      description: 'GT3 i Guards Red, manuell. Ett ar gjenstaende garanti.',
      status: 'auction', listingType: 'consignment_in_shop', sellerUserId: 3, sellerTlfnr: '22222222',
      assignedOfficeId: 1, assignedOfficeName: 'Vestfold Bil',
      assignedSellerId: 2, assignedSellerTlfnr: '11111111',
      commissionPct: 8, approved: true, createdAt: new Date().toISOString() },
    { id: 3, make: 'BMW', model: 'M3 Competition', year: 2023, price: 1190000, mileage: 12000,
      image: 'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=900',
      description: 'Isle of Man Green, full utstyr.',
      status: 'available', listingType: 'consignment_remote', sellerUserId: 3, sellerTlfnr: '22222222',
      assignedOfficeId: 1, assignedOfficeName: 'Vestfold Bil',
      assignedSellerId: 2, assignedSellerTlfnr: '11111111',
      commissionPct: 6, approved: true, createdAt: new Date().toISOString() },
    { id: 4, make: 'Mercedes', model: 'AMG GT', year: 2020, price: 1850000, mileage: 24000,
      image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=900',
      description: 'AMG GT 4-dors. Plettfri stand.',
      status: 'available', listingType: 'dealership', sellerUserId: null, sellerTlfnr: null,
      assignedOfficeId: 1, assignedOfficeName: 'Vestfold Bil',
      assignedSellerId: 2, assignedSellerTlfnr: '11111111',
      commissionPct: 0, approved: true, createdAt: new Date().toISOString() },
]
let mockMessages: any[] = [
    { id: 1, type: 'broadcast', title: 'Velkommen til Bruktbiler', body: 'Premium kjop og salg.', link_car_id: null, is_read: 0, created_at: new Date(Date.now() - 3600 * 1000).toISOString() },
    { id: 2, type: 'interest', title: 'Ny interesse: Audi RS6', body: '11223344: Veldig interessert!', link_car_id: 1, is_read: 0, created_at: new Date(Date.now() - 1800 * 1000).toISOString() },
]
let mockSettings: any[] = [
    { key: 'transfer_fee', value: '5000' },
    { key: 'default_commission_pct', value: '8' },
    { key: 'auction_increment_min', value: '1000' },
]
let mockSellRequests: any[] = []
let mockThreads: any[] = []
let mockChatMessages: Record<number, any[]> = {}
let mockMe: any = null

function mockRespond(event: string, data: any): ApiResult<any> {
    const reply = (d: any) => ({ ok: true as const, data: d })
    const fail = (e: string) => ({ ok: false as const, error: e })

    switch (event) {
        case 'login': {
            if (data.tlfnr === '00000000' && data.password === 'admin') {
                mockMe = { id: 1, tlfnr: '00000000', name: 'Total Sjef', isAdmin: true, isSeller: false, officeId: null }
                return reply({ token: 't-admin', isAdmin: true, isSeller: false, tlfnr: '00000000', name: 'Total Sjef' })
            }
            if (data.tlfnr === '11111111') {
                mockMe = { id: 2, tlfnr: '11111111', name: 'Lars Selger', isAdmin: false, isSeller: true, officeId: 1 }
                return reply({ token: 't-sel', isAdmin: false, isSeller: true, tlfnr: '11111111', name: 'Lars Selger' })
            }
            if (data.tlfnr && data.password) {
                mockMe = { id: 99, tlfnr: data.tlfnr, name: 'Test Bruker', isAdmin: false, isSeller: false, officeId: null }
                return reply({ token: 't-user', isAdmin: false, isSeller: false, tlfnr: data.tlfnr, name: 'Test Bruker' })
            }
            return fail('Feil telefonnummer eller passord')
        }
        case 'register': {
            mockMe = { id: 99, tlfnr: data.tlfnr, name: data.name || 'Ny Bruker', isAdmin: false, isSeller: false, officeId: null }
            return reply({ token: 't-user', isAdmin: false, isSeller: false, tlfnr: data.tlfnr, name: data.name })
        }
        case 'listMyAssignedCars':
            return reply(mockCars.filter((c) => c.assignedSellerId === mockMe?.id))
        case 'placeCallFromUser':
            return reply(true)
        case 'checkOnline':
            return reply((data.userIds || []).map((id: number) => ({ id, online: mockUsers.find((u) => u.id === id)?.online === true })))
        case 'toggleWishlist': return reply({ saved: true })
        case 'isWishlisted': return reply({ saved: false })
        case 'listWishlist': return reply([mockCars[0]])
        case 'createOffer': return reply({ id: Date.now() })
        case 'respondToOffer': return reply(true)
        case 'listOffersForCar': return reply([
            { id: 1, car_id: data.carId, buyer_id: 99, seller_id: 2, amount: 1400000, message: 'Tilbyr 1.4M', status: 'pending', created_at: new Date().toISOString(), buyer_tlfnr: '99887766', buyer_name: 'Mock Kjoper' },
        ])
        case 'listMyOffers': return reply([])
        case 'createPriceAlert': return reply({ id: Date.now() })
        case 'listPriceAlerts': return reply([
            { id: 1, make: 'Audi', model: 'RS6', max_price: 1500000, min_year: 2020, max_km: 50000, active: 1, created_at: new Date().toISOString() },
        ])
        case 'deletePriceAlert': return reply(true)
        case 'listCarImages': return reply([])
        case 'addCarImage': return reply({ id: Date.now() })
        case 'removeCarImage': return reply(true)
        case 'estimateValue': {
            const base = 1_200_000
            return reply({
                sampleSize: 8, listingSampleSize: 3,
                avgSoldPrice: base, avgListingPrice: base + 80_000,
                suggestedSellPrice: base, suggestedBuyPrice: Math.floor(base * 0.85),
                recentSales: [
                    { sale_price: base, year: 2020, mileage: 30000 },
                    { sale_price: base + 50_000, year: 2021, mileage: 25000 },
                ],
            })
        }
        case 'adminAuditLog': return reply([
            { id: 3, actor_tlfnr: '00000000', action: 'approve_listing', target_type: 'car', target_id: 5, details: '{"commissionPct":8}', created_at: new Date().toISOString() },
            { id: 2, actor_tlfnr: '11111111', action: 'complete_sale', target_type: 'car', target_id: 1, details: '{"price":1450000}', created_at: new Date(Date.now() - 3600 * 1000).toISOString() },
            { id: 1, actor_tlfnr: '00000000', action: 'create_office', target_type: 'office', target_id: 1, details: null, created_at: new Date(Date.now() - 86400 * 1000).toISOString() },
        ])
        case 'getOfficeGoal': return reply({
            officeId: data.officeId || 1, period: data.period || new Date().toISOString().slice(0, 7),
            officeName: 'Vestfold Bil',
            revenueTarget: 10_000_000, salesTarget: 10, notes: '',
            actualRevenue: 6_500_000, actualSales: 6, actualCommission: 520_000,
            floorPct: 10, floorAmount: 52_000, bonusPool: 468_000,
        })
        case 'setOfficeGoal': return reply(true)
        case 'myEarnings': return reply({
            period: new Date().toISOString().slice(0, 7),
            sales: 4, revenue: 5_200_000, commission: 416_000, outstanding: 50_000,
            payouts: [
                { id: 1, period: '2026-04', amount: 80_000, note: 'April-bonus', paid: 1, paid_at: '2026-05-01', created_at: '2026-04-30' },
                { id: 2, period: '2026-05', amount: 50_000, note: 'Mai-forskudd', paid: 0, paid_at: null, created_at: new Date().toISOString() },
            ],
        })
        case 'officeEarnings': return reply([
            { id: 2, name: 'Lars Selger', tlfnr: '11111111', role: 'manager', commission: 416_000, sales: 4, revenue: 5_200_000, outstanding: 50_000 },
            { id: 5, name: 'Anna Bil', tlfnr: '44444444', role: 'seller', commission: 230_000, sales: 2, revenue: 3_100_000, outstanding: 0 },
        ])
        case 'createPayout': return reply({ id: Date.now() })
        case 'markPayoutPaid': return reply(true)
        case 'reserveCar': return reply({ id: Date.now(), deposit: Math.floor((mockCars.find((c) => c.id === data.carId)?.price || 0) * 0.05), expiresAt: new Date(Date.now() + 86400000).toISOString() })
        case 'cancelReservation': return reply(true)
        case 'getActiveReservation': return reply(null)
        case 'listFinancingPlans': return reply([
            { id: 1, car_id: data.carId, down_payment_pct: 20, term_months: 36, interest_pct: 5.5, active: 1 },
            { id: 2, car_id: data.carId, down_payment_pct: 30, term_months: 24, interest_pct: 4.5, active: 1 },
        ])
        case 'setFinancingPlan': return reply({ id: Date.now() })
        case 'deleteFinancingPlan': return reply(true)
        case 'applyFinancing': return reply({ id: Date.now(), monthly: 18500, downPayment: 290_000, total: 956_000 })
        case 'listMyFinancing': return reply([
            { id: 1, car_id: 1, status: 'approved', sale_price: 1_450_000, down_payment: 290_000, term_months: 36, interest_pct: 5.5, monthly_payment: 18_500, total_payable: 956_000, amount_paid: 37_000, next_due: '2026-06-01', make: 'Audi', model: 'RS6 Avant', year: 2022, image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=900' },
        ])
        case 'respondFinancing': return reply(true)
        case 'me':
            return mockMe ? reply(mockMe) : fail('Ikke innlogget')
        case 'logout':
            mockMe = null
            return reply(true)
        case 'listCars': {
            let cars = mockCars.filter((c) => c.approved && (c.status === 'available' || c.status === 'auction'))
            const f = data.filter || {}
            if (f.q) {
                const q = String(f.q).toLowerCase()
                cars = cars.filter((c) => `${c.make} ${c.model}`.toLowerCase().includes(q))
            }
            if (f.minPrice) cars = cars.filter((c) => c.price >= +f.minPrice)
            if (f.maxPrice) cars = cars.filter((c) => c.price <= +f.maxPrice)
            if (f.minYear) cars = cars.filter((c) => c.year >= +f.minYear)
            if (f.maxYear) cars = cars.filter((c) => c.year <= +f.maxYear)
            if (f.maxKm) cars = cars.filter((c) => c.mileage <= +f.maxKm)
            if (f.listingType) cars = cars.filter((c) => c.listingType === f.listingType)
            if (f.onlyAuction) cars = cars.filter((c) => c.status === 'auction')
            if (f.sort === 'price_asc') cars = [...cars].sort((a, b) => a.price - b.price)
            else if (f.sort === 'price_desc') cars = [...cars].sort((a, b) => b.price - a.price)
            else if (f.sort === 'km_asc') cars = [...cars].sort((a, b) => a.mileage - b.mileage)
            else if (f.sort === 'year_desc') cars = [...cars].sort((a, b) => b.year - a.year)
            return reply(cars)
        }
        case 'getCar': {
            const car = mockCars.find((c) => c.id === data.id)
            if (!car) return fail('Bilen finnes ikke')
            const c: any = { ...car, transferFee: 5000,
                financingPlans: [
                    { id: 1, down_payment_pct: 20, term_months: 36, interest_pct: 5.5 },
                    { id: 2, down_payment_pct: 30, term_months: 24, interest_pct: 4.5 },
                ],
                reservation: null,
            }
            if (car.status === 'auction') {
                c.auction = {
                    id: 100, startPrice: car.price, currentBid: car.price + 50000,
                    currentBidderId: 1, endsAt: new Date(Date.now() + 3600 * 1000 * 5).toISOString(),
                    status: 'active',
                    bids: [{ amount: car.price + 50000, tlfnr: '11223344', created_at: new Date().toISOString() }],
                }
            }
            return reply(c)
        }
        case 'expressInterest':
            mockMessages.unshift({ id: Date.now(), type: 'interest', title: 'Interesse registrert', body: data.message || '', link_car_id: data.carId, is_read: 0, created_at: new Date().toISOString() })
            return reply(true)
        case 'listMyInterests': return reply([])
        case 'submitSellRequest': {
            const id = mockSellRequests.length + 1
            mockSellRequests.push({ id, ...data, status: 'pending', user_id: mockMe?.id, created_at: new Date().toISOString() })
            return reply({ id })
        }
        case 'listMySellRequests':
            return reply(mockSellRequests.filter((r) => r.user_id === mockMe?.id))
        case 'listOpenSellRequests':
            return reply(mockSellRequests.filter((r) => r.status === 'pending' || r.status === 'assigned'))
        case 'claimSellRequest': {
            const r = mockSellRequests.find((r) => r.id === data.requestId)
            if (r) { r.status = 'assigned'; r.assigned_seller_id = mockMe?.id; r.assigned_office_id = mockMe?.officeId }
            return reply(true)
        }
        case 'placeBid': return reply(true)
        case 'completeSale':
            return reply({ commission: Math.floor(data.salePrice * 0.08), transferFee: 5000 })
        case 'listMessages': return reply(mockMessages)
        case 'unreadCount': return reply(mockMessages.filter((m) => !m.is_read).length)
        case 'markMessageRead': {
            const m = mockMessages.find((m) => m.id === data.id); if (m) m.is_read = 1
            return reply(true)
        }
        case 'markAllRead': mockMessages.forEach((m) => m.is_read = 1); return reply(true)
        case 'openThread': {
            let t = mockThreads.find((t) => t.car_id === data.carId && t.customer_id === mockMe?.id)
            if (!t) { t = { id: mockThreads.length + 1, car_id: data.carId, customer_id: mockMe?.id, seller_id: 2 }; mockThreads.push(t) }
            return reply(t)
        }
        case 'listMyThreads':
            return reply(mockThreads.map((t) => {
                const car = mockCars.find((c) => c.id === t.car_id)
                const last = mockChatMessages[t.id]?.slice(-1)[0]
                return { ...t, make: car?.make, model: car?.model, year: car?.year, image: car?.image,
                    customer_tlfnr: mockUsers.find((u) => u.id === t.customer_id)?.tlfnr,
                    seller_tlfnr: mockUsers.find((u) => u.id === t.seller_id)?.tlfnr,
                    last_msg: last?.body, last_at: last?.created_at }
            }))
        case 'listThreadMessages': return reply(mockChatMessages[data.threadId] || [])
        case 'sendThreadMessage': {
            const id = data.threadId
            mockChatMessages[id] = mockChatMessages[id] || []
            mockChatMessages[id].push({ id: Date.now(), sender_id: mockMe?.id, body: data.body, created_at: new Date().toISOString(), tlfnr: mockMe?.tlfnr })
            return reply(true)
        }
        case 'listOffices': return reply(mockOffices)
        case 'adminListUsers': return reply(mockUsers)
        case 'adminListInterests': return reply([])
        case 'adminListPending': return reply([])
        case 'adminGetSettings': return reply(mockSettings)
        case 'adminSetSetting': {
            const s = mockSettings.find((s) => s.key === data.key)
            if (s) s.value = data.value; else mockSettings.push({ key: data.key, value: data.value })
            return reply(true)
        }
        case 'adminCreateOffice': {
            const id = mockOffices.length + 1
            mockOffices.push({ id, name: data.name, logo: data.logo || '', commission_pct: data.commissionPct || 8, created_at: new Date().toISOString(), member_count: 0 })
            return reply({ id })
        }
        case 'adminListOfficeMembers':
            return reply(mockUsers.filter((u) => u.office_id === data.officeId).map((u) => ({ user_id: u.id, role: u.office_role, tlfnr: u.tlfnr, joined_at: new Date().toISOString() })))
        case 'adminBroadcast':
            return reply({ sent: 3 })
        case 'adminStats':
            return reply({
                totalUsers: mockUsers.length, totalCars: mockCars.length,
                activeListings: mockCars.filter((c) => c.status !== 'sold').length,
                pendingListings: 0, activeAuctions: 1, totalSales: 12,
                totalRevenue: 14_500_000, totalCommission: 1_160_000, totalTransferFees: 60_000,
                topBrands: [
                    { make: 'Audi', cnt: 4 }, { make: 'BMW', cnt: 3 }, { make: 'Porsche', cnt: 2 }, { make: 'Mercedes', cnt: 2 }, { make: 'Volvo', cnt: 1 },
                ],
                topSellers: [
                    { tlfnr: '11111111', cnt: 8, commission: 720_000 },
                    { tlfnr: '99887766', cnt: 4, commission: 280_000 },
                ],
                officeRevenue: [
                    { name: 'Vestfold Bil', sales: 8, revenue: 9_000_000, commission: 720_000 },
                    { name: 'Premium Auto AS', sales: 4, revenue: 5_500_000, commission: 440_000 },
                ],
                recentSales: [
                    { sale_price: 1_450_000, commission_amount: 116_000, sold_at: new Date().toISOString(), make: 'Audi', model: 'RS6 Avant', year: 2022, buyer_tlfnr: '12345678' },
                    { sale_price: 990_000, commission_amount: 79_200, sold_at: new Date(Date.now() - 86400000).toISOString(), make: 'BMW', model: 'M3', year: 2021, buyer_tlfnr: '87654321' },
                ],
            })
        default:
            return reply(null)
    }
}

export async function api<T = any>(event: string, data: any = {}): Promise<ApiResult<T>> {
    if (devMode) {
        await new Promise((r) => setTimeout(r, 60))
        return mockRespond(event, data) as ApiResult<T>
    }
    try {
        const res = await (window as any).fetchNui('bruktbiler:call', { event, data })
        if (!res) return { ok: false, error: 'Tom respons' }
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
