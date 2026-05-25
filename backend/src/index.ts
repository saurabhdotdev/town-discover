import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Place, ApiResponse } from "../../shared/types";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check Route
app.get("/api/health", (req, res) => {
  res.json({ status: "Sheher API is alive ✨" });
});

// Discovery Pulse Endpoint - Returns what's trending and alive in the city
app.get("/api/discovery/pulse", (req, res) => {
  const trendingPlaces: Place[] = [
    {
      id: "pune-social-1",
      title: "Viman Nagar Social",
      description: "The neighborhood's favorite hangout, blending a workspace by day and a high-energy bar by night.",
      category: "bar",
      image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80",
      rating: 4.5,
      distance: 0.8,
      latitude: 18.5679,
      longitude: 73.9143,
      tags: ["Nightlife", "Trending", "Cocktails"],
      city: "Pune",
      locality: "Viman Nagar",
      isOpen: true,
      isTrending: true,
      reviewCount: 1250,
      priceRange: "$$",
      hours: { open: "11:00", close: "01:30" },
      vibeDescription: "Electric energy tonight. The deck is packed and the music is peak.",
    },
    {
      id: "blue-tokai-kp",
      title: "Blue Tokai Coffee",
      description: "Artisanal specialty coffee roasters tucked away in a lush green corner of KP.",
      category: "cafe",
      image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80",
      rating: 4.8,
      distance: 1.2,
      latitude: 18.5362,
      longitude: 73.8940,
      tags: ["Quiet", "Hidden Gem", "Specialty Coffee"],
      city: "Pune",
      locality: "Koregaon Park",
      isOpen: true,
      isTrending: false,
      isHiddenGem: true,
      reviewCount: 450,
      priceRange: "$$",
      hours: { open: "08:00", close: "23:00" },
      vibeDescription: "Perfect low-fi atmosphere. Great for deep work or a quiet date.",
    }
  ];

  const response: ApiResponse<Place[]> = {
    success: true,
    data: trendingPlaces,
    timestamp: new Date()
  };
  
  res.json(response);
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Sheher Backend running on port ${PORT}`);
});
