-- Bruktbiler client
-- Registrerer LB Phone-appen og fungerer som NUI <-> server bro.

while GetResourceState("lb-phone") ~= "started" do
    Wait(500)
end

Wait(1000)

local url = GetResourceMetadata(GetCurrentResourceName(), "ui_page", 0)

local function AddApp()
    local added, errorMessage = exports["lb-phone"]:AddCustomApp({
        identifier = Config.Identifier,
        name = Config.Name,
        description = Config.Description,
        developer = Config.Developer,
        defaultApp = Config.DefaultApp,
        size = 24500,
        ui = url:find("http") and url or GetCurrentResourceName() .. "/" .. url,
        icon = url:find("http") and url .. "/public/icon.svg"
            or "https://cfx-nui-" .. GetCurrentResourceName() .. "/ui/dist/icon.svg",
        fixBlur = true,
    })

    if not added then
        print("[bruktbiler] Kunne ikke installere app:", errorMessage)
    end
end

AddApp()

AddEventHandler("onResourceStart", function(resource)
    if resource == "lb-phone" then
        AddApp()
    end
end)

-- Innkommende: server ber denne klienten starte et anrop til et tlfnr.
RegisterNetEvent("bruktbiler:placeCall", function(targetTlfnr)
    if not targetTlfnr or targetTlfnr == "" then return end
    local ok, err = pcall(function()
        exports["lb-phone"]:StartCall({ number = targetTlfnr })
    end)
    if not ok then print("[bruktbiler] StartCall feilet:", err) end
end)

RegisterNUICallback("bruktbiler:call", function(payload, cb)
    local event = payload and payload.event
    local data = payload and payload.data or {}
    if not event or type(event) ~= "string" then
        cb({ ok = false, error = "Manglende event" })
        return
    end

    local ok, result = pcall(function()
        return lib.callback.await("bruktbiler:" .. event, false, data)
    end)

    if not ok then
        cb({ ok = false, error = "Server-feil: " .. tostring(result) })
        return
    end
    cb(result)
end)
