-- Alle NUI->server callbacks. Registreres via ox_lib.
-- Frontend kaller dem via den generiske `bruktbiler:call`-broen.

local function ok(data) return { ok = true, data = data } end
local function err(message) return { ok = false, error = message } end

----------------------------------------------------------------
-- AUTH
----------------------------------------------------------------

lib.callback.register("bruktbiler:register", function(source, payload)
    payload = payload or {}
    local tlfnr = tostring(payload.tlfnr or ""):gsub("%s+", "")
    local password = tostring(payload.password or "")
    local name = tostring(payload.name or ""):gsub("^%s+", ""):gsub("%s+$", "")
    if #tlfnr < 4 then return err("Telefonnummer for kort") end
    if #password < 4 then return err("Passord for kort (min 4 tegn)") end
    if name == "" then return err("Navn pakrevd") end

    local existing = MySQL.scalar.await("SELECT id FROM bb_users WHERE tlfnr = ?", { tlfnr })
    if existing then return err("Telefonnummeret er allerede registrert") end

    local salt = BB_GenerateSalt()
    local hash = BB_HashPassword(password, salt)
    local license = BB_GetLicense(source)
    local id = MySQL.insert.await(
        "INSERT INTO bb_users (tlfnr, name, password_hash, salt, is_admin, license) VALUES (?, ?, ?, ?, 0, ?)",
        { tlfnr, name, hash, salt, license }
    )
    local token = BB_CreateSession(id)
    return ok({ token = token, isAdmin = false, isSeller = false, tlfnr = tlfnr, name = name })
end)

lib.callback.register("bruktbiler:login", function(source, payload)
    payload = payload or {}
    local tlfnr = tostring(payload.tlfnr or ""):gsub("%s+", "")
    local password = tostring(payload.password or "")

    local row = MySQL.single.await(
        "SELECT id, name, password_hash, salt, is_admin FROM bb_users WHERE tlfnr = ?", { tlfnr }
    )
    if not row then return err("Feil telefonnummer eller passord") end
    local hash = BB_HashPassword(password, row.salt)
    if not BB_ConstantEqual(hash, row.password_hash) then
        return err("Feil telefonnummer eller passord")
    end

    -- Oppdater license ved hver login slik at den alltid er fersk.
    local license = BB_GetLicense(source)
    if license then
        MySQL.query.await("UPDATE bb_users SET license = ? WHERE id = ?", { license, row.id })
    end

    local token = BB_CreateSession(row.id)
    local officeId = MySQL.scalar.await(
        "SELECT office_id FROM bb_office_members WHERE user_id = ? LIMIT 1", { row.id }
    )
    return ok({ token = token, isAdmin = row.is_admin == 1, isSeller = officeId ~= nil,
        tlfnr = tlfnr, name = row.name })
end)

lib.callback.register("bruktbiler:logout", function(_, payload)
    local token = (payload or {}).token
    if token then MySQL.query.await("DELETE FROM bb_sessions WHERE token = ?", { token }) end
    return ok(true)
end)

lib.callback.register("bruktbiler:me", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    return ok({
        id = user.id, tlfnr = user.tlfnr, name = user.name,
        isAdmin = user.is_admin == 1, isSeller = user.is_seller == true,
        officeId = user.office_id,
    })
end)

lib.callback.register("bruktbiler:changePassword", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local newPw = tostring(payload.newPassword or "")
    if #newPw < 4 then return err("Passord for kort") end
    local salt = BB_GenerateSalt()
    local hash = BB_HashPassword(newPw, salt)
    MySQL.query.await("UPDATE bb_users SET password_hash = ?, salt = ? WHERE id = ?",
        { hash, salt, user.id })
    return ok(true)
end)

----------------------------------------------------------------
-- HELPERS
----------------------------------------------------------------

local function carRow(row)
    return {
        id = row.id, make = row.make, model = row.model, year = row.year,
        price = row.price, mileage = row.mileage, image = row.image,
        description = row.description, status = row.status,
        listingType = row.listing_type, sellerUserId = row.seller_user_id,
        sellerTlfnr = row.seller_tlfnr,
        assignedOfficeId = row.assigned_office_id, assignedOfficeName = row.office_name,
        assignedSellerId = row.assigned_seller_id, assignedSellerTlfnr = row.assigned_seller_tlfnr,
        commissionPct = row.commission_pct, approved = row.approved == 1,
        createdAt = row.created_at,
    }
end

local CARS_SELECT = [[
    SELECT c.*, u.tlfnr AS seller_tlfnr,
           o.name AS office_name,
           s.tlfnr AS assigned_seller_tlfnr
    FROM bb_cars c
    LEFT JOIN bb_users u ON u.id = c.seller_user_id
    LEFT JOIN bb_offices o ON o.id = c.assigned_office_id
    LEFT JOIN bb_users s ON s.id = c.assigned_seller_id
]]

