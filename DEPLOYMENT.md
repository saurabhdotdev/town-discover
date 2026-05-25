# Deployment Guide

## Frontend Deployment (Vercel)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/town-discover.git
git push -u origin main
```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New" → "Project"
4. Select your `town-discover` repository
5. Configure:
   - **Framework**: Next.js (auto-detected)
   - **Root Directory**: `./` (root)
   - **Environment Variables**: Add `NEXT_PUBLIC_API_URL` → your backend URL

### Step 3: Set Environment Variables
In Vercel Dashboard → Project Settings → Environment Variables:
```
NEXT_PUBLIC_API_URL = https://your-backend-domain.com
```

---

## Backend Deployment Options

### Option A: Railway (Recommended for Express)
1. Go to [railway.app](https://railway.app)
2. Create new project
3. Connect GitHub repository
4. Set root directory to `./backend`
5. Add environment variables:
   - `NODE_ENV`: production
   - `PORT`: 5000 (or auto-assigned)
   - `DATABASE_URL`: your PostgreSQL URL
   - `CORS_ORIGIN`: your Vercel frontend URL

### Option B: Render
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect GitHub
4. Configure:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: `./backend`
5. Add Environment Variables same as above

### Option C: Fly.io
1. Install `flyctl` CLI
2. Run `flyctl launch` in backend directory
3. Configure `fly.toml` with Node environment
4. Deploy with `flyctl deploy`

---

## Connecting Frontend to Backend

After deploying backend, update in Vercel:
1. Get your backend URL (e.g., `https://sheher-api.railway.app`)
2. Go to Vercel Dashboard → Project Settings
3. Update `NEXT_PUBLIC_API_URL` environment variable
4. Redeploy (auto-triggers)

---

## Environment Variables Checklist

**Frontend (.env.production)**
- `NEXT_PUBLIC_API_URL` = Backend URL

**Backend (.env in production)**
- `NODE_ENV` = production
- `PORT` = 5000 (or assigned by platform)
- `CORS_ORIGIN` = Frontend URL (e.g., https://town-discover.vercel.app)
- `DATABASE_URL` = PostgreSQL connection string (if using DB)

---

## Verify Deployment

After deploying both:
1. Visit your Vercel frontend URL
2. Check browser console for any API errors
3. Test API endpoint: `https://your-backend/api/health`
4. Should respond: `{ status: "Sheher API is alive ✨" }`

---

## Troubleshooting

**CORS errors?**
- Update backend `CORS_ORIGIN` to match frontend domain

**API calls fail?**
- Check `NEXT_PUBLIC_API_URL` matches backend domain
- Verify backend environment variables

**Build fails?**
- Check Node version compatibility (recommend 18+)
- Verify all dependencies are listed in package.json
