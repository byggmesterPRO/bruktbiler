-- Lett audit-logger. Bruk fra alle skrive-callbacks som er admin/selger-aksjoner.

---@param actor table|nil bruker-rad fra BB_RequireAuth (id, tlfnr)
---@param action string kortnavn pa hva som skjedde, f.eks. "approve_listing"
---@param targetType string|nil hva det gjelder ("car","user","office","offer","payout"...)
---@param targetId integer|nil
---@param details table|string|nil ekstra info, lagres som JSON
function BB_Audit(actor, action, targetType, targetId, details)
    local detailStr
    if type(details) == "table" then
        detailStr = json.encode(details)
    elseif details ~= nil then
        detailStr = tostring(details)
    end
    pcall(function()
        MySQL.insert.await([[
            INSERT INTO bb_audit_log (actor_id, actor_tlfnr, action, target_type, target_id, details)
            VALUES (?, ?, ?, ?, ?, ?)
        ]], { actor and actor.id or nil, actor and actor.tlfnr or nil,
              action, targetType, targetId, detailStr })
    end)
end