----------------------------------------------------------------
-- CARS (list med sok/filter)
----------------------------------------------------------------

lib.callback.register("bruktbiler:listCars", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end

    local f = payload.filter or {}
    local where = { "c.approved = 1", "c.status IN ('available','auction')" }
    local params = {}

    if f.q and f.q ~= "" then
        table.insert(where, "(c.make LIKE ? OR c.model LIKE ? OR CONCAT(c.make,' ',c.model) LIKE ?)")
        local like = "%" .. f.q .. "%"
        table.insert(params, like); table.insert(params, like); table.insert(params, like)
    end
    if tonumber(f.minPrice) then
        table.insert(where, "c.price >= ?"); table.insert(params, tonumber(f.minPrice))
    end
    if tonumber(f.maxPrice) then
        table.insert(where, "c.price <= ?"); table.insert(params, tonumber(f.maxPrice))
    end
    if tonumber(f.minYear) then
        table.insert(where, "c.year >= ?"); table.insert(params, tonumber(f.minYear))
    end
    if tonumber(f.maxYear) then
        table.insert(where, "c.year <= ?"); table.insert(params, tonumber(f.maxYear))
    end
    if tonumber(f.maxKm) then
        table.insert(where, "c.mileage <= ?"); table.insert(params, tonumber(f.maxKm))
    end
    if f.listingType and f.listingType ~= "" then
        table.insert(where, "c.listing_type = ?"); table.insert(params, f.listingType)
    end
    if f.onlyAuction then
        table.insert(where, "c.status = 'auction'")
    end

    local order = "c.created_at DESC"
    if f.sort == "price_asc" then order = "c.price ASC"
    elseif f.sort == "price_desc" then order = "c.price DESC"
    elseif f.sort == "km_asc" then order = "c.mileage ASC"
    elseif f.sort == "year_desc" then order = "c.year DESC"
    end

    local sql = CARS_SELECT .. " WHERE " .. table.concat(where, " AND ") .. " ORDER BY " .. order
    local rows = MySQL.query.await(sql, params) or {}
    local out = {}
    for i, r in ipairs(rows) do out[i] = carRow(r) end
    return ok(out)
end)

lib.callback.register("bruktbiler:getCar", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end

    local row = MySQL.single.await(CARS_SELECT .. " WHERE c.id = ?", { payload.id })
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
                id = auction.id, startPrice = auction.start_price,
                currentBid = auction.current_bid, currentBidderId = auction.current_bidder_id,
                endsAt = auction.ends_at, status = auction.status, bids = bids,
            }
        end
    end
    car.transferFee = BB_GetSettingInt("transfer_fee", 0)
    car.images = MySQL.query.await(
        "SELECT id, url FROM bb_car_images WHERE car_id = ? ORDER BY ordering ASC, id ASC",
        { car.id }
    ) or {}
    car.wishlisted = MySQL.scalar.await(
        "SELECT 1 FROM bb_wishlist WHERE user_id = ? AND car_id = ?", { user.id, car.id }
    ) ~= nil
    car.reservation = MySQL.single.await([[
        SELECT r.id, r.user_id, r.deposit, r.expires_at, u.tlfnr
        FROM bb_reservations r JOIN bb_users u ON u.id = r.user_id
        WHERE r.car_id = ? AND r.status = 'active' AND r.expires_at > NOW()
        LIMIT 1
    ]], { car.id })
    car.financingPlans = MySQL.query.await([[
        SELECT id, down_payment_pct, term_months, interest_pct
        FROM bb_financing_plans WHERE car_id = ? AND active = 1
        ORDER BY term_months ASC
    ]], { car.id }) or {}
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
        INSERT INTO bb_interests (user_id, car_id, message) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE message = VALUES(message), created_at = CURRENT_TIMESTAMP
    ]], { user.id, carId, message })

    -- Varsle selger/admin tilknyttet bilen.
    local car = MySQL.single.await([[
        SELECT c.id, c.make, c.model, c.assigned_seller_id, c.seller_user_id
        FROM bb_cars c WHERE c.id = ?
    ]], { carId })
    if car then
        local target = car.assigned_seller_id or car.seller_user_id
        if target and target ~= user.id then
            BB_Notify(target, "interest",
                "Ny interesse: " .. car.make .. " " .. car.model,
                user.tlfnr .. ": " .. (message ~= "" and message or "(ingen melding)"),
                car.id
            )
        end
    end
    return ok(true)
end)

lib.callback.register("bruktbiler:listMyInterests", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT i.id, i.message, i.created_at,
               c.id AS car_id, c.make, c.model, c.year, c.price, c.image, c.status
        FROM bb_interests i JOIN bb_cars c ON c.id = i.car_id
        WHERE i.user_id = ? ORDER BY i.created_at DESC
    ]], { user.id }) or {}
    return ok(rows)
