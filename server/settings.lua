function BB_GetSetting(key, default)
    local v = MySQL.scalar.await("SELECT `value` FROM bb_settings WHERE `key` = ?", { key })
    if v == nil then return default end
    return v
end

function BB_GetSettingInt(key, default)
    local v = BB_GetSetting(key, nil)
    if not v then return default end
    return tonumber(v) or default
end

function BB_SetSetting(key, value)
    MySQL.query.await([[
        INSERT INTO bb_settings (`key`, `value`) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)
    ]], { key, tostring(value) })
end

function BB_GetAllSettings()
    return MySQL.query.await("SELECT `key`, `value`, updated_at FROM bb_settings") or {}
end
