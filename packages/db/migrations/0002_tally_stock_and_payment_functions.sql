-- =====================================================================
-- 0002_tally_stock_and_payment_functions
-- Keeps stock and money consistent in the database, not in app code.
--
-- WHY (docs/architecture/database.md):
--   * A stored total that app code maintains drifts from its ledger. Here
--     sales.paid_amount is ALWAYS recomputed from sale_payments, and direct
--     writes are rejected.
--   * Stock only moves through an append-only stock_movements log; the trigger
--     keeps inventory_items.quantity_on_hand and records quantity_after.
--   * Stock deduction is idempotent via sales.stock_deducted_at, so a retry
--     never deducts twice.
--
-- Every function: schema tally, SECURITY INVOKER, pinned search_path.
-- No grants here (the tally schema has none for anon/authenticated; apps/api
-- connects as the owner). Grants/tightenings go in their own migrations.
--
-- ROLLBACK (manual, staging only): drop the triggers, then the functions,
-- then the two auth.users foreign keys, in reverse order of this file.
-- =====================================================================

-- 1) Identity: tally rows point at Qorelly's auth.users (cross-schema, so not in Drizzle).
ALTER TABLE tally.businesses
  ADD CONSTRAINT businesses_owner_user_fk
  FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE tally.business_members
  ADD CONSTRAINT business_members_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--> statement-breakpoint

-- 2) sales.paid_amount = SUM(sale_payments.amount). Recompute, never increment.
CREATE OR REPLACE FUNCTION tally.sync_sale_paid_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = tally, pg_temp
AS $$
DECLARE
  v_sale_ids uuid[];
  v_sale_id  uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_sale_ids := ARRAY[OLD.sale_id];
  ELSIF TG_OP = 'UPDATE' AND OLD.sale_id IS DISTINCT FROM NEW.sale_id THEN
    v_sale_ids := ARRAY[OLD.sale_id, NEW.sale_id];
  ELSE
    v_sale_ids := ARRAY[NEW.sale_id];
  END IF;

  FOREACH v_sale_id IN ARRAY v_sale_ids LOOP
    UPDATE tally.sales s
       SET paid_amount = COALESCE((SELECT SUM(p.amount) FROM tally.sale_payments p WHERE p.sale_id = v_sale_id), 0),
           updated_at  = now()
     WHERE s.id = v_sale_id;
  END LOOP;

  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sale_payments_sync_paid_amount
  AFTER INSERT OR UPDATE OR DELETE ON tally.sale_payments
  FOR EACH ROW EXECUTE FUNCTION tally.sync_sale_paid_amount();
--> statement-breakpoint

-- 3) Reject direct writes to the two trigger-maintained columns.
--    pg_trigger_depth() = 1 means the write came straight from a statement, not
--    from one of the triggers in this file.
CREATE OR REPLACE FUNCTION tally.guard_sale_paid_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = tally, pg_temp
AS $$
BEGIN
  IF pg_trigger_depth() = 1 THEN
    IF TG_OP = 'INSERT' AND NEW.paid_amount <> 0 THEN
      RAISE EXCEPTION 'sales.paid_amount is derived from sale_payments; insert payments instead';
    ELSIF TG_OP = 'UPDATE' AND NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN
      RAISE EXCEPTION 'sales.paid_amount is derived from sale_payments; do not write it directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sales_guard_paid_amount
  BEFORE INSERT OR UPDATE ON tally.sales
  FOR EACH ROW EXECUTE FUNCTION tally.guard_sale_paid_amount();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION tally.guard_quantity_on_hand()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = tally, pg_temp
AS $$
BEGIN
  IF pg_trigger_depth() = 1 THEN
    IF TG_OP = 'INSERT' AND NEW.quantity_on_hand <> 0 THEN
      RAISE EXCEPTION 'inventory_items.quantity_on_hand starts at 0; record an opening stock_movement';
    ELSIF TG_OP = 'UPDATE' AND NEW.quantity_on_hand IS DISTINCT FROM OLD.quantity_on_hand THEN
      RAISE EXCEPTION 'inventory_items.quantity_on_hand moves only through stock_movements';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER inventory_items_guard_quantity_on_hand
  BEFORE INSERT OR UPDATE ON tally.inventory_items
  FOR EACH ROW EXECUTE FUNCTION tally.guard_quantity_on_hand();
--> statement-breakpoint