end)

----------------------------------------------------------------
-- SELL REQUESTS
----------------------------------------------------------------

local VALID_SELL_TYPES = { consignment_in_shop = true, consignment_remote = true }

lib.callback.register("bruktbiler:submitSellRequest", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end

    local listingType = tostring(payload.listingType or "")
    if not VALID_SELL_TYPES[listingType] then return err("Ugyldig type") end

    local make = tostring(payload.make or "")
    local model = tostring(payload.model or "")
    local year = tonumber(payload.year)
    local price = tonumber(payload.expectedPrice)
    local mileage = tonumber(payload.mileage) or 0
    local image = tostring(payload.image or "")
    local description = tostring(payload.description or "")

    if make == "" or model == "" or not year or not price then
        return err("Mangler obligatoriske felt")
    end

    local id = MySQL.insert.await([[
        INSERT INTO bb_sell_requests
            (user_id, make, model, year, expected_price, mileage, image, description, listing_type, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    ]], { user.id, make, model, year, price, mileage, image, description, listingType })

    -- Varsle alle selgere
    local sellers = MySQL.query.await(
        "SELECT DISTINCT user_id AS id FROM bb_office_members"
    ) or {}
    for _, s in ipairs(sellers) do
        BB_Notify(s.id, "system",
            "Ny salgsforesporsel",
            ("%s onsker hjelp til a selge %s %s"):format(user.tlfnr, make, model),
            nil
        )
    end
    return ok({ id = id })
end)

lib.callback.register("bruktbiler:listMySellRequests", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT r.*, o.name AS office_name, s.tlfnr AS seller_tlfnr
        FROM bb_sell_requests r
        LEFT JOIN bb_offices o ON o.id = r.assigned_office_id
        LEFT JOIN bb_users s ON s.id = r.assigned_seller_id
        WHERE r.user_id = ? ORDER BY r.created_at DESC
    ]], { user.id }) or {}
    return ok(rows)
end)

-- Selger: se ledige + claim.
lib.callback.register("bruktbiler:listOpenSellRequests", function(_, payload)
    local user, e = BB_RequireSeller((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT r.*, u.tlfnr AS owner_tlfnr
        FROM bb_sell_requests r JOIN bb_users u ON u.id = r.user_id
        WHERE r.status IN ('pending','assigned')
        ORDER BY r.created_at DESC
    ]]) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:claimSellRequest", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireSeller(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.requestId)
    if not id then return err("Ugyldig") end

    local req = MySQL.single.await("SELECT * FROM bb_sell_requests WHERE id = ?", { id })
    if not req then return err("Finnes ikke") end
    if req.status ~= "pending" then return err("Allerede tatt") end

    MySQL.query.await([[
        UPDATE bb_sell_requests
        SET status = 'assigned', assigned_office_id = ?, assigned_seller_id = ?
        WHERE id = ?
    ]], { user.office_id, user.id, id })

    BB_Notify(req.user_id, "assignment",
        "Selger tildelt",
        ("%s vil hjelpe deg a selge %s %s"):format(user.tlfnr, req.make, req.model),
        nil
    )
    return ok(true)
end)

-- Selger fullforer: oppretter selve bil-listingen og kobler den til foresporselen.
lib.callback.register("bruktbiler:promoteSellRequestToListing", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireSeller(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.requestId)
    local commission = tonumber(payload.commissionPct) or BB_GetSettingInt("default_commission_pct", 8)
    if not id then return err("Ugyldig") end

    local req = MySQL.single.await("SELECT * FROM bb_sell_requests WHERE id = ?", { id })
    if not req then return err("Finnes ikke") end
    if req.assigned_seller_id ~= user.id and user.is_admin ~= 1 then
        return err("Ikke din foresporsel")
    end

    local carId = MySQL.insert.await([[
        INSERT INTO bb_cars
            (make, model, year, price, mileage, image, description, status, listing_type,
             seller_user_id, assigned_office_id, assigned_seller_id, commission_pct, approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, 1)
    ]], {
        req.make, req.model, req.year, req.expected_price, req.mileage, req.image,
        req.description, req.listing_type, req.user_id,
        user.office_id, user.id, commission,
    })

    MySQL.query.await([[
        UPDATE bb_sell_requests SET status = 'listed', car_id = ? WHERE id = ?
    ]], { carId, id })

    BB_Notify(req.user_id, "system",
        "Bilen din er lagt ut",
        ("Bilen %s %s ligger na ute for salg"):format(req.make, req.model), carId
    )
    BB_Audit(user, "promote_listing", "car", carId, { fromRequest = id })
    pcall(function() BB_TriggerPriceAlerts(carId) end)
    return ok({ carId = carId })
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

    local auction = MySQL.single.await("SELECT * FROM bb_auctions WHERE id = ?", { auctionId })
    if not auction then return err("Auksjon finnes ikke") end
    if auction.status ~= "active" then return err("Auksjonen er ferdig") end

    local secLeft = MySQL.scalar.await(
        "SELECT TIMESTAMPDIFF(SECOND, NOW(), ?)", { auction.ends_at }
    )
    if secLeft and secLeft <= 0 then return err("Auksjonen er ferdig") end

    local minIncrement = BB_GetSettingInt("auction_increment_min", 1000)
    if amount < auction.current_bid + minIncrement then
        return err(("Budet ma vaere minst %d over hoyeste bud"):format(minIncrement))
    end

    local prevBidder = auction.current_bidder_id

    MySQL.insert.await(
        "INSERT INTO bb_bids (auction_id, user_id, amount) VALUES (?, ?, ?)",
        { auctionId, user.id, amount }
    )
    MySQL.query.await(
        "UPDATE bb_auctions SET current_bid = ?, current_bidder_id = ? WHERE id = ?",
        { amount, user.id, auctionId }
    )

    if prevBidder and prevBidder ~= user.id then
        local car = MySQL.single.await(
            "SELECT make, model FROM bb_cars WHERE id = ?", { auction.car_id }
        )
        BB_Notify(prevBidder, "outbid",
            "Du er overbudt!",
            ("Noen bod %d kr pa %s %s"):format(amount, car.make, car.model),
            auction.car_id
        )
    end
    return ok(true)
end)

