# Sheher Backend API

Premium hyperlocal discovery platform backend.

## Setup

```bash
npm install
npm run dev
```

## Environment Variables

Create a `.env` file:

```
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/sheher
NODE_ENV=development
```

## Architecture

- **Express.js** - Fast, lightweight web framework
- **PostgreSQL + PostGIS** - Geospatial queries for location-based discovery
- **TypeScript** - Type safety

## Database Schema

### Tables
- `places` - Discovery places (cafes, restaurants, events, etc.)
- `categories` - Place categories
- `users` - User profiles
- `saved_places` - User's saved places
- `comments` - Vibe comments/reviews
- `events` - Time-based happenings

### PostGIS Geospatial Queries
- Radius search (find places within X km)
- Proximity ranking
- Service area calculations

## API Endpoints (Planned)

### Discovery
- `GET /api/places/nearby` - Nearby places with geolocation
- `GET /api/places/trending` - Trending places
- `GET /api/places/:id` - Place details
- `GET /api/places/search` - Search places

### Categories
- `GET /api/categories` - All categories
- `GET /api/categories/:slug` - Places in category

### User
- `POST /api/users/signup` - Sign up
- `POST /api/users/login` - Login
- `GET /api/users/profile` - User profile

### Saved Places
- `POST /api/saved` - Save a place
- `DELETE /api/saved/:id` - Unsave a place
- `GET /api/saved` - Get user's saved places

### Comments/Vibes
- `POST /api/places/:id/comments` - Add comment
- `GET /api/places/:id/comments` - Get comments for place

## Future Enhancements

- Real-time trending using Apache Kafka/Redis
- AI recommendations
- Social graph for following communities
- Event booking system
- Social features (follow users, create collections)
