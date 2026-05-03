-- Features bygget pa toppen av kjernen: tilbud, wishlist, prisvarsel,
-- galleri, verdi-anslag, audit-visning, mal og lonn.

local function ok(d) return { ok = true, data = d } end
local function err(m) return { ok = false, error = m } end

local function currentPeriod()
    return os.date("%Y-%m")
end

----------------------------------------------------------------
-- OFFERS / TILBUD
----------------------------------------------------------------

lib.callback.register("bruktbiler:createOffer", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local carId = tonumber(payload.carId)
    local amount = tonumber(payload.amount)
    if not carId or not amount or amount <= 0 then return err("Ugyldig tilbud") end

    local car = MySQL.single.await(
        "SELECT id, make, model, assigned_seller_id, seller_user_id FROM bb_cars WHERE id = ?",
        { carId }
    )
    if not car then return err("Bil finnes ikke") end
    local sellerId = car.assigned_seller_id

    local id = MySQL.insert.await([[
        INSERT INTO bb_offers (car_id, buyer_id, seller_id, amount, message, status, parent_offer_id)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
    ]], { carId, user.id, sellerId, amount, tostring(payload.message or ""),
          tonumber(payload.parentOfferId) })

    -- Varsle ansvarlig selger
    if sellerId and sellerId ~= user.id then
        BB_Notify(sellerId, "system",
            "Nytt tilbud: " .. car.make .. " " .. car.model,
            ("%s tilbyr %d kr"):format(user.tlfnr, amount), carId)
    end
    BB_Audit(user, "create_offer", "car", carId, { amount = amount, offerId = id })
    return ok({ id = id })
end)

lib.callback.register("bruktbiler:respondToOffer", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.offerId)
    local action = tostring(payload.action or "")
    if not id then return err("Ugyldig") end

    local offer = MySQL.single.await("SELECT * FROM bb_offers WHERE id = ?", { id })
    if not offer then return err("Tilbud finnes ikke") end
    if offer.seller_id ~= user.id and user.is_admin ~= 1 then
        return err("Bare ansvarlig selger kan svare")
    end
    if offer.status ~= "pending" then return err("Allerede besvart") end

    if action == "accept" then
        MySQL.query.await("UPDATE bb_offers SET status = 'accepted' WHERE id = ?", { id })
        BB_Notify(offer.buyer_id, "system", "Tilbudet ditt ble godtatt!",
            "Selger vil ta kontakt for fullforing.", offer.car_id)
        BB_Audit(user, "accept_offer", "offer", id)
        return ok(true)
    elseif action == "reject" then
        MySQL.query.await("UPDATE bb_offers SET status = 'rejected' WHERE id = ?", { id })
        BB_Notify(offer.buyer_id, "system", "Tilbudet ditt ble avvist",
            tostring(payload.message or ""), offer.car_id)
        BB_Audit(user, "reject_offer", "offer", id)
        return ok(true)
    elseif action == "counter" then
        local counterAmount = tonumber(payload.amount)
        if not counterAmount or counterAmount <= 0 then return err("Mottilbud krever belop") end
        MySQL.query.await("UPDATE bb_offers SET status = 'countered' WHERE id = ?", { id })
        local newId = MySQL.insert.await([[
            INSERT INTO bb_offers (car_id, buyer_id, seller_id, amount, message, status, parent_offer_id)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
        ]], { offer.car_id, offer.buyer_id, user.id, counterAmount,
              tostring(payload.message or ""), id })
        BB_Notify(offer.buyer_id, "system", "Mottilbud mottatt",
            ("Selger tilbyr bilen for %d kr"):format(counterAmount), offer.car_id)
        BB_Audit(user, "counter_offer", "offer", id, { newOfferId = newId, amount = counterAmount })
        return ok({ counterId = newId })
    end
    return err("Ukjent handling")
end)