local function endAuction(auctionId)
    local a = MySQL.single.await("SELECT * FROM bb_auctions WHERE id = ?", { auctionId })
    if not a then return end
    MySQL.query.await("UPDATE bb_auctions SET status = 'ended' WHERE id = ?", { auctionId })
    if a.current_bidder_id then
        MySQL.query.await("UPDATE bb_cars SET status = 'sold' WHERE id = ?", { a.car_id })
        local car = MySQL.single.await(
            "SELECT make, model, assigned_seller_id, seller_user_id FROM bb_cars WHERE id = ?", { a.car_id }
        )
        if car then
            BB_Notify(a.current_bidder_id, "sale",
                "Du vant auksjonen!",
                ("%s %s er din for %d kr"):format(car.make, car.model, a.current_bid),
                a.car_id)
            local target = car.assigned_seller_id or car.seller_user_id
            if target then
                BB_Notify(target, "sale",
                    "Auksjon avsluttet",
                    ("%s %s solgt for %d kr"):format(car.make, car.model, a.current_bid),
                    a.car_id)
            end
        end
    else
        MySQL.query.await("UPDATE bb_cars SET status = 'available' WHERE id = ?", { a.car_id })
    end
end

local function tickAuctions()
    local ended = MySQL.query.await([[
        SELECT id FROM bb_auctions WHERE status = 'active' AND ends_at <= NOW()
    ]]) or {}
    for _, a in ipairs(ended) do endAuction(a.id) end
end

CreateThread(function()
    while true do
        Wait(Config.AuctionTickInterval * 1000)
        local okPcall, errMsg = pcall(tickAuctions)
        if not okPcall then print("[bruktbiler] auction tick error:", errMsg) end
    end
end)

----------------------------------------------------------------
-- SALES (manuell gjennomforing av selger)
----------------------------------------------------------------

lib.callback.register("bruktbiler:listMyAssignedCars", function(_, payload)
    local user, e = BB_RequireSeller((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT c.id, c.make, c.model, c.year, c.price, c.status, c.image
        FROM bb_cars c
        WHERE c.assigned_seller_id = ?
          AND c.status IN ('available','auction','pending')
        ORDER BY c.created_at DESC
    ]], { user.id }) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:completeSale", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireSeller(payload.token)
    if not user then return err(e) end
    local carId = tonumber(payload.carId)
    local buyerTlfnr = tostring(payload.buyerTlfnr or ""):gsub("%s+", "")
    local salePrice = tonumber(payload.salePrice)
    if not carId or buyerTlfnr == "" or not salePrice then return err("Mangler felt") end

    local car = MySQL.single.await("SELECT * FROM bb_cars WHERE id = ?", { carId })
    if not car then return err("Bil finnes ikke") end
    if car.status == "sold" then return err("Allerede solgt") end

    local buyer = MySQL.single.await("SELECT id FROM bb_users WHERE tlfnr = ?", { buyerTlfnr })
    if not buyer then return err("Kjoper med dette tlfnr finnes ikke") end

    local transferFee = BB_GetSettingInt("transfer_fee", 0)
    local commissionAmount = math.floor(salePrice * (car.commission_pct or 0) / 100)

    MySQL.insert.await([[
        INSERT INTO bb_sales
            (car_id, buyer_id, seller_user_id, seller_employee_id, office_id,
             sale_price, transfer_fee, commission_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        carId, buyer.id, car.seller_user_id, user.id, user.office_id,
        salePrice, transferFee, commissionAmount,
    })
    MySQL.query.await("UPDATE bb_cars SET status = 'sold' WHERE id = ?", { carId })

    BB_Notify(buyer.id, "sale",
        "Bilen er din",
        ("%s %s er registrert pa deg. Overforingsgebyr: %d kr"):format(car.make, car.model, transferFee),
        carId)
    if car.seller_user_id and car.seller_user_id ~= buyer.id then
        BB_Notify(car.seller_user_id, "sale",
            "Bilen din er solgt",
            ("%s %s solgt for %d kr"):format(car.make, car.model, salePrice),
            carId)
    end
    BB_Audit(user, "complete_sale", "car", carId,
        { buyer = buyer.id, price = salePrice, commission = commissionAmount })
    return ok({ commission = commissionAmount, transferFee = transferFee })
end)

----------------------------------------------------------------
-- INBOX
----------------------------------------------------------------

lib.callback.register("bruktbiler:listMessages", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT id, type, title, body, link_car_id, is_read, created_at
        FROM bb_messages
        WHERE recipient_id = ?
        ORDER BY created_at DESC LIMIT 100
    ]], { user.id }) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:markMessageRead", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.id)
    if not id then return err("Ugyldig") end
    MySQL.query.await(
        "UPDATE bb_messages SET is_read = 1 WHERE id = ? AND recipient_id = ?",
        { id, user.id }
    )
    return ok(true)
