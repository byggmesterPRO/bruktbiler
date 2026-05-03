-- Felles helper for varsler: lagrer en inbox-melding + sender push via lb-phone.
-- Push krever at lb-phone har "PhoneNumber"-mapping fra spiller -> tlfnr.
-- Vi sender derfor pa tlfnr (fra bb_users) via lb-phone-eksport.

local function getTlfnr(userId)
    return MySQL.scalar.await("SELECT tlfnr FROM bb_users WHERE id = ?", { userId })
end

local function pushPhone(tlfnr, title, content, linkCarId)
    if not tlfnr then return end
    local ok, err = pcall(function()
        exports["lb-phone"]:SendNotification({
            phoneNumber = tlfnr,
            app = Config.Identifier,
            title = title,
            content = content or "",
            -- Kan utvides med "actions" pekende pa bil-id.
        })
    end)
    if not ok then
        print("[bruktbiler] push fail:", err)
    end
end

---@param userId integer
---@param msgType string
---@param title string
---@param body string|nil
---@param linkCarId integer|nil
function BB_Notify(userId, msgType, title, body, linkCarId)
    if not userId then return end
    MySQL.insert.await([[
        INSERT INTO bb_messages (recipient_id, type, title, body, link_car_id)
        VALUES (?, ?, ?, ?, ?)
    ]], { userId, msgType, title, body or "", linkCarId })

    pushPhone(getTlfnr(userId), title, body, linkCarId)
end

---@param userIds integer[]
function BB_NotifyMany(userIds, msgType, title, body, linkCarId)
    for _, id in ipairs(userIds or {}) do
        BB_Notify(id, msgType, title, body, linkCarId)
    end
end

---@param filter "all"|"sellers"|"interested"|"office"|"car"
---@param target table extra info: officeId | carId
function BB_Broadcast(filter, target, title, body)
    local rows
    if filter == "all" then
        rows = MySQL.query.await("SELECT id FROM bb_users") or {}
    elseif filter == "sellers" then
        rows = MySQL.query.await("SELECT DISTINCT user_id AS id FROM bb_office_members") or {}
    elseif filter == "office" and target.officeId then
        rows = MySQL.query.await("SELECT user_id AS id FROM bb_office_members WHERE office_id = ?", { target.officeId }) or {}
    elseif filter == "interested" then
        rows = MySQL.query.await("SELECT DISTINCT user_id AS id FROM bb_interests") or {}
    elseif filter == "car" and target.carId then
        rows = MySQL.query.await("SELECT DISTINCT user_id AS id FROM bb_interests WHERE car_id = ?", { target.carId }) or {}
    else
        rows = {}
    end
    for _, r in ipairs(rows) do
        BB_Notify(r.id, "broadcast", title, body, target.carId)
    end
    return #rows
end
