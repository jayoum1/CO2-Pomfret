# Next.js Web Application Setup

## Overview

A production-ready Next.js (App Router) + TypeScript + Tailwind frontend for the Pomfret Forest Simulation project.

## Quick Start

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Configure Environment

Create `.env.local` (or copy from `.env.local.example`):

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

### 3. Start Backend

```bash
# From project root
python3 -m uvicorn src.api.app:app --host 0.0.0.0 --port 8000
```

### 4. Start Frontend

```bash
cd web
npm run dev
```

Visit `http://localhost:3000`

## Features Implemented

### ✅ Dashboard (`/`)
- Years ahead selector (0/5/10/20)
- Metrics cards: Total Carbon, Mean DBH, Num Trees
- Charts:
  - Total carbon vs years (line chart)
  - Carbon by plot (bar chart)
  - Top 10 species by carbon (horizontal bar chart)

### ✅ Planting Scenarios (`/scenarios`)
- Scenario builder UI:
  - Total trees input
  - Plot selector (Upper/Middle/Lower)
  - Initial DBH input
  - Species mix table with percentage validation
- Simulation results:
  - Baseline vs scenario comparison
  - Carbon and CO2e metrics
  - Comparison chart over time
  - Detailed comparison table
- Save/load scenarios to localStorage

### ✅ Visualize (`/visualize`)
- 2D plot view placeholder (random positions)
- Year selector (0/5/10/20)
- 3D toggle (ready for React Three Fiber integration)
- Summary metrics display

### ✅ About (`/about`)
- Project overview
- Simulation assumptions
- Data source information
- Carbon calculation details
- Limitations

## Architecture

### Frontend Stack
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Client-side routing** with Next.js Link

### API Integration
- Typed API client (`src/lib/api.ts`)
- Fetch-based HTTP client
- Error handling
- TypeScript interfaces for all API responses

### Backend Endpoints Used
- `GET /snapshots/years` - Available years
- `GET /summary?years_ahead=X` - Summary metrics
- `POST /scenario/simulate` - Scenario simulation
- `POST /predict/tree` - Single tree prediction

## File Structure

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with sidebar
│   │   ├── page.tsx             # Dashboard
│   │   ├── scenarios/
│   │   │   └── page.tsx         # Planting scenarios
│   │   ├── visualize/
│   │   │   └── page.tsx         # Visualization (3D-ready)
│   │   ├── about/
│   │   │   └── page.tsx         # About page
│   │   └── globals.css          # Global styles
│   ├── components/
│   │   └── Sidebar.tsx          # Navigation sidebar
│   └── lib/
│       └── api.ts               # API client
├── public/                       # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 3D Integration Ready

The `/visualize` page is structured to easily integrate React Three Fiber:

1. **Current**: 2D placeholder with scatter plot
2. **Future**: Replace 2D renderer with `<Canvas>` from `@react-three/fiber`
3. **Toggle**: Already implemented for switching between 2D/3D views

To add 3D:
```bash
npm install @react-three/fiber @react-three/drei three
```

Then replace the 2D visualization component with a Three.js scene.

## Development Notes

### TypeScript Types
All API responses are typed in `src/lib/api.ts`:
- `Summary`
- `ScenarioRequest` / `ScenarioResult`
- `PredictTreeRequest` / `PredictTreeResult`

### Styling
- Uses Tailwind CSS utility classes
- Custom colors defined in `tailwind.config.ts`:
  - `forest-green`: `#2d5016`
  - `forest-light`: `#4a7c2a`
- Responsive design with mobile-first approach

### State Management
- React hooks (`useState`, `useEffect`)
- LocalStorage for saved scenarios
- No external state management library (can add Redux/Zustand if needed)

## Production Build

```bash
npm run build
npm start
```

## Troubleshooting

### Backend Connection
- Verify backend is running: `curl http://127.0.0.1:8000/health`
- Check CORS settings in FastAPI (already configured)
- Verify `NEXT_PUBLIC_API_BASE_URL` in `.env.local`

### Build Errors
- Clear cache: `rm -rf .next node_modules && npm install`
- Check TypeScript errors: `npm run lint`

### Port Conflicts
- Change Next.js port: `npm run dev -- -p 3001`
- Change backend port: Update `.env.local` accordingly

## Next Steps

1. **3D Visualization**: Integrate React Three Fiber
2. **Real Tree Positions**: Add spatial data from measurements
3. **Export Features**: PDF/CSV export for scenarios
4. **Authentication**: Add user accounts if needed
5. **Deployment**: Deploy to Vercel/Netlify
