CREATE TABLE lab_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  owner_name TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  logo_object_key TEXT,
  signature_object_key TEXT,
  payment_qr_object_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE lab_technicians (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE referrers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sample_collectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'lab-technician', 'sample-collector')),
  lab_technician_id TEXT REFERENCES lab_technicians(id) ON DELETE RESTRICT,
  sample_collector_id TEXT REFERENCES sample_collectors(id) ON DELETE RESTRICT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE bootstrap_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  consumed_at TEXT
);

INSERT INTO bootstrap_state (id, consumed_at) VALUES (1, NULL);

CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE auth_otp_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hmac TEXT NOT NULL,
  attempts_remaining INTEGER NOT NULL DEFAULT 5 CHECK (attempts_remaining BETWEEN 0 AND 5),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE auth_otp_request_limits (
  identifier_key_hash TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  window_started_at TEXT NOT NULL
);

CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 120),
  gender TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  lab_technician_id TEXT REFERENCES lab_technicians(id) ON DELETE RESTRICT,
  sample_collector_id TEXT REFERENCES sample_collectors(id) ON DELETE RESTRICT,
  referrer_id TEXT REFERENCES referrers(id) ON DELETE RESTRICT,
  created_by_sample_collector INTEGER NOT NULL DEFAULT 0 CHECK (created_by_sample_collector IN (0, 1)),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_paise INTEGER NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
  unit TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE test_parameters (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  group_id TEXT,
  group_name TEXT,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (test_id, sort_order)
);

CREATE TABLE test_profiles (
  id TEXT PRIMARY KEY CHECK (id IN ('preoperative', 'anc')),
  name TEXT NOT NULL
);

INSERT INTO test_profiles (id, name) VALUES
  ('preoperative', 'Preoperative Profile'),
  ('anc', 'ANC Profile (Antenatal Care)');

CREATE TABLE test_profile_tests (
  profile_id TEXT NOT NULL REFERENCES test_profiles(id) ON DELETE RESTRICT,
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  PRIMARY KEY (profile_id, test_id)
);

CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('equipment', 'material')),
  unit TEXT NOT NULL CHECK (unit IN ('quantity', 'kg', 'litre')),
  threshold_hundredths INTEGER NOT NULL DEFAULT 0 CHECK (threshold_hundredths >= 0),
  current_stock_hundredths INTEGER NOT NULL DEFAULT 0 CHECK (current_stock_hundredths >= 0),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE test_reagents (
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE RESTRICT,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity_hundredths INTEGER NOT NULL CHECK (quantity_hundredths > 0),
  PRIMARY KEY (test_id, item_id)
);

CREATE TABLE lab_orders (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE RESTRICT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Completed')),
  reagents_deducted_at TEXT,
  printed_at TEXT
);

CREATE TABLE order_results (
  order_id TEXT NOT NULL REFERENCES lab_orders(id) ON DELETE RESTRICT,
  parameter_id TEXT NOT NULL REFERENCES test_parameters(id) ON DELETE RESTRICT,
  value TEXT NOT NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (order_id, parameter_id)
);

CREATE TABLE attendance_records (
  technician_id TEXT NOT NULL REFERENCES lab_technicians(id) ON DELETE RESTRICT,
  attendance_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Leave')),
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (technician_id, attendance_date)
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL DEFAULT '',
  discount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  status TEXT NOT NULL CHECK (status IN ('Paid', 'Unpaid')),
  payment_method TEXT NOT NULL DEFAULT '' CHECK (payment_method IN ('', 'Cash', 'Online')),
  invoice_date TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  test_id TEXT REFERENCES tests(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  UNIQUE (invoice_id, sort_order)
);

CREATE TABLE import_bills (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  quantity_hundredths INTEGER NOT NULL CHECK (quantity_hundredths > 0),
  unit TEXT NOT NULL CHECK (unit IN ('quantity', 'kg', 'litre')),
  cost_per_unit_paise INTEGER NOT NULL CHECK (cost_per_unit_paise >= 0),
  total_cost_paise INTEGER NOT NULL CHECK (total_cost_paise >= 0),
  purchase_date TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE bill_payments (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL REFERENCES import_bills(id) ON DELETE RESTRICT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'upi', 'unspecified')),
  paid_at TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL CHECK (source_type IN ('import', 'order', 'manual')),
  source_id TEXT NOT NULL,
  quantity_delta_hundredths INTEGER NOT NULL CHECK (quantity_delta_hundredths <> 0),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (item_id, source_type, source_id)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_created_at ON patients(created_at);
CREATE INDEX idx_users_active_role ON users(is_active, role);
CREATE INDEX idx_otp_challenges_user_created ON auth_otp_challenges(user_id, created_at);
CREATE INDEX idx_orders_patient_created ON lab_orders(patient_id, created_at);
CREATE INDEX idx_orders_status_created ON lab_orders(status, created_at);
CREATE INDEX idx_orders_test ON lab_orders(test_id);
CREATE INDEX idx_order_results_parameter ON order_results(parameter_id);
CREATE INDEX idx_attendance_date ON attendance_records(attendance_date);
CREATE INDEX idx_invoices_date_status ON invoices(invoice_date, status);
CREATE INDEX idx_import_bills_date ON import_bills(purchase_date);
CREATE INDEX idx_bill_payments_bill ON bill_payments(bill_id, paid_at);
CREATE INDEX idx_stock_movements_item_created ON stock_movements(item_id, created_at);
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at);
