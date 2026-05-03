local SCHEMA = {
    [[
    CREATE TABLE IF NOT EXISTS bb_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tlfnr VARCHAR(32) NOT NULL UNIQUE,
        password_hash VARCHAR(128) NOT NULL,
        salt VARCHAR(64) NOT NULL,
        is_admin TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_cars (
        id INT AUTO_INCREMENT PRIMARY KEY,
        make VARCHAR(64) NOT NULL,
        model VARCHAR(64) NOT NULL,
        year INT NOT NULL,
        price INT NOT NULL,
        mileage INT NOT NULL DEFAULT 0,
        image TEXT,
        description TEXT,
        status ENUM('available','sold','auction','pending','withdrawn') NOT NULL DEFAULT 'available',
        listing_type ENUM('dealership','consignment_in_shop','consignment_remote','private') NOT NULL DEFAULT 'dealership',
        seller_user_id INT NULL,
        commission_pct INT NOT NULL DEFAULT 0,
        approved TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_user_id) REFERENCES bb_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_interests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        car_id INT NOT NULL,
        message TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_car (user_id, car_id),
        FOREIGN KEY (user_id) REFERENCES bb_users(id) ON DELETE CASCADE,
        FOREIGN KEY (car_id) REFERENCES bb_cars(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_auctions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        car_id INT NOT NULL,
        start_price INT NOT NULL,
        current_bid INT NOT NULL,
        current_bidder_id INT NULL,
        ends_at DATETIME NOT NULL,
        status ENUM('active','ended') NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id) REFERENCES bb_cars(id) ON DELETE CASCADE,
        FOREIGN KEY (current_bidder_id) REFERENCES bb_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_bids (
        id INT AUTO_INCREMENT PRIMARY KEY,
        auction_id INT NOT NULL,
        user_id INT NOT NULL,
        amount INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (auction_id) REFERENCES bb_auctions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES bb_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_sessions (
        token VARCHAR(64) PRIMARY KEY,
        user_id INT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES bb_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]]
}

function BB_InstallSchema()
    for _, stmt in ipairs(SCHEMA) do
        MySQL.query.await(stmt)
    end
    print("[bruktbiler] DB-skjema klar.")
end

AddEventHandler("onResourceStart", function(name)
    if name ~= GetCurrentResourceName() then return end
    BB_InstallSchema()
    BB_EnsureDefaultAdmin()
end)
