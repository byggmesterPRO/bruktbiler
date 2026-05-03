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
    CREATE TABLE IF NOT EXISTS bb_settings (
        `key` VARCHAR(64) PRIMARY KEY,
        `value` TEXT,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_offices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        logo TEXT,
        commission_pct INT NOT NULL DEFAULT 8,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_office_members (
        office_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('seller','manager') NOT NULL DEFAULT 'seller',
        joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (office_id, user_id),
        FOREIGN KEY (office_id) REFERENCES bb_offices(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES bb_users(id) ON DELETE CASCADE
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
        assigned_office_id INT NULL,
        assigned_seller_id INT NULL,
        commission_pct INT NOT NULL DEFAULT 0,
        approved TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_user_id) REFERENCES bb_users(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_office_id) REFERENCES bb_offices(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_seller_id) REFERENCES bb_users(id) ON DELETE SET NULL
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
    CREATE TABLE IF NOT EXISTS bb_sell_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        make VARCHAR(64) NOT NULL,
        model VARCHAR(64) NOT NULL,
        year INT NOT NULL,
        expected_price INT NOT NULL,
        mileage INT NOT NULL DEFAULT 0,
        image TEXT,
        description TEXT,
        listing_type ENUM('consignment_in_shop','consignment_remote') NOT NULL DEFAULT 'consignment_remote',
        status ENUM('pending','assigned','listed','closed','rejected') NOT NULL DEFAULT 'pending',
        assigned_office_id INT NULL,
        assigned_seller_id INT NULL,
        car_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES bb_users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_office_id) REFERENCES bb_offices(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_seller_id) REFERENCES bb_users(id) ON DELETE SET NULL,
        FOREIGN KEY (car_id) REFERENCES bb_cars(id) ON DELETE SET NULL
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
    CREATE TABLE IF NOT EXISTS bb_sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        car_id INT NOT NULL,
        buyer_id INT NOT NULL,
        seller_user_id INT NULL,
        seller_employee_id INT NULL,
        office_id INT NULL,
        sale_price INT NOT NULL,
        transfer_fee INT NOT NULL DEFAULT 0,
        commission_amount INT NOT NULL DEFAULT 0,
        sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id) REFERENCES bb_cars(id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES bb_users(id) ON DELETE CASCADE,
        FOREIGN KEY (seller_user_id) REFERENCES bb_users(id) ON DELETE SET NULL,
        FOREIGN KEY (seller_employee_id) REFERENCES bb_users(id) ON DELETE SET NULL,
        FOREIGN KEY (office_id) REFERENCES bb_offices(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient_id INT NOT NULL,
        type ENUM('system','outbid','interest','approved','rejected','sale','broadcast','assignment','chat') NOT NULL DEFAULT 'system',
        title VARCHAR(255) NOT NULL,
        body TEXT,
        link_car_id INT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recipient_id) REFERENCES bb_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_chat_threads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        car_id INT NOT NULL,
        customer_id INT NOT NULL,
        seller_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_car_customer (car_id, customer_id),
        FOREIGN KEY (car_id) REFERENCES bb_cars(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES bb_users(id) ON DELETE CASCADE,
        FOREIGN KEY (seller_id) REFERENCES bb_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        thread_id INT NOT NULL,
        sender_id INT NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES bb_chat_threads(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES bb_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_offers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        car_id INT NOT NULL,
        buyer_id INT NOT NULL,
        seller_id INT NULL,
        amount INT NOT NULL,
        message TEXT,
        status ENUM('pending','accepted','rejected','countered','expired') NOT NULL DEFAULT 'pending',
        parent_offer_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id) REFERENCES bb_cars(id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES bb_users(id) ON DELETE CASCADE,
        FOREIGN KEY (seller_id) REFERENCES bb_users(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_offer_id) REFERENCES bb_offers(id) ON DELETE SET NULL,
        INDEX idx_offers_car (car_id),
        INDEX idx_offers_buyer (buyer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_wishlist (
        user_id INT NOT NULL,
        car_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, car_id),
        FOREIGN KEY (user_id) REFERENCES bb_users(id) ON DELETE CASCADE,
        FOREIGN KEY (car_id) REFERENCES bb_cars(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_price_alerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        make VARCHAR(64) NULL,
        model VARCHAR(64) NULL,
        max_price INT NULL,
        min_year INT NULL,
        max_km INT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES bb_users(id) ON DELETE CASCADE,
        INDEX idx_alerts_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_car_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        car_id INT NOT NULL,
        url TEXT NOT NULL,
        ordering INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id) REFERENCES bb_cars(id) ON DELETE CASCADE,
        INDEX idx_imgs_car (car_id, ordering)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor_id INT NULL,
        actor_tlfnr VARCHAR(32) NULL,
        action VARCHAR(64) NOT NULL,
        target_type VARCHAR(32) NULL,
        target_id INT NULL,
        details TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_action (action, created_at),
        INDEX idx_audit_actor (actor_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_office_goals (
        office_id INT NOT NULL,
        period CHAR(7) NOT NULL,
        revenue_target INT NOT NULL DEFAULT 0,
        sales_target INT NOT NULL DEFAULT 0,
        notes TEXT,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (office_id, period),
        FOREIGN KEY (office_id) REFERENCES bb_offices(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_payouts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        office_id INT NOT NULL,
        user_id INT NOT NULL,
        period CHAR(7) NOT NULL,
        amount INT NOT NULL,
        note VARCHAR(255),
        paid TINYINT(1) NOT NULL DEFAULT 0,
        paid_at DATETIME NULL,
        paid_by_user_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by_user_id INT NULL,
        FOREIGN KEY (office_id) REFERENCES bb_offices(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES bb_users(id) ON DELETE CASCADE,
        INDEX idx_payouts_user (user_id, period)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_reservations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        car_id INT NOT NULL,
        user_id INT NOT NULL,
        deposit INT NOT NULL,
        expires_at DATETIME NOT NULL,
        status ENUM('active','cancelled','converted','expired') NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id) REFERENCES bb_cars(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES bb_users(id) ON DELETE CASCADE,
        INDEX idx_res_car_status (car_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_financing_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        car_id INT NOT NULL,
        down_payment_pct INT NOT NULL DEFAULT 20,
        term_months INT NOT NULL DEFAULT 36,
        interest_pct DECIMAL(5,2) NOT NULL DEFAULT 5.0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id) REFERENCES bb_cars(id) ON DELETE CASCADE,
        INDEX idx_fin_car (car_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]],
    [[
    CREATE TABLE IF NOT EXISTS bb_financing_applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL,
        car_id INT NOT NULL,
        buyer_id INT NOT NULL,
        status ENUM('pending','approved','rejected','active','completed','cancelled') NOT NULL DEFAULT 'pending',
        sale_price INT NOT NULL,
        down_payment INT NOT NULL,
        term_months INT NOT NULL,
        interest_pct DECIMAL(5,2) NOT NULL,
        monthly_payment INT NOT NULL,
        total_payable INT NOT NULL,
        amount_paid INT NOT NULL DEFAULT 0,
        next_due DATE NULL,
        message TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES bb_financing_plans(id) ON DELETE CASCADE,
        FOREIGN KEY (car_id) REFERENCES bb_cars(id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES bb_users(id) ON DELETE CASCADE,
        INDEX idx_finapp_buyer (buyer_id),
        INDEX idx_finapp_car (car_id)
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

local DEFAULT_SETTINGS = {
    transfer_fee = "5000",
    default_commission_pct = "8",
    auction_increment_min = "1000",
    enable_p2p_chat = "1",
    reservation_deposit_pct = "5",
    reservation_default_hours = "24",
}

function BB_InstallSchema()
    for _, stmt in ipairs(SCHEMA) do
        MySQL.query.await(stmt)
    end
    local function ensureCol(table, col, def)
        local exists = MySQL.scalar.await([[
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
        ]], { table, col })
        if (exists or 0) == 0 then
            MySQL.query.await(("ALTER TABLE %s ADD COLUMN %s %s"):format(table, col, def))
        end
    end
    ensureCol("bb_cars", "assigned_office_id", "INT NULL")
    ensureCol("bb_cars", "assigned_seller_id", "INT NULL")
    ensureCol("bb_users", "name", "VARCHAR(80) NULL")
    ensureCol("bb_users", "license", "VARCHAR(80) NULL")
    -- Floor-pct: andel av provisjon som gar "opp" til selskapet (resten = bonus-pool)
    ensureCol("bb_offices", "floor_pct", "INT NOT NULL DEFAULT 10")
    -- Index for fast online-lookup
    local idx = MySQL.scalar.await([[
        SELECT COUNT(*) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bb_users' AND INDEX_NAME = 'idx_users_license'
    ]])
    if (idx or 0) == 0 then
        pcall(function()
            MySQL.query.await("CREATE INDEX idx_users_license ON bb_users(license)")
        end)
    end

    for k, v in pairs(DEFAULT_SETTINGS) do
        MySQL.query.await([[
            INSERT IGNORE INTO bb_settings (`key`, `value`) VALUES (?, ?)
        ]], { k, v })
    end

    print("[bruktbiler] DB-skjema klar.")
end

AddEventHandler("onResourceStart", function(name)
    if name ~= GetCurrentResourceName() then return end
    BB_InstallSchema()
    BB_EnsureDefaultAdmin()
end)