-- 4) stock_movements: apply the delta to the item (row-locked) and record quantity_after.
--    Negative stock is allowed (shops sell before they count) but raised as a NOTICE.
CREATE OR REPLACE FUNCTION tally.apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = tally, pg_temp
AS $$
DECLARE
  v_qty numeric(12,3);
BEGIN
  UPDATE tally.inventory_items i
     SET quantity_on_hand = i.quantity_on_hand + NEW.quantity_delta,
         updated_at       = now()
   WHERE i.business_id = NEW.business_id
     AND i.id          = NEW.item_id
  RETURNING i.quantity_on_hand INTO v_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory item % not found for business %', NEW.item_id, NEW.business_id;
  END IF;

  IF v_qty < 0 THEN
    RAISE NOTICE 'inventory item % is now negative (%)', NEW.item_id, v_qty;
  END IF;

  NEW.quantity_after := v_qty;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER stock_movements_apply
  BEFORE INSERT ON tally.stock_movements
  FOR EACH ROW EXECUTE FUNCTION tally.apply_stock_movement();
--> statement-breakpoint

-- 5) stock_movements is append-only: corrections are new 'adjustment' rows.
CREATE OR REPLACE FUNCTION tally.reject_stock_movement_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = tally, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements is append-only; record an adjustment instead';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER stock_movements_append_only
  BEFORE UPDATE OR DELETE ON tally.stock_movements
  FOR EACH ROW EXECUTE FUNCTION tally.reject_stock_movement_change();
--> statement-breakpoint

-- 6) Per-business sale numbers. The UPDATE row-locks the business, so concurrent
--    sales get distinct, gap-free numbers (gaps only if a transaction rolls back).
CREATE OR REPLACE FUNCTION tally.next_sale_number(p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = tally, pg_temp
AS $$
DECLARE
  v_number integer;
BEGIN
  UPDATE tally.businesses
     SET sale_counter = sale_counter + 1,
         updated_at   = now()
   WHERE id = p_business_id
  RETURNING sale_counter INTO v_number;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'business % not found', p_business_id;
  END IF;

  RETURN v_number;
END;
$$;
--> statement-breakpoint

-- 7) Deduct a sale's stock exactly once. Safe to call again: the stamp makes it a no-op.
CREATE OR REPLACE FUNCTION tally.deduct_sale_stock(p_sale_id uuid, p_performed_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = tally, pg_temp
AS $$
DECLARE
  v_sale tally.sales%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM tally.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale % not found', p_sale_id;
  END IF;

  IF v_sale.stock_deducted_at IS NOT NULL THEN
    RETURN;
  END IF;

  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'sale % is %, cannot deduct stock', p_sale_id, v_sale.status;
  END IF;

  -- item_id order gives a consistent lock order across concurrent sales (no deadlocks).
  INSERT INTO tally.stock_movements (business_id, item_id, type, quantity_delta, sale_id, performed_by)
  SELECT si.business_id, si.item_id, 'sale', -si.quantity, si.sale_id, p_performed_by
    FROM tally.sale_items si
   WHERE si.sale_id = p_sale_id
   ORDER BY si.item_id, si.id;

  UPDATE tally.sales
     SET stock_deducted_at = now(),
         updated_at        = now()
   WHERE id = p_sale_id;
END;
$$;
--> statement-breakpoint

-- 8) Void a completed sale; put deducted stock back once. Payments are left as
--    recorded (no refunds in the MVP): revenue reports count completed sales only.
CREATE OR REPLACE FUNCTION tally.void_sale(p_sale_id uuid, p_performed_by uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = tally, pg_temp
AS $$
DECLARE
  v_sale tally.sales%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM tally.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale % not found', p_sale_id;
  END IF;

  IF v_sale.status = 'voided' THEN
    RAISE EXCEPTION 'sale % is already voided', p_sale_id;
  END IF;

  UPDATE tally.sales
     SET status      = 'voided',
         voided_at   = now(),
         void_reason = p_reason,
         updated_at  = now()
   WHERE id = p_sale_id;

  IF v_sale.stock_deducted_at IS NOT NULL THEN
    INSERT INTO tally.stock_movements (business_id, item_id, type, quantity_delta, sale_id, performed_by, note)
    SELECT si.business_id, si.item_id, 'void', si.quantity, si.sale_id, p_performed_by, p_reason
      FROM tally.sale_items si
     WHERE si.sale_id = p_sale_id
     ORDER BY si.item_id, si.id;
  END IF;
END;
$$;
