# Setup Instructions for Next.js Web App

## Prerequisites

Node.js and npm are required to run the Next.js frontend. They are not currently installed on your system.

## Install Node.js

### Option 1: Using Homebrew (Recommended for macOS)

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Verify installation
node --version
npm --version
```

### Option 2: Download from Official Website

1. Visit https://nodejs.org/
2. Download the LTS version for macOS
3. Run the installer
4. Verify installation:
```bash
node --version
npm --version
```

## After Installing Node.js

Once Node.js is installed, follow these steps:

### 1. Install Dependencies

```bash
cd web
npm install
```

This will install:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Recharts (for charts)
- And other dependencies

### 2. Create Environment File

```bash
# Create .env.local file
echo "NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000" > web/.env.local
```

### 3. Start the Frontend

```bash
cd web
npm run dev
```

The app will be available at: **http://localhost:3000**

## Verify Backend is Running

The FastAPI backend should be running on port 8000. Verify with:

```bash
curl http://localhost:8000/health
```

Expected response: `{"status":"healthy"}`

If the backend is not running, start it with:

```bash
# From project root
python3 -m uvicorn src.api.app:app --host 0.0.0.0 --port 8000
```

## Quick Start (Once Node.js is Installed)

```bash
# 1. Install dependencies
cd web
npm install

# 2. Start development server
npm run dev

# 3. Open browser to http://localhost:3000
```

## Troubleshooting

### Port 3000 Already in Use

```bash
npm run dev -- -p 3001
```

### Module Not Found Errors

```bash
rm -rf node_modules .next
npm install
```

### Backend Connection Issues

- Verify backend is running: `curl http://localhost:8000/health`
- Check `.env.local` has correct API URL
- Ensure CORS is enabled in FastAPI (already configured)

## Current Status

✅ **Backend**: Running on port 8000  
❌ **Frontend**: Requires Node.js installation

Once Node.js is installed, you can run the frontend and access the full application!
