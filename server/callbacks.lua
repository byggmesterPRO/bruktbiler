-- All NUI->server callbacks. Registered via ox_lib.
-- Front-end calls them via the generic `bruktbiler:call` bridge.

local function ok(data) return { ok = true, data = data } end
local function err(message) return { ok = false, error = message } end

----------------------------------------------------------------
-- AUTH
----------------------------------------------------------------

lib.callback.register("bruktbiler:register", function(_, payload)
    payload = payload or {}
    local tlfnr = tostring(payload.tlfnr or ""):gsub("%s+", "")
    local password = tostring(payload.password or "")

    if #tlfnr < 4 then return err("Telefonnummer for kort") end
    if #password < 4 then return err("Passord for kort (min 4 tegn)") end

    local existing = MySQL.scalar.await("SELECT id FROM bb_users WHERE tlfnr = ?", { tlfnr })
    if existing then return err("Telefonnummeret er allerede registrert") end

    local salt = BB_GenerateSalt()
    local hash = BB_HashPassword(password, salt)
    local id = MySQL.insert.await(
        "INSERT INTO bb_users (tlfnr, password_hash, salt, is_admin) VALUES (?, ?, ?, 0)",
        { tlfnr, hash, salt }
    )
    local token = BB_CreateSession(id)
    return ok({ token = token, isAdmin = false, tlfnr = tlfnr })
end)

lib.callback.register("bruktbiler:login", function(_, payload)
    payload = payload or {}
    local tlfnr = tostring(payload.tlfnr or ""):gsub("%s+", "")
    local password = tostring(payload.password or "")

    local row = MySQL.single.await(
        "SELECT id, password_hash, salt, is_admin FROM bb_users WHERE tlfnr = ?",
        { tlfnr }
    )
    if not row then return err("Feil telefonnummer eller passord") end

    local hash = BB_HashPassword(password, row.salt)
    if not BB_ConstantEqual(hash, row.password_hash) then
        return err("Feil telefonnummer eller passord")
    end

    local token = BB_CreateSession(row.id)
    return ok({ token = token, isAdmin = row.is_admin == 1, tlfnr = tlfnr })
end)

lib.callback.register("bruktbiler:logout", function(_, payload)
    local token = (payload or {}).token
    if token then
        MySQL.query.await("DELETE FROM bb_sessions WHERE token = ?", { token })
    end
    return ok(true)
end)

lib.callback.register("bruktbiler:me", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    return ok({ id = user.id, tlfnr = user.tlfnr, isAdmin = user.is_admin == 1 })
end)

lib.callback.register("bruktbiler:changePassword", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local newPw = tostring(payload.newPassword or "")
    if #newPw < 4 then return err("Passord for kort") end

    local salt = BB_GenerateSalt()
    local hash = BB_HashPassword(newPw, salt)
    MySQL.query.await(
        "UPDATE bb_users SET password_hash = ?, salt = ? WHERE id = ?",
        { hash, salt, user.id }
    )
    return ok(true)
end)

----------------------------------------------------------------
-- CARS (browse)
----------------------------------------------------------------

local function carRow(row)
    return {
        id = row.id, make = row.make, model = row.model, year = row.year,
        price = row.price, mileage = row.mileage, image = row.image,
        description = row.description, status = row.status,
        listingType = row.listing_type, sellerUserId = row.seller_user_id,
        sellerTlfnr = row.seller_tlfnr,
        commissionPct = row.commission_pct, approved = row.approved == 1,
        createdAt = row.created_at,
    }
end

lib.callback.register("bruktbiler:listCars", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT c.*, u.tlfnr AS seller_tlfnr
        FROM bb_cars c
        LEFT JOIN bb_users u ON u.id = c.seller_user_id
        WHERE c.approved = 1 AND c.status IN ('available','auction')
        ORDER BY c.created_at DESC
    ]]) or {}
    local out = {}
    for i, r in ipairs(rows) do out[i] = carRow(r) end
    return ok(out)
end)

