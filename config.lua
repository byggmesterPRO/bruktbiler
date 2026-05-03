Config = {}

Config.Identifier = "bruktbiler"
Config.DefaultApp = false

Config.Name = "Bruktbiler"
Config.Description = "Premium bruktbiler — kjop, salg og auksjon."
Config.Developer = "Einar"

-- Sesjonens varighet i sekunder (7 dager)
Config.SessionTTL = 60 * 60 * 24 * 7

-- Default admin (lages forste gang serveren starter dersom ingen admin finnes)
Config.DefaultAdmin = {
    tlfnr = "00000000",
    password = "admin"
}

-- Hvor ofte (sekunder) vi sjekker om auksjoner er ferdige
Config.AuctionTickInterval = 30

-- Standard kommisjon (%) admin tar pa konsignasjons-/private salg
Config.DefaultCommissionPct = 8