lib.callback.register("bruktbiler:listOffersForCar", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local carId = tonumber(payload.carId)
    if not carId then return err("Ugyldig") end

    local rows = MySQL.query.await([[
        SELECT o.*, b.tlfnr AS buyer_tlfnr, b.name AS buyer_name,
               s.tlfnr AS seller_tlfnr, s.name AS seller_name
        FROM bb_offers o
        JOIN bb_users b ON b.id = o.buyer_id
        LEFT JOIN bb_users s ON s.id = o.seller_id
        WHERE o.car_id = ?
        ORDER BY o.created_at DESC
    ]], { carId }) or {}
    -- Brukere kan bare se egne tilbud + selger ser alle
    local out = {}
    for _, r in ipairs(rows) do
        if r.buyer_id == user.id or r.seller_id == user.id or user.is_admin == 1 then
            out[#out + 1] = r
        end
    end
    return ok(out)
end)

lib.callback.register("bruktbiler:listMyOffers", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT o.id, o.car_id, o.amount, o.message, o.status, o.created_at, o.parent_offer_id,
               c.make, c.model, c.year, c.image, c.price
        FROM bb_offers o JOIN bb_cars c ON c.id = o.car_id
        WHERE o.buyer_id = ? OR o.seller_id = ?
        ORDER BY o.created_at DESC LIMIT 100
    ]], { user.id, user.id }) or {}
    return ok(rows)
end)

----------------------------------------------------------------
-- WISHLIST
----------------------------------------------------------------

lib.callback.register("bruktbiler:toggleWishlist", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local carId = tonumber(payload.carId)
    if not carId then return err("Ugyldig") end

    local exists = MySQL.scalar.await(
        "SELECT 1 FROM bb_wishlist WHERE user_id = ? AND car_id = ?", { user.id, carId }
    )
    if exists then
        MySQL.query.await("DELETE FROM bb_wishlist WHERE user_id = ? AND car_id = ?",
            { user.id, carId })
        return ok({ saved = false })
    end
    MySQL.query.await("INSERT INTO bb_wishlist (user_id, car_id) VALUES (?, ?)",
        { user.id, carId })
    return ok({ saved = true })
end)

lib.callback.register("bruktbiler:listWishlist", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT c.id, c.make, c.model, c.year, c.price, c.mileage, c.image, c.status,
               c.listing_type AS listingType
        FROM bb_wishlist w JOIN bb_cars c ON c.id = w.car_id
        WHERE w.user_id = ?
        ORDER BY w.created_at DESC
    ]], { user.id }) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:isWishlisted", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local v = MySQL.scalar.await(
        "SELECT 1 FROM bb_wishlist WHERE user_id = ? AND car_id = ?",
        { user.id, tonumber(payload.carId) }
    )
    return ok({ saved = v ~= nil })
end)

----------------------------------------------------------------
-- PRICE ALERTS
----------------------------------------------------------------

lib.callback.register("bruktbiler:createPriceAlert", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local id = MySQL.insert.await([[
        INSERT INTO bb_price_alerts (user_id, make, model, max_price, min_year, max_km)
        VALUES (?, ?, ?, ?, ?, ?)
    ]], {
        user.id,
        payload.make ~= "" and payload.make or nil,
        payload.model ~= "" and payload.model or nil,
        tonumber(payload.maxPrice),
        tonumber(payload.minYear),
        tonumber(payload.maxKm),
    })
    return ok({ id = id })
end)