lib.callback.register("bruktbiler:getCar", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end

    local row = MySQL.single.await([[
        SELECT c.*, u.tlfnr AS seller_tlfnr
        FROM bb_cars c
        LEFT JOIN bb_users u ON u.id = c.seller_user_id
        WHERE c.id = ?
    ]], { payload.id })
    if not row then return err("Bilen finnes ikke") end

    local car = carRow(row)
    if car.status == "auction" then
        local auction = MySQL.single.await(
            "SELECT * FROM bb_auctions WHERE car_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
            { car.id }
        )
        if auction then
            local bids = MySQL.query.await([[
                SELECT b.amount, b.created_at, u.tlfnr
                FROM bb_bids b JOIN bb_users u ON u.id = b.user_id
                WHERE b.auction_id = ?
                ORDER BY b.amount DESC LIMIT 5
            ]], { auction.id }) or {}
            car.auction = {
                id = auction.id,
                startPrice = auction.start_price,
                currentBid = auction.current_bid,
                currentBidderId = auction.current_bidder_id,
                endsAt = auction.ends_at,
                status = auction.status,
                bids = bids,
            }
        end
    end
    return ok(car)
end)

lib.callback.register("bruktbiler:expressInterest", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local carId = tonumber(payload.carId)
    if not carId then return err("Ugyldig bil") end
    local message = tostring(payload.message or "")

    MySQL.query.await([[
        INSERT INTO bb_interests (user_id, car_id, message)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE message = VALUES(message), created_at = CURRENT_TIMESTAMP
    ]], { user.id, carId, message })
    return ok(true)
end)

lib.callback.register("bruktbiler:listMyInterests", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT i.id, i.message, i.created_at,
               c.id AS car_id, c.make, c.model, c.year, c.price, c.image, c.status
        FROM bb_interests i
        JOIN bb_cars c ON c.id = i.car_id
        WHERE i.user_id = ?
        ORDER BY i.created_at DESC
    ]], { user.id }) or {}
    return ok(rows)
end)

----------------------------------------------------------------
-- USER LISTINGS
----------------------------------------------------------------

local VALID_USER_TYPES = {
    consignment_in_shop = true,
    consignment_remote = true,
    private = true,
}

lib.callback.register("bruktbiler:submitListing", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end

    local listingType = tostring(payload.listingType or "")
    if not VALID_USER_TYPES[listingType] then return err("Ugyldig annonsetype") end

    local make = tostring(payload.make or "")
    local model = tostring(payload.model or "")
    local year = tonumber(payload.year)
    local price = tonumber(payload.price)
    local mileage = tonumber(payload.mileage) or 0
    local image = tostring(payload.image or "")
    local description = tostring(payload.description or "")

    if make == "" or model == "" or not year or not price then
        return err("Mangler obligatoriske felt")
    end

    local id = MySQL.insert.await([[
        INSERT INTO bb_cars
            (make, model, year, price, mileage, image, description, status, listing_type, seller_user_id, approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0)
    ]], { make, model, year, price, mileage, image, description, listingType, user.id })

    return ok({ id = id })
end)

lib.callback.register("bruktbiler:listMyListings", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT * FROM bb_cars WHERE seller_user_id = ? ORDER BY created_at DESC
    ]], { user.id }) or {}
    local out = {}
    for i, r in ipairs(rows) do out[i] = carRow(r) end
    return ok(out)
end)

lib.callback.register("bruktbiler:withdrawListing", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local carId = tonumber(payload.carId)
    if not carId then return err("Ugyldig") end

    local row = MySQL.single.await(
        "SELECT seller_user_id, status FROM bb_cars WHERE id = ?", { carId }
    )
    if not row then return err("Finnes ikke") end
    if row.seller_user_id ~= user.id then return err("Ikke din annonse") end
    if row.status == "sold" then return err("Allerede solgt") end

    MySQL.query.await(
        "UPDATE bb_cars SET status = 'withdrawn' WHERE id = ?", { carId }
    )
    return ok(true)
end)

----------------------------------------------------------------
-- AUCTIONS
----------------------------------------------------------------

