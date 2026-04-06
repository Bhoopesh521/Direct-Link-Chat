# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### P2P Chat & File Share (`artifacts/p2p-app`)
- **Type**: Expo (React Native) mobile app
- **Purpose**: Truly peer-to-peer chat and file sharing app — no servers, no APIs, no cloud
- **Networking**: `react-native-tcp-socket` for direct device-to-device TCP connections
- **Discovery**: Manual — users enter peer IP (IPv4 or IPv6) + port number
- **Listen Port**: Default 9876 (configurable in Settings)
- **Features**:
  - Add peers by IPv4 or IPv6 address + port
  - Connect/disconnect from peers via direct TCP
  - Real-time text chat between peers
  - Direct file transfer (chunked, base64 encoded over TCP)
  - Transfer progress tracking
  - Persistent peer list via AsyncStorage
- **Web shim**: `shims/react-native-tcp-socket.web.js` stubs TCP for web preview (web doesn't support real TCP)
- **Android note**: Run `adb shell iptables -I INPUT -p tcp --dport 9876 -j ACCEPT` to allow incoming connections on Android

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
