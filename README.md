# Snobbin Mobile

React Native/Expo mobile app for Snobbin — offline-first ranking and review groups.

## Architecture

```
┌────────────────────┐                       ┌────────────────────┐
│  Snobbin Mobile    │                       │  Snobbin API       │
│  (Expo/RN)         │                       │  (Next.js)         │
│                    │                       │                    │
│  SQLite (local) ◄──┼── GET /api/mobile/* ──┼── Reads via        │
│  Image cache       │                       │  Drizzle/Postgres  │
│  Auth0 (native)    │                       │                    │
│                    │── POST/PUT/DELETE ────►│  Writes via        │
│                    │   /api/mobile/*        │  Drizzle/Postgres  │
└────────────────────┘                       └────────────────────┘
```

- **Offline-first**: All reads come from local SQLite. Works without internet after initial sync.
- **Custom sync**: The app fetches full group data from the API and upserts into local SQLite.
- **Writes go to the API first**: Items, rankings, and edits POST to the backend, then the app re-syncs locally.
- **Image caching**: Cloudinary images are cached to the device filesystem for offline display.

## Tech Stack

- Expo SDK 54 / React Native 0.81
- expo-router (file-based routing)
- expo-sqlite (local database for offline reads)
- expo-auth-session (Auth0 native PKCE flow)
- react-native-paper (Material Design 3 components)
- jotai (state management)
- expo-image + expo-file-system (image display & offline caching)

## Setup

### Prerequisites

- Node.js 22.x (see `.nvmrc`)
- Expo CLI: `npm install -g expo-cli`
- The snobbin Next.js web app running locally on port 3000

### 1. Install dependencies

```bash
cd snobbin-mobile
npm install
```

### 2. Configure Auth0

Create a **Native** application in your Auth0 tenant (`dev--hkrho7z.us.auth0.com`):

1. Go to Auth0 Dashboard → Applications → Create Application → Native
2. Set these in the application settings:
   - **Allowed Callback URLs**: `snobbin://auth/callback`
   - **Allowed Logout URLs**: `snobbin://`
3. Copy the **Client ID** and update `lib/auth.ts`:
   ```typescript
   const AUTH0_CLIENT_ID = 'your-client-id-here';
   ```

### 3. Start the snobbin web app

```bash
cd ../snobbin-web
docker-compose up -d   # Start Postgres
yarn dev               # Start Next.js API
```

This provides the API endpoints the mobile app needs:
- `GET /api/mobile/user/:userId/groups` — User's groups and memberships
- `GET /api/mobile/groups/:groupId` — Full group data (items, rankings, attributes)
- `POST /api/mobile/items` — Create a ranking item
- `PUT /api/mobile/items/:itemId` — Update a ranking item
- `DELETE /api/mobile/items/:itemId` — Delete a ranking item (admin only)
- `POST /api/mobile/rankings` — Create or update a ranking

### 4. Run the mobile app

```bash
npx expo start
```

- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go on your physical device

### Building for device

```bash
# iOS (requires Xcode)
npx expo run:ios

# Android (requires Android Studio)
npx expo run:android
```

## Features (v1)

- ✅ View your groups
- ✅ Browse items in a group (search, sort by name/rating/recent)
- ✅ View item details — image, attributes, all members' rankings
- ✅ Add/edit your own ratings
- ✅ Add new items with attributes and images
- ✅ Edit existing items
- ✅ Delete items (admin only)
- ✅ Offline image caching
- ✅ Sync status indicator
- ✅ Pull-to-refresh
- ✅ Profile with cache management

### Not in v1 (web-only)

- Group creation and settings
- Member invites and management
- AI item identification
- Group admin actions (beyond delete)

## Project Structure

```
snobbin-mobile/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout (providers, auth check)
│   ├── index.tsx           # Group list (home)
│   ├── login.tsx           # Auth0 login
│   ├── profile.tsx         # User profile, cache, sync
│   └── group/
│       ├── [groupId].tsx   # Items list + add item
│       └── [groupId]/item/
│           └── [itemId].tsx # Item detail + rating + edit + delete
├── components/             # Reusable UI components
├── lib/                    # Core logic
│   ├── api-client.ts       # Backend write operations
│   ├── auth.ts             # Auth0 PKCE flow
│   ├── config.ts           # Backend URL config
│   ├── image-cache.ts      # Offline image caching
│   ├── image-upload.ts     # Image picking and Cloudinary upload
│   ├── theme.ts            # React Native Paper theme
│   └── db/                 # Local database
│       ├── database.ts     # SQLite initialization
│       ├── queries.ts      # Read queries (all local SQLite)
│       ├── sync.ts         # Fetch from API → upsert to SQLite
│       └── index.ts        # Public exports
├── types/                  # TypeScript models
└── store/                  # Jotai atoms
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Unable to obtain credentials" | Ensure the snobbin web app is running on port 3000 |
| No data after login | Check that `docker-compose up -d` is running and migrations are applied |
| Images not loading offline | Images cache on first view — view them while online first |
| Auth0 redirect fails | Verify the callback URL `snobbin://auth/callback` is configured in Auth0 |
| "Only group admins can delete items" | Delete is restricted to ADMIN role members |
