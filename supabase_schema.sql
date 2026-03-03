-- Run this entire script in the Supabase SQL Editor

-- 0. Drop existing tables to recreate with RLS and user_id
DROP TABLE IF EXISTS sync_events CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS store_settings CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;

-- 1. Create the Products Table
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    "costPrice" NUMERIC DEFAULT 0,
    category TEXT NOT NULL,
    subcategory TEXT,
    image TEXT,
    stock NUMERIC NOT NULL DEFAULT 0,
    "isBulk" BOOLEAN DEFAULT FALSE,
    yield NUMERIC,
    "tubCost" NUMERIC,
    "isDeleted" BOOLEAN DEFAULT FALSE, -- SOFT DELETE
    "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Multi-tenant isolation
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create the Orders Table
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    "localId" TEXT UNIQUE, 
    items JSONB NOT NULL,
    "totalAmount" NUMERIC NOT NULL,
    status TEXT NOT NULL,
    "cashierId" TEXT, -- Tracked for accountability
    "cashierName" TEXT, -- Tracked for reporting
    "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.1 Create the Shifts Table
CREATE TABLE shifts (
    id BIGSERIAL PRIMARY KEY,
    "localId" TEXT UNIQUE,
    "cashierId" TEXT NOT NULL,
    "cashierName" TEXT NOT NULL,
    "startTime" TIMESTAMP WITH TIME ZONE NOT NULL,
    "endTime" TIMESTAMP WITH TIME ZONE,
    "startingCash" NUMERIC NOT NULL,
    "expectedClosingCash" NUMERIC,
    "actualClosingCash" NUMERIC,
    variance NUMERIC,
    status TEXT NOT NULL,
    "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 Create the Staff Table
CREATE TABLE staff (
    id BIGSERIAL PRIMARY KEY,
    "localId" TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    "isDeleted" BOOLEAN DEFAULT FALSE, -- SOFT DELETE
    "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.3 Create the Store Settings Table
CREATE TABLE store_settings (
    id BIGSERIAL PRIMARY KEY,
    "localId" TEXT UNIQUE,
    "storeName" TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    "taxRate" NUMERIC DEFAULT 13,
    "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pre-defined helper: Check if user is an admin
-- Note: This assumes the app's logic manages the 'staff' table which we trust
-- In a real prod environment, we might use a separate 'profiles' table or JWT claims

-- 4. Set up Strict Row Level Security (RLS) Multi-Tenancy
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- PRODUCTS: Tenant isolation
CREATE POLICY "Products: Tenant Isolation" ON products 
    FOR ALL USING (auth.uid() = user_id);

-- ORDERS: Admin sees all, Cashier sees own
CREATE POLICY "Orders: Admin Full Access" ON orders
    FOR ALL USING (
        auth.uid() = user_id AND 
        EXISTS (SELECT 1 FROM staff s WHERE s.email = auth.email() AND s.role = 'admin' AND s.user_id = auth.uid())
    );

CREATE POLICY "Orders: Cashier view own" ON orders
    FOR SELECT USING (
        auth.uid() = user_id AND "cashierId" = auth.email()
    );

CREATE POLICY "Orders: Cashier insert own" ON orders
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND "cashierId" = auth.email()
    );

-- SHIFTS: Restricted access
CREATE POLICY "Shifts: Admin Full Access" ON shifts
    FOR ALL USING (
        auth.uid() = user_id AND 
        EXISTS (SELECT 1 FROM staff s WHERE s.email = auth.email() AND s.role = 'admin' AND s.user_id = auth.uid())
    );

CREATE POLICY "Shifts: Cashier view own" ON shifts
    FOR SELECT USING (
        auth.uid() = user_id AND "cashierId" = auth.email()
    );

CREATE POLICY "Shifts: Cashier open/update own" ON shifts
    FOR ALL USING (
        auth.uid() = user_id AND "cashierId" = auth.email()
    );

-- STAFF & SETTINGS: Admin Only
CREATE POLICY "Management: Admin Only" ON staff
    FOR ALL USING (
        auth.uid() = user_id AND 
        EXISTS (SELECT 1 FROM staff s WHERE s.email = auth.email() AND s.role = 'admin' AND s.user_id = auth.uid())
    );

-- Special case for Staff: we need to let people READ the staff table to verify their own role during login
CREATE POLICY "Auth: Allow check own role" ON staff
    FOR SELECT USING (auth.uid() = user_id AND email = auth.email());

CREATE POLICY "Settings: Admin Only" ON store_settings
    FOR ALL USING (
        auth.uid() = user_id AND 
        EXISTS (SELECT 1 FROM staff s WHERE s.email = auth.email() AND s.role = 'admin' AND s.user_id = auth.uid())
    );

-- SYNC EVENTS: Tenant isolation
CREATE POLICY "Sync: Tenant Isolation" ON sync_events 
    FOR ALL USING (auth.uid() = user_id);

-- 5. Trigger for updatedAt
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_modtime BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_shifts_modtime BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_staff_modtime BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_modified_column();