lib.callback.register("bruktbiler:listPriceAlerts", function(_, payload)
    local user, e = BB_RequireAuth((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await(
        "SELECT * FROM bb_price_alerts WHERE user_id = ? ORDER BY created_at DESC", { user.id }
    ) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:deletePriceAlert", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    MySQL.query.await(
        "DELETE FROM bb_price_alerts WHERE id = ? AND user_id = ?",
        { tonumber(payload.id), user.id }
    )
    return ok(true)
end)

-- Sjekker en bil mot alle aktive alerts og varsler matchende brukere.
function BB_TriggerPriceAlerts(carId)
    local car = MySQL.single.await("SELECT * FROM bb_cars WHERE id = ?", { carId })
    if not car or car.approved ~= 1 then return end
    if car.status ~= "available" and car.status ~= "auction" then return end

    local alerts = MySQL.query.await([[
        SELECT * FROM bb_price_alerts WHERE active = 1
    ]]) or {}
    for _, a in ipairs(alerts) do
        local match = true
        if a.make and a.make ~= "" and a.make:lower() ~= (car.make or ""):lower() then match = false end
        if match and a.model and a.model ~= "" and a.model:lower() ~= (car.model or ""):lower() then match = false end
        if match and a.max_price and car.price > a.max_price then match = false end
        if match and a.min_year and car.year < a.min_year then match = false end
        if match and a.max_km and car.mileage > a.max_km then match = false end
        if match then
            BB_Notify(a.user_id, "system",
                "Pris-varsel match: " .. car.make .. " " .. car.model,
                ("%s %s for %d kr"):format(car.year, car.mileage .. " km", car.price),
                car.id)
        end
    end
end

----------------------------------------------------------------
-- CAR IMAGES (galleri)
----------------------------------------------------------------

lib.callback.register("bruktbiler:listCarImages", function(_, payload)
    payload = payload or {}
    local _, e = BB_RequireAuth(payload.token)
    if e then return err(e) end
    local rows = MySQL.query.await(
        "SELECT id, url, ordering FROM bb_car_images WHERE car_id = ? ORDER BY ordering ASC, id ASC",
        { tonumber(payload.carId) }
    ) or {}
    return ok(rows)
end)

lib.callback.register("bruktbiler:addCarImage", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local carId = tonumber(payload.carId)
    local url = tostring(payload.url or "")
    if not carId or url == "" then return err("Mangler") end

    local car = MySQL.single.await(
        "SELECT seller_user_id, assigned_seller_id FROM bb_cars WHERE id = ?", { carId })
    if not car then return err("Finnes ikke") end
    -- Tillatt: eier av annonsen, tildelt selger, eller admin
    if user.is_admin ~= 1 and car.seller_user_id ~= user.id and car.assigned_seller_id ~= user.id then
        return err("Ikke tilgang")
    end

    local nextOrder = MySQL.scalar.await(
        "SELECT COALESCE(MAX(ordering), -1) + 1 FROM bb_car_images WHERE car_id = ?", { carId }
    ) or 0
    local id = MySQL.insert.await([[
        INSERT INTO bb_car_images (car_id, url, ordering) VALUES (?, ?, ?)
    ]], { carId, url, nextOrder })
    BB_Audit(user, "add_image", "car", carId, { imageId = id })
    return ok({ id = id })
end)

lib.callback.register("bruktbiler:removeCarImage", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.id)
    if not id then return err("Ugyldig") end

    local img = MySQL.single.await("SELECT car_id FROM bb_car_images WHERE id = ?", { id })
    if not img then return err("Finnes ikke") end
    local car = MySQL.single.await(
        "SELECT seller_user_id, assigned_seller_id FROM bb_cars WHERE id = ?", { img.car_id })
    if user.is_admin ~= 1 and (not car or (car.seller_user_id ~= user.id and car.assigned_seller_id ~= user.id)) then
        return err("Ikke tilgang")
    end
    MySQL.query.await("DELETE FROM bb_car_images WHERE id = ?", { id })
    BB_Audit(user, "remove_image", "car", img.car_id, { imageId = id })
    return ok(true)
end)

----------------------------------------------------------------
-- VALUE ESTIMATE
----------------------------------------------------------------

