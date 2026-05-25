# Sheher - Premium Hyperlocal City Discovery Platform

**Mission**: Help users feel the pulse of their city through immediate discovery of what's happening, where the city feels alive, and spontaneous experiences.

## Project Structure

```
/
├── frontend/          # Next.js frontend application
├── backend/           # Node.js/Express API server
├── shared/            # Shared types and utilities
├── package.json       # Monorepo root configuration
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Development

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on: http://localhost:3000

**Backend** (future):
```bash
cd backend
npm install
npm run dev
```
Backend runs on: http://localhost:5000

## Features

### Current (MVP)
- ✨ Premium, cinematic UI
- 🎯 Trending places discovery
- 🔥 Happening tonight experiences
- 💎 Hidden gems
- 🍔 Food street culture
- 🎵 Cultural & community events
- 🎮 Niche communities (gaming, photography, cycling, etc.)
- 🎨 Smooth animations and transitions

### Planned
- 📍 Real-time geolocation-based discovery
- 💾 User accounts and saved places
- 💬 Community vibes/comments
- 🔍 Advanced search and filters
- 🗺️ Interactive map integration
- 📱 Mobile app (React Native)
- 🤖 AI recommendations
- 🔔 Real-time notifications

## Design Philosophy

### Visual
- **Cinematic** - Movie-like immersion
- **Premium** - Netflix/Airbnb-inspired
- **Dark Mode** - Modern, elegant
- **Smooth** - Framer Motion animations
- **Immersive** - Large visuals, atmospheric

### Experience
- **Emotional** - Make users excited to explore
- **Discovery-First** - No forced onboarding
- **Gen Z** - Modern, energetic, authentic
- **Atmospheric** - Feel the city's energy
- **Accessible** - Works without location permissions

### Anti-Patterns (What We Avoid)
- Enterprise dashboards
- Government app aesthetics
- Generic CRUD interfaces
- Cluttered information
- Forced user flows
- Heavy forms
- Boring cards

## Tech Stack

### Frontend
- **Next.js 16** - App Router
- **React 19** - UI Library
- **TypeScript** - Type Safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Leaflet + OpenStreetMap** - Maps (future)
- **shadcn/ui** - Component library

### Backend
- **Node.js** - Runtime
- **Express.js** - Web Framework
- **PostgreSQL + PostGIS** - Database with geospatial
- **TypeScript** - Type Safety
- **Supabase** - Initial hosting (future)

### Architecture
- **Monorepo** - Single project, multiple packages
- **Microservices Ready** - Can scale to separate services
- **API-First** - Frontend independent from backend

## Data Model

### Places
- Cafes, restaurants, bars, events, nightlife venues
- Food streets, hidden gems, cultural spaces
- Community venues, niche gathering spots
- Geolocation, ratings, hours, images, tags
- Trending score, vibe description

### Categories
- Food & Dining
- Cafes
- Nightlife & Entertainment
- Cultural & Art
- Community & Events
- Niche Scenes
- Experience Types

### Users (Future)
- Profile with location preferences
- Saved places collection
- Contribution/vibe comments
- Community following

## MVP Focus

**Phase 1 - Current**:
- Premium UI/UX
- Beautiful discovery feed
- Mock data (Pune)
- Smooth animations
- Hero section with city vibes

**Phase 2 - Next**:
- Real backend API
- User authentication
- Location-based queries
- Save/bookmark functionality
- Comments system

**Phase 3 - Scale**:
- More cities
- Social features
- Notifications
- Advanced filters
- Mobile app

## Contribution

This is a premium discovery experience. Maintain the cinematic, immersive aesthetic in all changes.

## License

MIT