end)

lib.callback.register("bruktbiler:markAllRead", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    MySQL.query.await("UPDATE bb_messages SET is_read = 1 WHERE recipient_id = ?", { user.id })
    return ok(true)
end)

lib.callback.register("bruktbiler:unreadCount", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local n = MySQL.scalar.await(
        "SELECT COUNT(*) FROM bb_messages WHERE recipient_id = ? AND is_read = 0", { user.id }
    )
    return ok(tonumber(n or 0))
end)

----------------------------------------------------------------
-- CHAT
----------------------------------------------------------------

local function findOrCreateThread(carId, customerId)
    local existing = MySQL.single.await(
        "SELECT * FROM bb_chat_threads WHERE car_id = ? AND customer_id = ?",
        { carId, customerId }
    )
    if existing then return existing end

    local sellerId = MySQL.scalar.await([[
        SELECT COALESCE(c.assigned_seller_id, c.seller_user_id)
        FROM bb_cars c WHERE c.id = ?
    ]], { carId })

    local id = MySQL.insert.await(
        "INSERT INTO bb_chat_threads (car_id, customer_id, seller_id) VALUES (?, ?, ?)",
        { carId, customerId, sellerId }
    )
    return MySQL.single.await("SELECT * FROM bb_chat_threads WHERE id = ?", { id })
end

lib.callback.register("bruktbiler:openThread", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local carId = tonumber(payload.carId)
    if not carId then return err("Ugyldig") end
    local thread = findOrCreateThread(carId, user.id)
    return ok(thread)
end)

lib.callback.register("bruktbiler:listMyThreads", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT t.id, t.car_id, t.customer_id, t.seller_id,
               c.make, c.model, c.year, c.image,
               cu.tlfnr AS customer_tlfnr,
               se.tlfnr AS seller_tlfnr,
               (SELECT body FROM bb_chat_messages m WHERE m.thread_id = t.id ORDER BY id DESC LIMIT 1) AS last_msg,
               (SELECT created_at FROM bb_chat_messages m WHERE m.thread_id = t.id ORDER BY id DESC LIMIT 1) AS last_at
        FROM bb_chat_threads t
        JOIN bb_cars c ON c.id = t.car_id
        JOIN bb_users cu ON cu.id = t.customer_id
        LEFT JOIN bb_users se ON se.id = t.seller_id
        WHERE t.customer_id = ? OR t.seller_id = ?
        ORDER BY COALESCE(last_at, t.created_at) DESC
    ]], { user.id, user.id }) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:listThreadMessages", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.threadId)
    if not id then return err("Ugyldig") end

    local thread = MySQL.single.await("SELECT * FROM bb_chat_threads WHERE id = ?", { id })
    if not thread then return err("Ikke funnet") end
    if thread.customer_id ~= user.id and thread.seller_id ~= user.id and user.is_admin ~= 1 then
        return err("Ikke tilgang")
    end
    local rows = MySQL.query.await([[
        SELECT m.id, m.sender_id, m.body, m.created_at, u.tlfnr
        FROM bb_chat_messages m JOIN bb_users u ON u.id = m.sender_id
        WHERE m.thread_id = ? ORDER BY m.id ASC
    ]], { id }) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:sendThreadMessage", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.threadId)
    local body = tostring(payload.body or "")
    if not id or body == "" then return err("Mangler tekst") end

    local thread = MySQL.single.await("SELECT * FROM bb_chat_threads WHERE id = ?", { id })
    if not thread then return err("Ikke funnet") end
    if thread.customer_id ~= user.id and thread.seller_id ~= user.id then
        return err("Ikke tilgang")
    end

    MySQL.insert.await(
        "INSERT INTO bb_chat_messages (thread_id, sender_id, body) VALUES (?, ?, ?)",
        { id, user.id, body }
    )

    local recipient = (thread.customer_id == user.id) and thread.seller_id or thread.customer_id
    if recipient then
        local car = MySQL.single.await(
            "SELECT make, model FROM bb_cars WHERE id = ?", { thread.car_id }
        )
        BB_Notify(recipient, "chat",
            "Ny melding fra " .. user.tlfnr,
            (car and (car.make .. " " .. car.model .. ": ") or "") .. body:sub(1, 80),
            thread.car_id
        )
    end
    return ok(true)