lib.callback.register("bruktbiler:estimateValue", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local make = tostring(payload.make or "")
    local model = tostring(payload.model or "")
    local year = tonumber(payload.year)
    if make == "" or model == "" then return err("Mangler merke/modell") end

    -- Snitt og median fra historiske salg av samme merke/modell
    local rows = MySQL.query.await([[
        SELECT s.sale_price, c.year, c.mileage
        FROM bb_sales s JOIN bb_cars c ON c.id = s.car_id
        WHERE c.make = ? AND c.model = ?
        ORDER BY s.sold_at DESC LIMIT 20
    ]], { make, model }) or {}

    local listingRows = MySQL.query.await([[
        SELECT price, year, mileage FROM bb_cars
        WHERE make = ? AND model = ? AND status = 'available' AND approved = 1
    ]], { make, model }) or {}

    local function avg(arr, key)
        if #arr == 0 then return nil end
        local total = 0
        for _, r in ipairs(arr) do total = total + (r[key] or 0) end
        return math.floor(total / #arr)
    end
    local function adjustForYearAndKm(base, yearDelta, kmDelta)
        if not base then return nil end
        -- Enkel justering: -3% per ar eldre, -1% per 10k km mer (kontra snittet)
        local pct = 1.0 - (yearDelta or 0) * 0.03 - ((kmDelta or 0) / 10000) * 0.01
        if pct < 0.3 then pct = 0.3 end
        if pct > 1.5 then pct = 1.5 end
        return math.floor(base * pct)
    end

    local soldAvg = avg(rows, "sale_price")
    local soldYearAvg = avg(rows, "year")
    local listingAvg = avg(listingRows, "price")

    local yearDelta = (year and soldYearAvg) and (soldYearAvg - year) or 0

    local recommendedSell = adjustForYearAndKm(soldAvg, yearDelta, (tonumber(payload.mileage) or 0) - 0)
        or listingAvg
    local recommendedBuy = recommendedSell and math.floor(recommendedSell * 0.85) or nil

    return ok({
        sampleSize = #rows,
        listingSampleSize = #listingRows,
        avgSoldPrice = soldAvg,
        avgListingPrice = listingAvg,
        suggestedSellPrice = recommendedSell,
        suggestedBuyPrice = recommendedBuy,
        recentSales = rows,
    })
end)

----------------------------------------------------------------
-- AUDIT LOG
----------------------------------------------------------------

lib.callback.register("bruktbiler:adminAuditLog", function(_, payload)
    local user, e = BB_RequireAdmin((payload or {}).token)
    if not user then return err(e) end
    local rows = MySQL.query.await([[
        SELECT id, actor_id, actor_tlfnr, action, target_type, target_id, details, created_at
        FROM bb_audit_log
        ORDER BY id DESC LIMIT 200
    ]]) or {}
    return ok(rows)
end)

----------------------------------------------------------------
-- OFFICE GOALS
----------------------------------------------------------------

lib.callback.register("bruktbiler:getOfficeGoal", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local officeId = tonumber(payload.officeId) or user.office_id
    local period = tostring(payload.period or currentPeriod())
    if not officeId then return err("Mangler kontor") end

    local goal = MySQL.single.await([[
        SELECT * FROM bb_office_goals WHERE office_id = ? AND period = ?
    ]], { officeId, period }) or {
        office_id = officeId, period = period,
        revenue_target = 0, sales_target = 0, notes = "",
    }

    -- Faktiske tall for perioden (denne maneden)
    local actual = MySQL.single.await([[
        SELECT COALESCE(SUM(s.sale_price), 0) AS revenue,
               COUNT(*) AS sales,
               COALESCE(SUM(s.commission_amount), 0) AS commission
        FROM bb_sales s
        WHERE s.office_id = ? AND DATE_FORMAT(s.sold_at, '%Y-%m') = ?
    ]], { officeId, period }) or { revenue = 0, sales = 0, commission = 0 }

    local office = MySQL.single.await(
        "SELECT name, floor_pct, commission_pct FROM bb_offices WHERE id = ?", { officeId }
    )
    local floorPct = (office and office.floor_pct) or 10
    local bonusPool = math.floor(tonumber(actual.commission or 0) * (100 - floorPct) / 100)
    local floorAmount = math.floor(tonumber(actual.commission or 0) * floorPct / 100)

    return ok({
        officeId = officeId, period = period,
        officeName = office and office.name,
        revenueTarget = goal.revenue_target, salesTarget = goal.sales_target,
        notes = goal.notes,
        actualRevenue = tonumber(actual.revenue),
        actualSales = tonumber(actual.sales),
        actualCommission = tonumber(actual.commission),
        floorPct = floorPct, floorAmount = floorAmount,
        bonusPool = bonusPool,
    })
end)

local function isManagerOf(user, officeId)
    if user.is_admin == 1 then return true end
    local role = MySQL.scalar.await(
        "SELECT role FROM bb_office_members WHERE user_id = ? AND office_id = ?",
        { user.id, officeId }
    )
    return role == "manager"
end

lib.callback.register("bruktbiler:setOfficeGoal", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local officeId = tonumber(payload.officeId) or user.office_id
    if not officeId then return err("Mangler kontor") end
    if not isManagerOf(user, officeId) then return err("Krever kontorsjef eller admin") end

    local period = tostring(payload.period or currentPeriod())
    MySQL.query.await([[
        INSERT INTO bb_office_goals (office_id, period, revenue_target, sales_target, notes)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE revenue_target = VALUES(revenue_target),
            sales_target = VALUES(sales_target), notes = VALUES(notes)
    ]], { officeId, period,
          tonumber(payload.revenueTarget) or 0, tonumber(payload.salesTarget) or 0,
          tostring(payload.notes or "") })

    BB_Audit(user, "set_office_goal", "office", officeId,
        { period = period, revenueTarget = payload.revenueTarget, salesTarget = payload.salesTarget })
    return ok(true)
end)

----------------------------------------------------------------
-- PAYOUTS / LONN-REGNSKAP
----------------------------------------------------------------

-- Selger ser hva de har opptjent denne maneden
lib.callback.register("bruktbiler:myEarnings", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local period = tostring(payload.period or currentPeriod())

    local earned = MySQL.single.await([[
        SELECT COUNT(*) AS sales,
               COALESCE(SUM(sale_price), 0) AS revenue,
               COALESCE(SUM(commission_amount), 0) AS commission
        FROM bb_sales
        WHERE seller_employee_id = ? AND DATE_FORMAT(sold_at, '%Y-%m') = ?
    ]], { user.id, period }) or { sales = 0, revenue = 0, commission = 0 }

    local payouts = MySQL.query.await([[
        SELECT id, period, amount, note, paid, paid_at, created_at
        FROM bb_payouts WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
    ]], { user.id }) or {}

    local owed = MySQL.scalar.await([[
        SELECT COALESCE(SUM(amount), 0) FROM bb_payouts WHERE user_id = ? AND paid = 0
    ]], { user.id }) or 0

    return ok({
        period = period, sales = tonumber(earned.sales),
        revenue = tonumber(earned.revenue), commission = tonumber(earned.commission),
        outstanding = tonumber(owed),
        payouts = payouts,
    })
end)

-- Manager: liste over selgere i kontoret + opptjent provisjon for perioden
lib.callback.register("bruktbiler:officeEarnings", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local officeId = tonumber(payload.officeId) or user.office_id
    if not officeId then return err("Mangler kontor") end
    if not isManagerOf(user, officeId) then return err("Krever kontorsjef eller admin") end
    local period = tostring(payload.period or currentPeriod())

    local rows = MySQL.query.await([[
        SELECT u.id, u.name, u.tlfnr, m.role,
               COALESCE(SUM(s.commission_amount), 0) AS commission,
               COUNT(s.id) AS sales,
               COALESCE(SUM(s.sale_price), 0) AS revenue
        FROM bb_office_members m
        JOIN bb_users u ON u.id = m.user_id
        LEFT JOIN bb_sales s ON s.seller_employee_id = u.id
            AND DATE_FORMAT(s.sold_at, '%Y-%m') = ?
        WHERE m.office_id = ?
        GROUP BY u.id ORDER BY commission DESC
    ]], { period, officeId }) or {}

    local outstanding = MySQL.query.await([[
        SELECT user_id, COALESCE(SUM(amount), 0) AS amount
        FROM bb_payouts WHERE office_id = ? AND paid = 0 GROUP BY user_id
    ]], { officeId }) or {}
    local outMap = {}
    for _, o in ipairs(outstanding) do outMap[o.user_id] = tonumber(o.amount) end
    for _, r in ipairs(rows) do r.outstanding = outMap[r.id] or 0 end

    return ok(rows)
end)

lib.callback.register("bruktbiler:createPayout", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local officeId = tonumber(payload.officeId) or user.office_id
    local targetUserId = tonumber(payload.userId)
    local amount = tonumber(payload.amount)
    if not officeId or not targetUserId or not amount or amount <= 0 then return err("Mangler felt") end
    if not isManagerOf(user, officeId) then return err("Krever kontorsjef eller admin") end

    local period = tostring(payload.period or currentPeriod())
    local id = MySQL.insert.await([[
        INSERT INTO bb_payouts (office_id, user_id, period, amount, note, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?)
    ]], { officeId, targetUserId, period, amount, tostring(payload.note or ""), user.id })
    BB_Notify(targetUserId, "system", "Bonus tildelt",
        ("Du har fatt %d kr i bonus for %s. Husk a hente fra kontorsjef!"):format(amount, period), nil)
    BB_Audit(user, "create_payout", "user", targetUserId,
        { officeId = officeId, period = period, amount = amount })
    return ok({ id = id })
end)

lib.callback.register("bruktbiler:markPayoutPaid", function(_, payload)
    payload = payload or {}
    local user, e = BB_RequireAuth(payload.token)
    if not user then return err(e) end
    local id = tonumber(payload.id)
    if not id then return err("Ugyldig") end

    local p = MySQL.single.await("SELECT * FROM bb_payouts WHERE id = ?", { id })
    if not p then return err("Finnes ikke") end
    if not isManagerOf(user, p.office_id) then return err("Krever kontorsjef eller admin") end

    MySQL.query.await([[
        UPDATE bb_payouts SET paid = 1, paid_at = NOW(), paid_by_user_id = ? WHERE id = ?
    ]], { user.id, id })
    BB_Notify(p.user_id, "system", "Bonus utbetalt",
        ("%d kr markert som utbetalt"):format(p.amount), nil)
    BB_Audit(user, "mark_payout_paid", "payout", id)
    return ok(true)
end)
