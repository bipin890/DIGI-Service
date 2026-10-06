import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false }
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGSERIAL PRIMARY KEY,
      invoice_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
      customer_phone TEXT,
      service_name TEXT NOT NULL,
      description TEXT,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
      service_charge NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_charge >= 0),
      discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
      total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      payment_status TEXT NOT NULL DEFAULT 'Paid',
      transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      note TEXT,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date);
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS items JSONB;
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