end)

----------------------------------------------------------------
-- ADMIN
----------------------------------------------------------------

lib.callback.register("bruktbiler:adminListUsers", function(_, payload)
    local user, e = BB_RequireAdmin((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT u.id, u.tlfnr, u.name, u.is_admin, u.created_at,
               m.office_id, o.name AS office_name, m.role AS office_role
        FROM bb_users u
        LEFT JOIN bb_office_members m ON m.user_id = u.id
        LEFT JOIN bb_offices o ON o.id = m.office_id
        ORDER BY u.created_at DESC
    ]]) or {}
    -- Annoter med online-status
    local ids = {}
    for i, r in ipairs(rows) do ids[i] = r.id end
    local online = BB_OnlineMap(ids)
    for _, r in ipairs(rows) do r.online = online[r.id] == true end
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
    MySQL.query.await("UPDATE bb_users SET password_hash = ?, salt = ? WHERE id = ?",
        { hash, salt, targetId })
    MySQL.query.await("DELETE FROM bb_sessions WHERE user_id = ?", { targetId })
    BB_Notify(targetId, "system", "Passord tilbakestilt",
        "En admin har tilbakestilt passordet ditt.", nil)
    return ok(true)
end)

lib.callback.register("bruktbiler:adminToggleAdmin", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local targetId = tonumber(payload.targetUserId)
    local makeAdmin = payload.isAdmin and 1 or 0
    MySQL.query.await("UPDATE bb_users SET is_admin = ? WHERE id = ?",
        { makeAdmin, targetId })
    return ok(true)
end)

lib.callback.register("bruktbiler:adminCreateCar", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    if payload.make == "" or payload.model == "" or not tonumber(payload.year) or not tonumber(payload.price) then
        return err("Mangler obligatoriske felt")
    end
    local id = MySQL.insert.await([[
        INSERT INTO bb_cars (make, model, year, price, mileage, image, description,
                             status, listing_type, assigned_office_id, approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'available', 'dealership', ?, 1)
    ]], {
        payload.make, payload.model, tonumber(payload.year), tonumber(payload.price),
        tonumber(payload.mileage) or 0, payload.image or "", payload.description or "",
        payload.officeId,
    })
    BB_Audit(user, "create_car", "car", id, { make = payload.make, model = payload.model })
    pcall(function() BB_TriggerPriceAlerts(id) end)
    return ok({ id = id })
end)

lib.callback.register("bruktbiler:adminUpdateCar", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.id)
    if not id then return err("Ugyldig") end
    MySQL.query.await([[
        UPDATE bb_cars SET make=?, model=?, year=?, price=?, mileage=?, image=?,
                           description=?, status=?, assigned_office_id=?, assigned_seller_id=?
        WHERE id=?
    ]], {
        payload.make, payload.model, payload.year, payload.price,
        payload.mileage or 0, payload.image or "", payload.description or "",
        payload.status or "available",
        payload.officeId, payload.sellerId, id
    })
    return ok(true)
end)

lib.callback.register("bruktbiler:adminDeleteCar", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    MySQL.query.await("DELETE FROM bb_cars WHERE id = ?", { tonumber(payload.id) })
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

    BB_Broadcast("interested", { carId = carId },
        "Bil pa auksjon!",
        "En bil du har vist interesse for er na pa auksjon."
    )
    BB_Audit(user, "create_auction", "car", carId, { startPrice = startPrice, hours = hours })
    return ok({ id = id })
end)

lib.callback.register("bruktbiler:adminEndAuction", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.auctionId)
    if not id then return err("Ugyldig") end
    endAuction(id)
    return ok(true)
end)

