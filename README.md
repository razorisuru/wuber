# 🚕 Wuber — Uber-like App

A full-stack ride-hailing application built with **React Native (Expo)**, **Node.js**, **PostgreSQL**, **Redis**, and **Socket.io**.

---

## 🧠 Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo), Zustand, MapLibre, Clerk |
| Backend | Node.js, Express.js, Socket.io |
| Database | PostgreSQL |
| Cache / Realtime | Redis (ioredis) |
| Auth | Clerk |
| Maps | MapLibre + OpenStreetMap (free) |

---

## 📁 Project Structure

```
wuber/
├── backend/                  # Express API + Socket.io server
│   ├── src/
│   │   ├── server.js         # Entry point
│   │   ├── db.js             # PostgreSQL pool
│   │   ├── redis.js          # Redis client & geo helpers
│   │   ├── db/schema.sql     # Database schema
│   │   ├── middleware/
│   │   │   ├── auth.js       # Clerk token verification
│   │   │   └── rateLimiter.js
│   │   ├── routes/
│   │   │   ├── rides.js      # Ride CRUD + accept/complete
│   │   │   └── users.js      # User profile management
│   │   └── utils/fare.js     # Haversine distance + fare calc
│   ├── package.json
│   └── .env.example
│
└── mobile/                   # React Native (Expo)
    ├── app/
    │   ├── _layout.js        # Root layout (ClerkProvider)
    │   ├── index.js          # Auth gate
    │   ├── (auth)/
    │   │   ├── sign-in.js
    │   │   └── sign-up.js
    │   ├── (tabs)/
    │   │   ├── index.js      # Rider map screen
    │   │   ├── history.js    # Ride history
    │   │   └── profile.js    # Profile + driver toggle
    │   └── driver/
    │       ├── index.js      # Driver map + ride requests
    │       ├── requests.js   # Accepted rides
    │       └── earnings.js   # Earnings summary
    ├── store/useStore.js      # Zustand global store
    ├── services/
    │   ├── api.js            # Axios client
    │   ├── socket.js         # Socket.io helpers
    │   └── driverStatus.js   # Driver online/offline status
    ├── package.json
    └── .env.example
```

---

## ⚙️ 1. Backend Setup

### Prerequisites
- Node.js ≥ 18
- PostgreSQL running locally (or Supabase/Neon)
- Redis running locally (or Upstash)

### Install & Configure

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
```

### `.env` Variables

```env
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/uber_clone
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=your_clerk_secret_key
JWT_SECRET=your_jwt_secret
```

### Create PostgreSQL Database

```bash
psql -U postgres -c "CREATE DATABASE uber_clone;"
psql -U postgres -d uber_clone -f src/db/schema.sql
```

### Run Backend

```bash
npm run dev    # Development (nodemon)
npm start      # Production
```

The server starts on `http://localhost:5000`.

---

## 📱 2. Mobile Setup

### Prerequisites
- Node.js ≥ 18
- Expo CLI (`npm install -g expo-cli`)

### Install & Configure

```bash
cd mobile
npm install
cp .env.example .env
# Edit .env with your Clerk publishable key
```

### `.env` Variables

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_API_URL=http://localhost:5000
```

### Run Mobile App

```bash
npm start         # Expo dev server
npm run android   # Android
npm run ios       # iOS
```

---

## 🔐 3. Clerk Authentication

1. Create a free account at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy your **Secret Key** → `backend/.env` `CLERK_SECRET_KEY`
4. Copy your **Publishable Key** → `mobile/.env` `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

---

## 📡 4. Real-Time Flow

```
Driver App ──► socket.emit("driver-location", {lat, lng})
                          │
                     Backend (Redis GEOADD)
                          │
              socket.broadcast → Riders see driver on map

Rider App ──► POST /api/rides  (creates ride in DB)
                          │
              Backend finds nearby drivers (Redis GEOSEARCH)
                          │
              socket.emit("ride-request") → Driver apps
                          │
Driver accepts ──► POST /api/rides/:id/accept
                          │
              socket.emit("ride-accepted") → Rider app
```

---

## 🗺️ 5. Map & Routing (Free Stack)

| Service | Purpose |
|---|---|
| MapLibre | React Native map rendering |
| OpenStreetMap | Free map tiles |
| Nominatim | Geocoding (address → coordinates) |
| OSRM | Routing / directions |

---

## 🧮 6. Fare Calculation

```
fare = 100 + (distance_km × 50) + (estimated_time_min × 10)
```

Distance is computed using the **Haversine formula** between origin and destination coordinates.

---

## 🔁 7. API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/users` | Create/sync user after Clerk auth |
| `GET` | `/api/users/me` | Get current user profile |
| `PATCH` | `/api/users/me` | Update profile |
| `POST` | `/api/rides` | Request a ride |
| `GET` | `/api/rides/history` | Get ride history |
| `GET` | `/api/rides/:id` | Get ride details |
| `POST` | `/api/rides/:id/accept` | Driver accepts a ride |
| `POST` | `/api/rides/:id/complete` | Complete a ride |
| `GET` | `/health` | Health check |

All ride and user endpoints require a **Clerk Bearer token** in the `Authorization` header.

---

## 🚀 8. Deployment

| Component | Options |
|---|---|
| Backend | Railway, Render, AWS, VPS |
| PostgreSQL | Supabase, Neon, AWS RDS |
| Redis | Upstash, AWS ElastiCache |
| Mobile | Expo EAS Build |

---

## ⚠️ Best Practices

- ❌ Don't store live driver locations in PostgreSQL
- ✅ Use Redis GEO for real-time driver tracking
- ✅ Use PostgreSQL for rides history and user data
- ✅ Send driver location every 3–5 seconds
- ✅ Separate rider & driver flows in the app