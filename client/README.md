# FoodStream Modern React Frontend

A modern React + TypeScript + Vite frontend for the FoodStream White-Label Payment SAAS platform.

## Tech Stack

- **React 18** - UI library with hooks
- **TypeScript** - Type safety
- **Vite** - Fast build tool with HMR
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautifully designed components
- **Zustand** - Lightweight state management
- **@tanstack/react-query** - Server state management
- **React Router v6** - Client-side routing
- **Axios** - HTTP client
- **Lucide React** - Icons
- **Sonner** - Toast notifications

## Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── ui/            # shadcn/ui components
│   │   ├── layout/        # Layout components (Sidebar)
│   │   ├── dashboard/     # Dashboard components
│   │   ├── vouchers/      # Voucher management
│   │   └── settings/      # Settings page
│   ├── pages/             # Route pages
│   ├── services/          # API service layer
│   ├── store/             # Zustand stores
│   ├── types/             # TypeScript types
│   ├── styles/            # Global styles
│   ├── App.tsx            # Main app with routes
│   └── main.tsx           # Entry point
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Running backend server on port 3001

### Installation

From the project root:

```bash
# Install all dependencies (root + client)
npm run install:client

# Or manually:
cd client
npm install
```

### Development

```bash
# Run client dev server only (from project root)
npm run dev:client

# Run both client and server concurrently
npm run dev:all

# Or run from client folder
cd client
npm run dev
```

The client dev server runs on `http://localhost:5173` and proxies `/api` requests to the backend on port 3001.

### Building for Production

```bash
# Build client (from project root)
npm run build:client

# Or from client folder
cd client
npm run build
```

The build outputs to `public/app/` so the Express server can serve it at `/app`.

## Features

### Authentication
- Login with email/password
- Free trial signup with geo-location currency detection
- License activation
- Session-based auth with sessionStorage

### Dashboard
- Collapsible sidebar navigation
- Multiple views: Vouchers, Approval Queue, Reports, Settings
- Role-based access (Admin, Approver, User)

### Voucher Management
- Create vouchers with company/payee selection
- List vouchers with filtering and pagination
- Real-time approval workflow
- Multi-step approval queue

### Settings
- Organization details
- Branding configuration
- Notification preferences

## API Integration

All services in `src/services/` connect to the real Express/Supabase backend:

- **authService.ts** - Login, logout, profile
- **voucherService.ts** - CRUD, approvals
- **onboardingService.ts** - Trial, license activation

## Environment Variables

The Vite proxy handles API routing in development. In production, the React app is served from the same Express server.

## Accessing the App

- **Development**: `http://localhost:5173`
- **Production**: `http://yourserver:3001/app`

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/login` | LoginPage | User authentication |
| `/trial` | TrialSignupPage | Free trial registration |
| `/activate` | LicenseActivationPage | License activation |
| `/dashboard` | DashboardLayout | Main app (protected) |

## License

Proprietary - FoodStream Ltd.
