# TGL Tech Schedule

Scheduling system for managing crew and equipment assignments to events.

## Features

- Event management with SharePoint sync
- Crew and equipment assignment
- Cost tracking by cost center
- PDF and Excel report generation
- SMTP email notifications
- Role-based access (Admin, Scheduler, Crew)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Backend Setup

```bash
cd backend
npm install
cp ../.env.example .env
# Edit .env with your database URL and JWT secret
npm run migrate
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### First User

Register the first user at the login page - they will automatically become an admin.

## Deployment

### CloudPanel (tech.4tmrw.net)

1. Create Node.js site in CloudPanel
2. Clone repository
3. Install dependencies: `npm install` in both backend/ and frontend/
4. Build frontend: `cd frontend && npm run build`
5. Create `.env` in backend/ with production values
6. Run migrations: `cd backend && npm run migrate`
7. Start with PM2: `pm2 start ecosystem.config.js`
8. Configure Nginx to proxy to port 3200

### Environment Variables

```
DATABASE_URL=postgresql://user:pass@localhost:5432/schedule
JWT_SECRET=<strong-random-string>
PORT=3200
NODE_ENV=production
FRONTEND_URL=https://tech.4tmrw.net
```

## API Endpoints

- `POST /api/auth/login` - Login
- `GET /api/events` - List events
- `GET /api/crew` - List crew members
- `GET /api/equipment` - List equipment
- `POST /api/assignments/crew` - Assign crew to event
- `GET /api/reports/costs` - Cost report
- `GET /api/reports/export/pdf/event/:id` - Export event PDF

## Tech Stack

- **Backend:** Node.js, Express, PostgreSQL
- **Frontend:** React, Vite, Tailwind CSS
- **Auth:** JWT with bcrypt
- **Reports:** Puppeteer (PDF), xlsx (Excel)