lib.callback.register("bruktbiler:placeBid", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local auctionId = tonumber(payload.auctionId)
    local amount = tonumber(payload.amount)
    if not auctionId or not amount or amount <= 0 then return err("Ugyldig bud") end

    local auction = MySQL.single.await(
        "SELECT * FROM bb_auctions WHERE id = ?", { auctionId }
    )
    if not auction then return err("Auksjon finnes ikke") end
    if auction.status ~= "active" then return err("Auksjonen er ferdig") end

    local endTs = auction.ends_at
    local rowTs = MySQL.scalar.await(
        "SELECT TIMESTAMPDIFF(SECOND, NOW(), ?)", { endTs }
    )
    if rowTs and rowTs <= 0 then return err("Auksjonen er ferdig") end

    if amount <= auction.current_bid then
        return err(("Budet ma vaere over %d"):format(auction.current_bid))
    end

    MySQL.insert.await(
        "INSERT INTO bb_bids (auction_id, user_id, amount) VALUES (?, ?, ?)",
        { auctionId, user.id, amount }
    )
    MySQL.query.await(
        "UPDATE bb_auctions SET current_bid = ?, current_bidder_id = ? WHERE id = ?",
        { amount, user.id, auctionId }
    )
    return ok(true)
end)

local function tickAuctions()
    local ended = MySQL.query.await([[
        SELECT id, car_id, current_bidder_id FROM bb_auctions
        WHERE status = 'active' AND ends_at <= NOW()
    ]]) or {}
    for _, a in ipairs(ended) do
        MySQL.query.await("UPDATE bb_auctions SET status = 'ended' WHERE id = ?", { a.id })
        local newStatus = a.current_bidder_id and "sold" or "available"
        MySQL.query.await("UPDATE bb_cars SET status = ? WHERE id = ?", { newStatus, a.car_id })
    end
end

CreateThread(function()
    while true do
        Wait(Config.AuctionTickInterval * 1000)
        local okPcall, errMsg = pcall(tickAuctions)
        if not okPcall then
            print("[bruktbiler] auction tick error:", errMsg)
        end
    end
end)

----------------------------------------------------------------
-- ADMIN
----------------------------------------------------------------

lib.callback.register("bruktbiler:adminListUsers", function(_, payload)
    local user, e = BB_RequireAdmin((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await(
        "SELECT id, tlfnr, is_admin, created_at FROM bb_users ORDER BY created_at DESC"
    ) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:adminResetPassword", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local targetId = tonumber(payload.targetUserId)
    local newPw = tostring(payload.newPassword or "")
    if not targetId then return err("Ugyldig bruker") end
    if #newPw < 4 then return err("Passord for kort") end

    local salt = BB_GenerateSalt()
    local hash = BB_HashPassword(newPw, salt)
    MySQL.query.await(
        "UPDATE bb_users SET password_hash = ?, salt = ? WHERE id = ?",
        { hash, salt, targetId }
    )
    MySQL.query.await("DELETE FROM bb_sessions WHERE user_id = ?", { targetId })
    return ok(true)
end)

lib.callback.register("bruktbiler:adminToggleAdmin", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local targetId = tonumber(payload.targetUserId)
    local makeAdmin = payload.isAdmin and 1 or 0
    MySQL.query.await(
        "UPDATE bb_users SET is_admin = ? WHERE id = ?", { makeAdmin, targetId }
    )
    return ok(true)
end)

lib.callback.register("bruktbiler:adminCreateCar", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local make = tostring(payload.make or "")
    local model = tostring(payload.model or "")
    local year = tonumber(payload.year)
    local price = tonumber(payload.price)
    local mileage = tonumber(payload.mileage) or 0
    local image = tostring(payload.image or "")
    local description = tostring(payload.description or "")
    if make == "" or model == "" or not year or not price then
        return err("Mangler obligatoriske felt")
    end
    local id = MySQL.insert.await([[
        INSERT INTO bb_cars (make, model, year, price, mileage, image, description, status, listing_type, approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'available', 'dealership', 1)
    ]], { make, model, year, price, mileage, image, description })
    return ok({ id = id })
end)

lib.callback.register("bruktbiler:adminUpdateCar", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.id)
    if not id then return err("Ugyldig") end
    MySQL.query.await([[
        UPDATE bb_cars SET make=?, model=?, year=?, price=?, mileage=?, image=?, description=?, status=?
        WHERE id=?
    ]], {
        payload.make, payload.model, payload.year, payload.price,
        payload.mileage or 0, payload.image or "", payload.description or "",
        payload.status or "available", id
    })
    return ok(true)
end)

lib.callback.register("bruktbiler:adminDeleteCar", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.id)
    if not id then return err("Ugyldig") end
    MySQL.query.await("DELETE FROM bb_cars WHERE id = ?", { id })
    return ok(true)
end)

