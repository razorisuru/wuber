CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id   TEXT UNIQUE NOT NULL,
  email      TEXT,
  role       TEXT DEFAULT 'rider',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivers (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id  UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  car_type TEXT,
  rating   FLOAT DEFAULT 5.0
);

CREATE TABLE IF NOT EXISTS rides (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  driver_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  status     TEXT DEFAULT 'pending',
  fare       FLOAT,
  origin_lat FLOAT,
  origin_lng FLOAT,
  dest_lat   FLOAT,
  dest_lng   FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rides_rider_id   ON rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id  ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status     ON rides(status);
