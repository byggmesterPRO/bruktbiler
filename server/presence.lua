-- Online-status og ring-fra-spiller helpers.

---@param source integer
---@return string|nil
function BB_GetLicense(source)
    if not source or source == 0 then return nil end
    for _, id in ipairs(GetPlayerIdentifiers(source) or {}) do
        if id:sub(1, 8) == "license:" then return id end
    end
    return nil
end

---@param license string
---@return integer|nil player source if online
function BB_FindSourceByLicense(license)
    if not license then return nil end
    for _, src in ipairs(GetPlayers()) do
        local s = tonumber(src)
        for _, id in ipairs(GetPlayerIdentifiers(s) or {}) do
            if id == license then return s end
        end
    end
    return nil
end

---@param userIds integer[]
---@return table<integer, boolean> map of userId -> online?
function BB_OnlineMap(userIds)
    if not userIds or #userIds == 0 then return {} end
    -- Hent licenses for de aktuelle brukerne
    local placeholders = {}
    for i = 1, #userIds do placeholders[i] = "?" end
    local rows = MySQL.query.await(
        ("SELECT id, license FROM bb_users WHERE id IN (%s)"):format(table.concat(placeholders, ",")),
        userIds
    ) or {}

    -- Bygg license-set for online spillere
    local online = {}
    for _, src in ipairs(GetPlayers()) do
        for _, id in ipairs(GetPlayerIdentifiers(tonumber(src)) or {}) do
            if id:sub(1, 8) == "license:" then
                online[id] = true
                break
            end
        end
    end

    local map = {}
    for _, r in ipairs(rows) do
        if r.license and online[r.license] then map[r.id] = true end
    end
    return map
end

---@param userId integer
---@return boolean
function BB_IsUserOnline(userId)
    local license = MySQL.scalar.await("SELECT license FROM bb_users WHERE id = ?", { userId })
    if not license then return false end
    return BB_FindSourceByLicense(license) ~= nil
end

-- Trigger en native LB Phone-call fra en spiller til et annet tlfnr.
-- Bruker NetEvent som client lytter pa.
---@param userId integer    user som skal initiere anropet
---@param targetTlfnr string nummeret det ringes til
---@return boolean ok
function BB_TriggerCallFromUser(userId, targetTlfnr)
    local license = MySQL.scalar.await("SELECT license FROM bb_users WHERE id = ?", { userId })
    if not license then return false end
    local src = BB_FindSourceByLicense(license)
    if not src then return false end
    TriggerClientEvent("bruktbiler:placeCall", src, targetTlfnr)
    return true
end