lib.callback.register("bruktbiler:adminListPending", function(_, payload)
    local user, e = BB_RequireAdmin((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await(CARS_SELECT .. " WHERE c.approved = 0 ORDER BY c.created_at DESC") or {}
    local out = {}
    for i, r in ipairs(rows) do out[i] = carRow(r) end
    return ok(out)
end)

lib.callback.register("bruktbiler:adminApproveListing", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.carId)
    local commission = tonumber(payload.commissionPct) or BB_GetSettingInt("default_commission_pct", 8)
    if not id then return err("Ugyldig") end
    MySQL.query.await([[
        UPDATE bb_cars SET approved = 1, status = 'available', commission_pct = ?
        WHERE id = ?
    ]], { commission, id })

    local seller = MySQL.scalar.await("SELECT seller_user_id FROM bb_cars WHERE id = ?", { id })
    if seller then
        BB_Notify(seller, "approved", "Annonsen er godkjent",
            "Bilen din er publisert.", id)
    end
    BB_Audit(user, "approve_listing", "car", id, { commissionPct = commission })
    pcall(function() BB_TriggerPriceAlerts(id) end)
    return ok(true)
end)

lib.callback.register("bruktbiler:adminRejectListing", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.carId)
    if not id then return err("Ugyldig") end
    local seller = MySQL.scalar.await("SELECT seller_user_id FROM bb_cars WHERE id = ?", { id })
    MySQL.query.await("DELETE FROM bb_cars WHERE id = ?", { id })
    if seller then
        BB_Notify(seller, "rejected", "Annonsen er avvist",
            "Annonsen din ble avvist av admin.", nil)
    end
    BB_Audit(user, "reject_listing", "car", id)
    return ok(true)
end)

----------------------------------------------------------------
-- ADMIN: OFFICES
----------------------------------------------------------------

lib.callback.register("bruktbiler:listOffices", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT o.id, o.name, o.logo, o.commission_pct, o.created_at,
               (SELECT COUNT(*) FROM bb_office_members m WHERE m.office_id = o.id) AS member_count
        FROM bb_offices o ORDER BY o.created_at DESC
    ]]) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:adminCreateOffice", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local name = tostring(payload.name or "")
    if name == "" then return err("Navn pakrevd") end
    local id = MySQL.insert.await([[
        INSERT INTO bb_offices (name, logo, commission_pct) VALUES (?, ?, ?)
    ]], {
        name, tostring(payload.logo or ""),
        tonumber(payload.commissionPct) or BB_GetSettingInt("default_commission_pct", 8),
    })
    return ok({ id = id })
end)

lib.callback.register("bruktbiler:adminUpdateOffice", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.id)
    if not id then return err("Ugyldig") end
    MySQL.query.await([[
        UPDATE bb_offices SET name = ?, logo = ?, commission_pct = ? WHERE id = ?
    ]], { payload.name, payload.logo or "", tonumber(payload.commissionPct) or 8, id })
    return ok(true)
end)

lib.callback.register("bruktbiler:adminDeleteOffice", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    MySQL.query.await("DELETE FROM bb_offices WHERE id = ?", { tonumber(payload.id) })
    return ok(true)
end)

lib.callback.register("bruktbiler:adminListOfficeMembers", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT m.user_id, m.role, m.joined_at, u.tlfnr
        FROM bb_office_members m JOIN bb_users u ON u.id = m.user_id
        WHERE m.office_id = ? ORDER BY m.joined_at ASC
    ]], { tonumber(payload.officeId) }) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:adminAddMember", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local officeId = tonumber(payload.officeId)
    local userTlfnr = tostring(payload.tlfnr or "")
    local role = payload.role == "manager" and "manager" or "seller"
    if not officeId or userTlfnr == "" then return err("Mangler felt") end

    local target = MySQL.scalar.await("SELECT id FROM bb_users WHERE tlfnr = ?", { userTlfnr })
    if not target then return err("Bruker finnes ikke") end

    -- Bruker kan bare tilhøre ett kontor om gangen
    MySQL.query.await("DELETE FROM bb_office_members WHERE user_id = ?", { target })
    MySQL.query.await([[
        INSERT INTO bb_office_members (office_id, user_id, role) VALUES (?, ?, ?)
    ]], { officeId, target, role })

    BB_Notify(target, "system", "Velkommen til kontoret",
        "Du har blitt tildelt et selger-kontor.", nil)
    return ok(true)
end)

lib.callback.register("bruktbiler:adminRemoveMember", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    MySQL.query.await(
        "DELETE FROM bb_office_members WHERE office_id = ? AND user_id = ?",
        { tonumber(payload.officeId), tonumber(payload.userId) }
    )
    return ok(true)
end)

----------------------------------------------------------------
-- ADMIN: SETTINGS
----------------------------------------------------------------

lib.callback.register("bruktbiler:adminGetSettings", function(_, payload)
    local user, e = BB_RequireAdmin((payload or {}).token)
    if not user then return err(e) end
    return ok(BB_GetAllSettings())
end)

