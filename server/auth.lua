-- SHA-256 implementation for password hashing.
-- Pure-Lua. Adequate for FiveM game-server context (combined with random salt).

local band, bor, bxor, bnot = bit32.band, bit32.bor, bit32.bxor, bit32.bnot
local rshift, lshift = bit32.rshift, bit32.lshift

local function rrotate(x, n)
    return bor(rshift(x, n), lshift(x, 32 - n)) % 0x100000000
end

local K = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
}

local function preprocess(msg)
    local len = #msg
    local bit_len = len * 8
    msg = msg .. string.char(0x80)
    while (#msg % 64) ~= 56 do msg = msg .. string.char(0) end
    for i = 7, 0, -1 do msg = msg .. string.char(band(rshift(bit_len, i * 8), 0xff)) end
    return msg
end

local function sha256(msg)
    msg = preprocess(msg)
    local H = { 0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19 }
    for chunk = 1, #msg, 64 do
        local w = {}
        for i = 0, 15 do
            local j = chunk + i * 4
            w[i] = bor(
                lshift(string.byte(msg, j), 24), lshift(string.byte(msg, j + 1), 16),
                lshift(string.byte(msg, j + 2), 8), string.byte(msg, j + 3)
            )
        end
        for i = 16, 63 do
            local s0 = bxor(rrotate(w[i-15],7), rrotate(w[i-15],18), rshift(w[i-15],3))
            local s1 = bxor(rrotate(w[i-2],17), rrotate(w[i-2],19), rshift(w[i-2],10))
            w[i] = (w[i-16] + s0 + w[i-7] + s1) % 0x100000000
        end
        local a,b,c,d,e,f,g,h = H[1],H[2],H[3],H[4],H[5],H[6],H[7],H[8]
        for i = 0, 63 do
            local S1 = bxor(rrotate(e,6), rrotate(e,11), rrotate(e,25))
            local ch = bxor(band(e,f), band(bnot(e) % 0x100000000, g))
            local t1 = (h + S1 + ch + K[i+1] + w[i]) % 0x100000000
            local S0 = bxor(rrotate(a,2), rrotate(a,13), rrotate(a,22))
            local maj = bxor(band(a,b), band(a,c), band(b,c))
            local t2 = (S0 + maj) % 0x100000000
            h = g; g = f; f = e
            e = (d + t1) % 0x100000000
            d = c; c = b; b = a
            a = (t1 + t2) % 0x100000000
        end
        H[1]=(H[1]+a)%0x100000000; H[2]=(H[2]+b)%0x100000000
        H[3]=(H[3]+c)%0x100000000; H[4]=(H[4]+d)%0x100000000
        H[5]=(H[5]+e)%0x100000000; H[6]=(H[6]+f)%0x100000000
        H[7]=(H[7]+g)%0x100000000; H[8]=(H[8]+h)%0x100000000
    end
    return string.format("%08x%08x%08x%08x%08x%08x%08x%08x",
        H[1],H[2],H[3],H[4],H[5],H[6],H[7],H[8])
end

local function randhex(bytes)
    local t = {}
    for i = 1, bytes do t[i] = string.format("%02x", math.random(0, 255)) end
    return table.concat(t)
end

math.randomseed(os.time() + GetGameTimer())
for _ = 1, 5 do math.random() end

function BB_HashPassword(password, salt) return sha256(salt .. ":" .. password) end
function BB_GenerateSalt() return randhex(16) end
function BB_GenerateToken() return randhex(32) end

function BB_ConstantEqual(a, b)
    if #a ~= #b then return false end
    local diff = 0
    for i = 1, #a do diff = bor(diff, bxor(string.byte(a, i), string.byte(b, i))) end
    return diff == 0
end

function BB_EnsureDefaultAdmin()
    local row = MySQL.single.await("SELECT id FROM bb_users WHERE is_admin = 1 LIMIT 1")
    if row then return end
    local salt = BB_GenerateSalt()
    local hash = BB_HashPassword(Config.DefaultAdmin.password, salt)
    MySQL.insert.await(
        "INSERT INTO bb_users (tlfnr, password_hash, salt, is_admin) VALUES (?, ?, ?, 1)",
        { Config.DefaultAdmin.tlfnr, hash, salt }
    )
    print(("[bruktbiler] Opprettet default admin (tlfnr=%s, passord=%s) — bytt passordet snarest!"):format(
        Config.DefaultAdmin.tlfnr, Config.DefaultAdmin.password
    ))
end

function BB_CreateSession(userId)
    local token = BB_GenerateToken()
    local expires = os.date("%Y-%m-%d %H:%M:%S", os.time() + Config.SessionTTL)
    MySQL.insert.await(
        "INSERT INTO bb_sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        { token, userId, expires }
    )
    return token
end

function BB_ResolveSession(token)
    if not token or token == "" then return nil end
    local row = MySQL.single.await([[
        SELECT u.id, u.tlfnr, u.name, u.license, u.is_admin
        FROM bb_sessions s JOIN bb_users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > NOW()
        LIMIT 1
    ]], { token })
    if row then
        row.office_id = MySQL.scalar.await(
            "SELECT office_id FROM bb_office_members WHERE user_id = ? LIMIT 1", { row.id }
        )
        row.is_seller = row.office_id ~= nil
    end
    return row
end

function BB_RequireAuth(token)
    local user = BB_ResolveSession(token)
    if not user then return nil, "Ikke innlogget" end
    return user
end

function BB_RequireAdmin(token)
    local user, err = BB_RequireAuth(token)
    if not user then return nil, err end
    if user.is_admin ~= 1 then return nil, "Krever admin" end
    return user
end

function BB_RequireSeller(token)
    local user, err = BB_RequireAuth(token)
    if not user then return nil, err end
    if user.is_admin ~= 1 and not user.is_seller then return nil, "Krever selger eller admin" end
    return user
end