lib.callback.register("bruktbiler:adminListInterests", function(_, payload)
    local user, e = BB_RequireAdmin((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT i.id, i.message, i.created_at,
               u.id AS user_id, u.tlfnr,
               c.id AS car_id, c.make, c.model, c.year, c.price
        FROM bb_interests i
        JOIN bb_users u ON u.id = i.user_id
        JOIN bb_cars c ON c.id = i.car_id
        ORDER BY i.created_at DESC
    ]]) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:adminCreateAuction", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local carId = tonumber(payload.carId)
    local startPrice = tonumber(payload.startPrice)
    local hours = tonumber(payload.durationHours) or 24
    if not carId or not startPrice then return err("Mangler felt") end

    local car = MySQL.single.await("SELECT status FROM bb_cars WHERE id = ?", { carId })
    if not car then return err("Bil finnes ikke") end
    if car.status == "sold" then return err("Bilen er solgt") end

    local existing = MySQL.scalar.await(
        "SELECT id FROM bb_auctions WHERE car_id = ? AND status = 'active'", { carId }
    )
    if existing then return err("Bilen er allerede pa auksjon") end

    local endsAt = os.date("%Y-%m-%d %H:%M:%S", os.time() + hours * 3600)
    local id = MySQL.insert.await([[
        INSERT INTO bb_auctions (car_id, start_price, current_bid, ends_at, status)
        VALUES (?, ?, ?, ?, 'active')
    ]], { carId, startPrice, startPrice, endsAt })
    MySQL.query.await("UPDATE bb_cars SET status = 'auction' WHERE id = ?", { carId })
    return ok({ id = id })
end)

lib.callback.register("bruktbiler:adminEndAuction", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.auctionId)
    if not id then return err("Ugyldig") end

    local a = MySQL.single.await("SELECT * FROM bb_auctions WHERE id = ?", { id })
    if not a then return err("Auksjon finnes ikke") end

    MySQL.query.await("UPDATE bb_auctions SET status = 'ended' WHERE id = ?", { id })
    local newStatus = a.current_bidder_id and "sold" or "available"
    MySQL.query.await("UPDATE bb_cars SET status = ? WHERE id = ?", { newStatus, a.car_id })
    return ok(true)
end)

lib.callback.register("bruktbiler:adminListPending", function(_, payload)
    local user, e = BB_RequireAdmin((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT c.*, u.tlfnr AS seller_tlfnr
        FROM bb_cars c
        LEFT JOIN bb_users u ON u.id = c.seller_user_id
        WHERE c.approved = 0
        ORDER BY c.created_at DESC
    ]]) or {}
    local out = {}
    for i, r in ipairs(rows) do out[i] = carRow(r) end
    return ok(out)
end)

lib.callback.register("bruktbiler:adminApproveListing", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.carId)
    local commission = tonumber(payload.commissionPct) or Config.DefaultCommissionPct
    if not id then return err("Ugyldig") end

    MySQL.query.await([[
        UPDATE bb_cars SET approved = 1, status = 'available', commission_pct = ?
        WHERE id = ?
    ]], { commission, id })
    return ok(true)
end)

lib.callback.register("bruktbiler:adminRejectListing", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.carId)
    if not id then return err("Ugyldig") end
    MySQL.query.await("DELETE FROM bb_cars WHERE id = ?", { id })
    return ok(true)
end)
