# Deployment Guide

## Frontend Deployment (Vercel)

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Deploy Sheher updates"
git push
```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com.
2. Sign in with GitHub.
3. Click "Add New" -> "Project".
4. Select the `town-discover` repository.
5. Keep the root directory as `./`.
6. Add the production values from `.env.example` in Project Settings -> Environment Variables.

Do not deploy `.env.local` or `.env.production` files. `.vercelignore` excludes local env files; production values belong in Vercel Environment Variables.

### Step 3: Production Environment Variables

Required for the current Vercel app:

```text
NEXT_PUBLIC_API_URL=https://sheher-city.vercel.app
DATABASE_URL=postgresql://user:password@host:5432/database
```

Feature-specific keys:

```text
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
REDIS_URL=redis://default:password@host:6379
SUPER_ADMIN_EMAILS=admin@example.com
```

## Backend Deployment Options

### Option A: Railway

1. Go to https://railway.app.
2. Create a new project.
3. Connect the GitHub repository.
4. Set root directory to `./backend`.
5. Add environment variables:
   - `NODE_ENV`: `production`
   - `PORT`: platform assigned, or `5000`
   - `DATABASE_URL`: PostgreSQL connection string
   - `FRONTEND_URL`: `https://sheher-city.vercel.app`

### Option B: Render

1. Go to https://render.com.
2. Create a new Web Service.
3. Connect GitHub.
4. Set root directory to `./backend`.
5. Use `npm run build` as the build command.
6. Use `npm start` as the start command.
7. Add the same environment variables as Railway.

## Connecting Frontend To Backend

If the backend is deployed separately:

1. Copy the backend URL, for example `https://sheher-api.example.com`.
2. Go to Vercel Project Settings -> Environment Variables.
3. Set `NEXT_PUBLIC_API_URL` to that backend URL.
4. Redeploy.

If the Next.js app serves the API routes directly, keep:

```text
NEXT_PUBLIC_API_URL=https://sheher-city.vercel.app
```

## Verify Deployment

After deployment:

1. Visit https://sheher-city.vercel.app.
2. Visit https://sheher-city.vercel.app/hangouts.
3. Test login, city switching, meetup creation, RSVP, shoutbox posting, and reporting.
4. Check Vercel deployment logs for missing environment variable errors.

## Troubleshooting

**CORS errors**

Update `FRONTEND_URL` or `NEXT_PUBLIC_APP_URL` to match `https://sheher-city.vercel.app`.

**API calls fail**

Check `NEXT_PUBLIC_API_URL`, `DATABASE_URL`, and Vercel function logs.

**Build fails**

Run `npm.cmd run build` locally and confirm all required environment variables exist in Vercel.
