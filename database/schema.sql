-- Database Schema for Collection App

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL UNIQUE,
    payment_frequency TEXT CHECK(payment_frequency IN ('diario', 'semanal', 'quincenal')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Payments and Reminders table
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    due_date DATETIME NOT NULL,
    status TEXT CHECK(status IN ('pendiente', 'pagado', 'atrasado')) DEFAULT 'pendiente',
    payment_method TEXT CHECK(payment_method IN ('yape', 'plin', 'transferencia', 'efectivo')),
    operation_number TEXT,
    screenshot_path TEXT,
    next_reminder_at DATETIME,
    reminder_count INTEGER DEFAULT 0,
    paid_at DATETIME,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Conversations log
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    message_from TEXT CHECK(message_from IN ('bot', 'client')) NOT NULL,
    content TEXT,
    message_type TEXT DEFAULT 'text',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Payment Promises (Optional but useful for clean logic)
CREATE TABLE IF NOT EXISTS payment_promises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL,
    promised_at DATETIME NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id)
);
