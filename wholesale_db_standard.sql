-- ====================================================================
-- GOD WHOLESALE HUB: DATABASE INTEGRITY & AUTOMATION (INDUSTRY STANDARD)
-- ====================================================================
-- Run this in your Supabase SQL Editor to automate stock repopulation
-- and ensure 100% data integrity between Orders and Inventory.

-- 1. TRIGGER FUNCTION: RESTORE STOCK ON CANCEL OR DELETE
-- This ensures that stock is ALWAYS "repopulated" automatically.
CREATE OR REPLACE FUNCTION ws_repopulate_inventory_on_order_change()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
BEGIN
    -- SCENARIO A: ORDER IS CANCELLED (Status update)
    IF (TG_OP = 'UPDATE' AND OLD.status != 'cancelled' AND NEW.status = 'cancelled') THEN
        FOR item IN SELECT * FROM jsonb_to_recordset(NEW.items) AS x(product_id UUID, qty NUMERIC) LOOP
            UPDATE ws_products 
            SET stock = stock + item.qty,
                updated_at = NOW()
            WHERE id = item.product_id;
        END LOOP;
        
    -- SCENARIO B: ORDER IS PERMANENTLY DELETED
    ELSIF (TG_OP = 'DELETE' AND OLD.status != 'cancelled') THEN
        FOR item IN SELECT * FROM jsonb_to_recordset(OLD.items) AS x(product_id UUID, qty NUMERIC) LOOP
            UPDATE ws_products 
            SET stock = stock + item.qty,
                updated_at = NOW()
            WHERE id = item.product_id;
        END LOOP;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. APPLY TRIGGERS TO ws_orders
DROP TRIGGER IF EXISTS tr_ws_repopulate_inventory ON ws_orders;
CREATE TRIGGER tr_ws_repopulate_inventory
BEFORE UPDATE OR DELETE ON ws_orders
FOR EACH ROW EXECUTE FUNCTION ws_repopulate_inventory_on_order_change();


-- 3. HELPER: AUTOMATIC UPDATED_AT
CREATE OR REPLACE FUNCTION update_ws_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ws_products_modtime ON ws_products;
CREATE TRIGGER update_ws_products_modtime BEFORE UPDATE ON ws_products FOR EACH ROW EXECUTE FUNCTION update_ws_modified_column();

DROP TRIGGER IF EXISTS update_ws_orders_modtime ON ws_orders;
CREATE TRIGGER update_ws_orders_modtime BEFORE UPDATE ON ws_orders FOR EACH ROW EXECUTE FUNCTION update_ws_modified_column();

DROP TRIGGER IF EXISTS update_ws_clients_modtime ON ws_clients;
CREATE TRIGGER update_ws_clients_modtime BEFORE UPDATE ON ws_clients FOR EACH ROW EXECUTE FUNCTION update_ws_modified_column();
