CREATE TRIGGER validate_stock_movement_before_insert
BEFORE INSERT ON stock_movements
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM inventory_items
      WHERE id = NEW.item_id AND archived_at IS NULL
    ) THEN RAISE(ABORT, 'Inventory item is unavailable')
    WHEN (
      SELECT current_stock_hundredths
      FROM inventory_items
      WHERE id = NEW.item_id
    ) + NEW.quantity_delta_hundredths < 0
      THEN RAISE(ABORT, 'Insufficient reagent stock')
  END;
END;

CREATE TRIGGER apply_stock_movement_after_insert
AFTER INSERT ON stock_movements
FOR EACH ROW
BEGIN
  UPDATE inventory_items
  SET current_stock_hundredths = current_stock_hundredths + NEW.quantity_delta_hundredths,
      updated_at = NEW.created_at
  WHERE id = NEW.item_id;
END;
