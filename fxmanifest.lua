fx_version "cerulean"
game "gta5"

title "Bruktbiler"
description "Premium bruktbiler-app for LB Phone — kjop, salg, konsignasjon og auksjon."
author "Einar"
version "1.0.0"

dependencies {
    "lb-phone",
    "oxmysql",
    "ox_lib"
}

shared_script "@ox_lib/init.lua"
shared_script "config.lua"

client_script "client/**.lua"

server_scripts {
    "@oxmysql/lib/MySQL.lua",
    "server/**.lua"
}

files {
    "ui/dist/**/*",
    "ui/public/**/*"
}

ui_page "ui/dist/index.html"
-- ui_page "http://localhost:3000/"