lib.callback.register("bruktbiler:adminSetSetting", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    BB_SetSetting(payload.key, payload.value)
    return ok(true)
end)

----------------------------------------------------------------
-- ADMIN: BROADCAST
----------------------------------------------------------------

-- Admin/manager: trigger native LB Phone-anrop fra en bruker til et tlfnr.
-- F.eks. for a "ringe sammen" en kunde og selger.
lib.callback.register("bruktbiler:placeCallFromUser", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local fromUserId = tonumber(payload.fromUserId)
    local toTlfnr = tostring(payload.toTlfnr or "")
    if not fromUserId or toTlfnr == "" then return err("Mangler felt") end
    local sent = BB_TriggerCallFromUser(fromUserId, toTlfnr)
    if not sent then return err("Brukeren er ikke tilkoblet") end
    return ok(true)
end)

-- Sjekk om en gitt tlfnr/user er online
lib.callback.register("bruktbiler:checkOnline", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local userIds = payload.userIds or {}
    if #userIds == 0 then return ok({}) end
    local online = BB_OnlineMap(userIds)
    local out = {}
    for _, id in ipairs(userIds) do out[#out + 1] = { id = id, online = online[id] == true } end
    return ok(out)
end)

lib.callback.register("bruktbiler:adminBroadcast", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAdmin(payload.token)
    if not user then return err(e) end
    local filter = payload.filter or "all"
    local title = tostring(payload.title or "")
    local body = tostring(payload.body or "")
    if title == "" then return err("Tittel pakrevd") end
    local target = { officeId = tonumber(payload.officeId), carId = tonumber(payload.carId) }
    local sent = BB_Broadcast(filter, target, title, body)
    return ok({ sent = sent })
end)

----------------------------------------------------------------
-- ADMIN: STATS
----------------------------------------------------------------

lib.callback.register("bruktbiler:adminStats", function(_, payload)
    local user, e = BB_RequireAdmin((payload or {}).token)
    if not user then return err(e) end

    local stats = {}
    stats.totalUsers = tonumber(MySQL.scalar.await("SELECT COUNT(*) FROM bb_users") or 0)
    stats.totalCars = tonumber(MySQL.scalar.await("SELECT COUNT(*) FROM bb_cars") or 0)
    stats.activeListings = tonumber(MySQL.scalar.await(
        "SELECT COUNT(*) FROM bb_cars WHERE approved = 1 AND status IN ('available','auction')") or 0)
    stats.pendingListings = tonumber(MySQL.scalar.await(
        "SELECT COUNT(*) FROM bb_cars WHERE approved = 0") or 0)
    stats.activeAuctions = tonumber(MySQL.scalar.await(
        "SELECT COUNT(*) FROM bb_auctions WHERE status = 'active'") or 0)
    stats.totalSales = tonumber(MySQL.scalar.await("SELECT COUNT(*) FROM bb_sales") or 0)
    stats.totalRevenue = tonumber(MySQL.scalar.await("SELECT COALESCE(SUM(sale_price),0) FROM bb_sales") or 0)
    stats.totalCommission = tonumber(MySQL.scalar.await("SELECT COALESCE(SUM(commission_amount),0) FROM bb_sales") or 0)
    stats.totalTransferFees = tonumber(MySQL.scalar.await("SELECT COALESCE(SUM(transfer_fee),0) FROM bb_sales") or 0)

    stats.topBrands = MySQL.query.await([[
        SELECT make, COUNT(*) AS cnt FROM bb_sales s JOIN bb_cars c ON c.id = s.car_id
        GROUP BY make ORDER BY cnt DESC LIMIT 5
    ]]) or {}
    stats.topSellers = MySQL.query.await([[
        SELECT u.tlfnr, COUNT(*) AS cnt, COALESCE(SUM(s.commission_amount),0) AS commission
        FROM bb_sales s JOIN bb_users u ON u.id = s.seller_employee_id
        GROUP BY u.id ORDER BY cnt DESC LIMIT 5
    ]]) or {}
    stats.officeRevenue = MySQL.query.await([[
        SELECT o.name, COUNT(*) AS sales, COALESCE(SUM(s.sale_price),0) AS revenue,
               COALESCE(SUM(s.commission_amount),0) AS commission
        FROM bb_sales s JOIN bb_offices o ON o.id = s.office_id
        GROUP BY o.id ORDER BY revenue DESC LIMIT 10
    ]]) or {}
    stats.recentSales = MySQL.query.await([[
        SELECT s.sale_price, s.commission_amount, s.sold_at,
               c.make, c.model, c.year, b.tlfnr AS buyer_tlfnr
        FROM bb_sales s
        JOIN bb_cars c ON c.id = s.car_id
        JOIN bb_users b ON b.id = s.buyer_id
        ORDER BY s.sold_at DESC LIMIT 10
    ]]) or {}

    return ok(stats)
end)
