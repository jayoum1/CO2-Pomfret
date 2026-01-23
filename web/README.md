# Carbon DBH Web Application

Next.js frontend for the Carbon DBH forest growth and carbon sequestration simulation project.

## Features

- **Dashboard**: View forest snapshots at different time horizons (0/5/10/20 years) with interactive charts
- **Planting Scenarios**: Simulate the impact of planting new trees on carbon sequestration
- **Visualize**: 2D plot view (placeholder for future 3D integration)
- **About**: Project details and simulation assumptions

## Prerequisites

- Node.js 18+ and npm
- Python 3.8+ (for backend)
- FastAPI backend running (see Backend Setup)

## Installation

1. **Install dependencies:**
```bash
cd web
npm install
```

2. **Set up environment variables:**
```bash
cp .env.local.example .env.local
# Edit .env.local if needed (default: http://127.0.0.1:8000)
```

## Running the Application

### Backend (FastAPI)

First, start the FastAPI backend:

```bash
# From project root
python3 -m uvicorn src.api.app:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://127.0.0.1:8000`

### Frontend (Next.js)

In a separate terminal, start the Next.js development server:

```bash
cd web
npm run dev
```

The application will be available at `http://localhost:3000`

## Project Structure

```
web/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Dashboard
│   │   ├── scenarios/         # Planting scenarios page
│   │   ├── visualize/         # Visualization page (3D-ready)
│   │   └── about/             # About/Assumptions page
│   ├── components/            # React components
│   │   └── Sidebar.tsx        # Navigation sidebar
│   └── lib/
│       └── api.ts             # API client with TypeScript types
├── public/                     # Static assets
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript configuration
├── tailwind.config.ts         # Tailwind CSS configuration
└── next.config.js             # Next.js configuration
```

## API Endpoints

The frontend communicates with the FastAPI backend at `NEXT_PUBLIC_API_BASE_URL`:

- `GET /snapshots/years` - Get available snapshot years
- `GET /summary?years_ahead=X` - Get summary metrics for a year
- `POST /scenario/simulate` - Simulate a planting scenario
- `POST /predict/tree` - Predict single tree growth

## Development

### Build for Production

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run lint
```

## Environment Variables

- `NEXT_PUBLIC_API_BASE_URL`: Backend API URL (default: `http://127.0.0.1:8000`)

## Troubleshooting

### Backend Connection Issues

If you see "Cannot connect to API" errors:

1. Verify the backend is running: `curl http://127.0.0.1:8000/health`
2. Check `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
3. Ensure CORS is enabled in the FastAPI backend (already configured)

### Port Already in Use

If port 3000 is already in use:

```bash
# Use a different port
npm run dev -- -p 3001
```

### Module Not Found Errors

```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
```

## Future Enhancements

- 3D visualization using React Three Fiber
- Real tree position data integration
- Export scenarios to PDF/CSV
- Multi-plot scenario simulation
- Cost-benefit analysis

## License

Pomfret School Forest Carbon Project
