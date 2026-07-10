"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { LazyImage } from "@/components/common/LazyImage";

import { Clock, Download, ExternalLink, ImageIcon, MapPin, Navigation, Share2, Sparkles, Star, Train, Users, X, UtensilsCrossed, ChevronLeft, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { CrowdLevel, CrowdSummary, Place } from "@/types";
import { API_URL, formatDistance, formatHours, formatPlaceArea, formatTime, getCategoryLabel, getInitials, isOpenNow } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { getCategoryFallbackImage } from "@/lib/place-images";
import { SupportedCityName } from "@/lib/pune-location";
import { io } from "socket.io-client";
import { getMetroAccess } from "@/lib/geo";
import { getVisitTimeProfile } from "@/lib/visit-time-model";
import { PostcardCustomizer } from "@/components/common/PostcardCustomizer";


interface PlaceDetailModalProps {
  place: Place | null;
  onClose: () => void;
}

const crowdOptions: { level: CrowdLevel; label: string; description: string }[] = [
  { level: "low", label: "Quiet", description: "Easy entry" },
  { level: "moderate", label: "Steady", description: "Some people" },
  { level: "busy", label: "Busy", description: "Short wait likely" },
  { level: "very_crowded", label: "Packed", description: "Expect a wait" },
];

const crowdLabels: Record<CrowdLevel, string> = {
  low: "Quiet now",
  moderate: "Steady crowd",
  busy: "Busy now",
  very_crowded: "Packed now",
};

const crowdStyles: Record<CrowdLevel, string> = {
  low: "bg-emerald-300 text-slate-950",
  moderate: "bg-cyan-300 text-slate-950",
  busy: "bg-amber-300 text-slate-950",
  very_crowded: "bg-rose-500 text-white",
};

const crowdSummaryUpdatedEvent = "sheher:crowd-summary-updated";

const formatReportTime = (value: string) => {
  const reportedAt = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.round((Date.now() - reportedAt) / 60000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const getRatingSource = (place: Place) => {
  if (place.id.startsWith("osm-")) {
    return "Estimated from live OpenStreetMap listing signals";
  }

  return "From curated place data and public review counts";
};

const getStatusText = (place: Place, open: boolean) => {
  if (!place.hours) return "Hours not listed";
  return open ? `Open until ${formatTime(place.hours.close)}` : `Opens at ${formatTime(place.hours.open)}`;
};

const getCrowdDetail = (summary: CrowdSummary) => {
  const reportText = summary.reportCount === 1 ? "1 recent report" : `${summary.reportCount} recent reports`;
  return `Based on ${reportText}`;
};

const getSiteBaseUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return "https://town-discover.vercel.app";
};

const loadCanvasImage = (src: string) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load place image."));
    image.src = src;
  });
};

const drawCoverImage = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
};

const drawRoundRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

const getCategoryBadgeStyle = (category: string): string => {
  const cat = category?.toLowerCase();
  switch (cat) {
    case "cafe":
      return "bg-amber-500/25 text-amber-200 border border-amber-500/30";
    case "restaurant":
      return "bg-emerald-500/25 text-emerald-200 border border-emerald-500/30";
    case "bar":
    case "nightlife":
      return "bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-500/30";
    case "street-food":
    case "food-stall":
      return "bg-orange-500/25 text-orange-200 border border-orange-500/30";
    case "dessert":
      return "bg-pink-500/25 text-pink-200 border border-pink-500/30";
    case "event":
      return "bg-rose-500/25 text-rose-200 border border-rose-500/30";
    case "heritage":
    case "monument":
      return "bg-yellow-500/25 text-yellow-200 border border-yellow-500/30";
    case "nature":
    case "scenic":
      return "bg-sky-500/25 text-sky-200 border border-sky-500/30";
    default:
      return "bg-teal-500/25 text-teal-200 border border-teal-500/30";
  }
};

const getAvatarColors = (name: string) => {
  const colors = [
    { bg: "bg-teal-500/15", text: "text-teal-300" },
    { bg: "bg-amber-500/15", text: "text-amber-300" },
    { bg: "bg-emerald-500/15", text: "text-emerald-300" },
    { bg: "bg-fuchsia-500/15", text: "text-fuchsia-300" },
    { bg: "bg-orange-500/15", text: "text-orange-300" },
    { bg: "bg-pink-500/15", text: "text-pink-300" },
    { bg: "bg-rose-500/15", text: "text-rose-300" },
    { bg: "bg-sky-500/15", text: "text-sky-300" },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export const PlaceDetailModal: React.FC<PlaceDetailModalProps> = ({ place, onClose }) => {
  const { user, setAuthRequiredMessage } = useAuth();
  const [activePlace, setActivePlace] = useState<Place | null>(null);
  const [placeHistory, setPlaceHistory] = useState<Place[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [surroundings, setSurroundings] = useState<any[]>([]);
  const [loadingSurroundings, setLoadingSurroundings] = useState(false);
  const [surroundingsError, setSurroundingsError] = useState("");

  useEffect(() => {
    if (place) {
      setActivePlace(place);
      setPlaceHistory([]);
    } else {
      setActivePlace(null);
      setPlaceHistory([]);
    }
  }, [place]);

  const metroInfo = activePlace ? getMetroAccess(activePlace.latitude, activePlace.longitude, activePlace.city) : null;
  const [selectedCrowdLevel, setSelectedCrowdLevel] = useState<CrowdLevel>("moderate");
  const [crowdNote, setCrowdNote] = useState("");
  const [crowdSummary, setCrowdSummary] = useState<CrowdSummary | null>(null);
  const [crowdStatus, setCrowdStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [crowdMessage, setCrowdMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [imageSrc, setImageSrc] = useState("");
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsSummary, setReviewsSummary] = useState<{ averageRating: number; reviewCount: number } | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewsError, setReviewsError] = useState("");
  const [userRating, setUserRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [visitSignals, setVisitSignals] = useState<import("@/lib/visit-time-model").RealSignal[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "map">("overview");
  const [copiedShare, setCopiedShare] = useState(false);
  const [postcardOpen, setPostcardOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setReviewImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeReviewImage = (indexToRemove: number) => {
    setReviewImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const fetchReviews = async (placeId: string, signal?: AbortSignal) => {
    setLoadingReviews(true);
    setReviewsError("");
    try {
      const response = await fetch(`/api/places/reviews?placeId=${encodeURIComponent(placeId)}`, {
        signal,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to fetch reviews.");
      setReviews(data.reviews || []);
      setReviewsSummary(data.summary || null);

      // Pre-fill user's own review if they already have one
      if (user && data.reviews) {
        const myReview = data.reviews.find((r: any) => r.userEmail === user.email);
        if (myReview) {
          setUserRating(myReview.rating);
          setReviewText(myReview.text);
          setReviewImages(myReview.imageUrls || []);
        } else {
          setUserRating(5);
          setReviewText("");
          setReviewImages([]);
        }
      }
    } catch (err: any) {
      if (signal?.aborted) return;
      setReviewsError(err.message || "Failed to fetch reviews.");
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (!activePlace) return;
    const controller = new AbortController();
    fetch(`/api/visit-time?placeId=${encodeURIComponent(activePlace.id)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.signals) setVisitSignals(data.signals);
        else setVisitSignals([]);
      })
      .catch(() => setVisitSignals([]));
    return () => controller.abort();
  }, [activePlace?.id]);

  useEffect(() => {
    if (!activePlace) return;
    const controller = new AbortController();
    fetchReviews(activePlace.id, controller.signal);
    return () => controller.abort();
  }, [activePlace, user]);

  const submitReview = async () => {
    if (!activePlace) return;
    if (!user) {
      const message = "Please log in to write a review.";
      setReviewMessage(message);
      setAuthRequiredMessage(message);
      window.location.href = "/profile";
      return;
    }

    if (!reviewText.trim()) {
      setReviewMessage("Please enter your review comment.");
      return;
    }

    setSubmittingReview(true);
    setReviewMessage("");

    try {
      const response = await fetch(`/api/places/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: activePlace.id,
          rating: userRating,
          text: reviewText.trim(),
          imageUrls: reviewImages,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save review.");
      }

      setReviewMessage(data.isNew ? "Review published successfully! +15 XP 🚀" : "Review updated successfully!");
      window.dispatchEvent(new CustomEvent("sheher:refresh-badges"));
      await fetchReviews(activePlace.id);
    } catch (err: any) {
      setReviewMessage(err.message || "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (!activePlace) return;
    setTimeout(() => {
      setImageSrc(activePlace.image);
    }, 0);

    const controller = new AbortController();

    // Fetch dynamic or Wikipedia image
    const params = new URLSearchParams({
      placeId: activePlace.id,
      title: activePlace.title,
      city: activePlace.city,
      category: activePlace.category,
    });

    fetch(`/api/places/image?${params.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { image?: string } | null) => {
        if (data?.image) {
          setImageSrc(data.image);
        }
      })
      .catch(() => undefined);

    fetch(`${API_URL}/api/crowd-reports?placeId=${encodeURIComponent(activePlace.id)}`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load crowd report.");
        setCrowdSummary(data.summary ?? null);
        if (data.summary) {
          window.dispatchEvent(new CustomEvent<CrowdSummary>(crowdSummaryUpdatedEvent, { detail: data.summary }));
        }
        if (data.summary?.crowdLevel) {
          setSelectedCrowdLevel(data.summary.crowdLevel);
        }
        setCrowdStatus("idle");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCrowdSummary(null);
        setCrowdStatus("error");
        setCrowdMessage(error instanceof Error ? error.message : "Unable to load crowd report.");
      });

    return () => controller.abort();
  }, [activePlace]);

  useEffect(() => {
    if (!activePlace) return;

    const socket = io(API_URL, {
      withCredentials: true,
    });

    socket.emit("join-place", activePlace.id);

    socket.on("crowd-update", (data: { placeId: string; summary: CrowdSummary }) => {
      if (data.placeId === activePlace.id) {
        setCrowdSummary(data.summary);
        if (data.summary.crowdLevel) {
          setSelectedCrowdLevel(data.summary.crowdLevel);
        }
      }
    });

    return () => {
      socket.emit("leave-place", activePlace.id);
      socket.disconnect();
    };
  }, [activePlace]);

  // Dynamic nearby places scan logic (750m bounding box)
  useEffect(() => {
    if (!activePlace) return;

    setNearbyPlaces([]);
    setLoadingNearby(true);

    const lat = activePlace.latitude;
    const lng = activePlace.longitude;
    const latOffset = 0.007; // ~750m
    const lngOffset = 0.007 / Math.cos((lat * Math.PI) / 180);

    const south = lat - latOffset;
    const north = lat + latOffset;
    const west = lng - lngOffset;
    const east = lng + lngOffset;

    const params = new URLSearchParams({
      south: String(south),
      west: String(west),
      north: String(north),
      east: String(east),
      city: activePlace.city,
    });

    const controller = new AbortController();

    fetch(`/api/places/osm?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.places) {
          // Filter out the activePlace itself
          const filtered = data.places.filter((p: Place) => p.id !== activePlace.id);
          setNearbyPlaces(filtered);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error("Error fetching nearby places:", err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingNearby(false);
        }
      });

    return () => controller.abort();
  }, [activePlace?.id, activePlace?.latitude, activePlace?.longitude]);

  // Dynamic surroundings and conveniences scan logic (350m radius)
  useEffect(() => {
    if (!activePlace) return;

    setSurroundings([]);
    setLoadingSurroundings(true);
    setSurroundingsError("");

    const controller = new AbortController();

    fetch(`/api/places/surroundings?lat=${activePlace.latitude}&lng=${activePlace.longitude}&radius=350`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load surroundings.");
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.surroundings) {
          setSurroundings(data.surroundings);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setSurroundingsError(err.message || "Failed to load surroundings.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingSurroundings(false);
        }
      });

    return () => controller.abort();
  }, [activePlace?.id, activePlace?.latitude, activePlace?.longitude]);

  const handleSelectSubPlace = (spot: Place) => {
    if (activePlace) {
      setPlaceHistory((prev) => [...prev, activePlace]);
    }
    setActivePlace(spot);
  };

  const handleBack = () => {
    if (placeHistory.length === 0) return;
    const previous = placeHistory[placeHistory.length - 1];
    setPlaceHistory((prev) => prev.slice(0, -1));
    setActivePlace(previous);
  };

  if (!activePlace) return null;

  const isCluster =
    activePlace.category === "street-food" ||
    activePlace.id === "pune-fc-road-street-food" ||
    activePlace.id === "pune-balewadi-high-street" ||
    activePlace.id.includes("loop") ||
    activePlace.id.includes("crawl") ||
    activePlace.tags.includes("student-favorite") ||
    activePlace.tags.includes("market");

  const open = isOpenNow(activePlace.hours);
  const hasHours = Boolean(activePlace.hours);
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${activePlace.latitude},${activePlace.longitude}`;
  const placeUrl = `${getSiteBaseUrl()}/discover?place=${encodeURIComponent(activePlace.id)}`;
  const outletLocation = formatPlaceArea(activePlace);
  const searchQuery = `${activePlace.title} ${outletLocation} ${getCategoryLabel(activePlace.category, activePlace.tags)} outlet`;
  const searchWebUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
  const isFoodCategory = ["cafe", "restaurant", "food-stall", "street-food", "dessert"].includes(activePlace.category);
  const zomatoUrl = `https://www.zomato.com/search?q=${encodeURIComponent(activePlace.title + " " + (activePlace.locality || "") + " " + activePlace.city)}`;
  const swiggyUrl = `https://www.swiggy.com/search?query=${encodeURIComponent(activePlace.title + " " + (activePlace.locality || ""))}`;
  const currentSummary = crowdSummary?.placeId === activePlace.id ? crowdSummary : null;
  const hasCrowdSignal = Boolean(currentSummary?.crowdLevel && currentSummary.reportCount > 0);
  const shareText = `Check out ${activePlace.title} in ${outletLocation} on Sheher. Rating ${activePlace.rating}/5, ${formatDistance(activePlace.distance)} away. ${placeUrl}`;

  const getGoogleMapsDirectionsUrl = () => {
    if (!activePlace.routeWaypoints || activePlace.routeWaypoints.length < 2) return "";
    const origin = `${activePlace.routeWaypoints[0].latitude},${activePlace.routeWaypoints[0].longitude}`;
    const destination = `${activePlace.routeWaypoints[activePlace.routeWaypoints.length - 1].latitude},${activePlace.routeWaypoints[activePlace.routeWaypoints.length - 1].longitude}`;
    
    if (activePlace.routeWaypoints.length === 2) {
      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=walking`;
    }
    
    const waypoints = activePlace.routeWaypoints
      .slice(1, -1)
      .map((w) => `${w.latitude},${w.longitude}`)
      .join("|");
      
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=walking`;
  };

  const submitCrowdReport = async () => {
    if (!user) {
      const message = "Please log in to report live crowd updates.";
      setCrowdStatus("error");
      setCrowdMessage(message);
      setAuthRequiredMessage(message);
      window.location.href = "/profile";
      return;
    }

    setCrowdStatus("saving");
    setCrowdMessage("");

    try {
      const response = await fetch(`${API_URL}/api/crowd-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          placeId: activePlace.id,
          crowdLevel: selectedCrowdLevel,
          note: crowdNote,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save crowd report.");
      }

      setCrowdSummary(data.summary ?? null);
      if (data.summary) {
        window.dispatchEvent(new CustomEvent<CrowdSummary>(crowdSummaryUpdatedEvent, { detail: data.summary }));
      }
      setCrowdNote("");
      setCrowdStatus("saved");
      setCrowdMessage("Thanks. Live crowd status updated.");
    } catch (error) {
      setCrowdStatus("error");
      setCrowdMessage(error instanceof Error ? error.message : "Unable to save crowd report.");
    }
  };

  const drawWrappedText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(" ");
    let line = "";
    let currentY = y;

    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;
      if (context.measureText(testLine).width > maxWidth && line) {
        context.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
        return;
      }

      line = testLine;
    });

    if (line) {
      context.fillText(line, x, currentY);
    }
  };

  const createShareCardBlob = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create share card.");

    const image = await loadCanvasImage(imageSrc || activePlace.image);
    const statusText = !hasHours ? "Hours unknown" : open ? "Open now" : "Closed now";
    const crowdText = hasCrowdSignal && currentSummary?.crowdLevel ? crowdLabels[currentSummary.crowdLevel] : "Crowd not reported";

    context.fillStyle = "#071013";
    context.fillRect(0, 0, 1080, 1350);
    drawCoverImage(context, image, 0, 0, 1080, 760);

    const heroGradient = context.createLinearGradient(0, 180, 0, 860);
    heroGradient.addColorStop(0, "rgba(7, 16, 19, 0.1)");
    heroGradient.addColorStop(0.52, "rgba(7, 16, 19, 0.38)");
    heroGradient.addColorStop(1, "#071013");
    context.fillStyle = heroGradient;
    context.fillRect(0, 0, 1080, 860);

    drawRoundRect(context, 64, 64, 316, 58, 29);
    context.fillStyle = "rgba(255,255,255,0.92)";
    context.fill();
    context.fillStyle = "#071013";
    context.font = "900 25px Arial";
    context.fillText("SHEHER PICK", 96, 103);

    context.fillStyle = "#ffffff";
    context.font = "900 88px Arial";
    drawWrappedText(context, activePlace.title, 72, 650, 900, 92);

    context.fillStyle = "#c8f7ef";
    context.font = "800 34px Arial";
    context.fillText(outletLocation, 72, 810);

    drawRoundRect(context, 72, 878, 936, 174, 34);
    context.fillStyle = "rgba(255,255,255,0.1)";
    context.fill();

    const metrics = [
      { label: "Rating", value: `${activePlace.rating}/5` },
      { label: "Distance", value: formatDistance(activePlace.distance) },
      { label: "Status", value: statusText },
    ];

    metrics.forEach((metric, index) => {
      const x = 112 + index * 300;
      context.fillStyle = "#94a3b8";
      context.font = "800 24px Arial";
      context.fillText(metric.label.toUpperCase(), x, 928);
      context.fillStyle = "#ffffff";
      context.font = "900 38px Arial";
      context.fillText(metric.value, x, 986);
    });

    context.fillStyle = "#d7dee8";
    context.font = "700 30px Arial";
    drawWrappedText(context, activePlace.description, 72, 1114, 700, 42);

    drawRoundRect(context, 790, 1084, 218, 190, 28);
    context.fillStyle = "#ffffff";
    context.fill();
    context.fillStyle = "#071013";
    context.font = "900 26px Arial";
    context.fillText("View", 830, 1142);
    context.fillText("details", 830, 1174);
    context.fillStyle = "#0f766e";
    context.fillRect(838, 1208, 34, 34);
    context.fillRect(892, 1208, 34, 34);
    context.fillRect(946, 1208, 34, 34);
    context.fillRect(838, 1154, 34, 34);
    context.fillRect(946, 1154, 34, 34);

    context.fillStyle = "#5ff2df";
    context.font = "900 28px Arial";
    context.fillText(crowdText, 72, 1262);
    context.fillStyle = "#cbd5e1";
    context.font = "700 24px Arial";
    context.fillText(placeUrl.replace(/^https?:\/\//, ""), 72, 1302);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Unable to export share card."));
      }, "image/png");
    });
  };

  const shareVisualCard = async () => {
    setShareMessage("");

    try {
      const blob = await createShareCardBlob();
      const file = new File([blob], `${activePlace.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-sheher-card.png`, {
        type: "image/png",
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${activePlace.title} on Sheher`, text: shareText, url: placeUrl, files: [file] });
        setShareMessage("Share card opened.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setShareMessage("Share card downloaded.");
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : "Unable to create share card.");
    }
  };

  const shareOnWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noreferrer");
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/68 p-0 backdrop-blur-sm md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${activePlace.title} details`}
    >
      <motion.div
        initial={{ y: 48, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 48, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl md:max-h-[92vh] md:max-w-2xl md:rounded-2xl"
      >
        {/* ── Full-bleed hero ── */}
        <div className="relative h-72 overflow-hidden bg-slate-900 sm:h-80">
          <Image
            src={imageSrc || activePlace.image}
            alt={`${activePlace.title} in ${activePlace.locality}`}
            fill
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-cover transition-transform duration-700 hover:scale-105"
            onError={() => {
              const fallback = getCategoryFallbackImage(activePlace.city as SupportedCityName, activePlace.category, activePlace.title);
              if (imageSrc !== fallback) {
                setImageSrc(fallback);
              }
            }}
          />
          {/* Cinematic gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080b0f] via-[#080b0f]/30 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent" />

          {/* Top bar actions */}
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
            {placeHistory.length > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-2 text-xs font-black uppercase tracking-wider text-white backdrop-blur-md transition hover:bg-black/70 hover:scale-[1.02] active:scale-[0.98]"
              >
                <ChevronLeft size={15} />
                Back
              </button>
            ) : <div />}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close place details"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 hover:scale-[1.05]"
            >
              <X size={18} />
            </button>
          </div>

          {/* Bottom overlay: badges + title */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] backdrop-blur-md ${getCategoryBadgeStyle(activePlace.category)}`}>
                {getCategoryLabel(activePlace.category, activePlace.tags)}
              </span>
              {open && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/25 border border-emerald-500/35 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Open now
                </span>
              )}
              {activePlace.isTrending && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/25 border border-rose-500/35 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300 backdrop-blur-md">
                  🔥 Trending
                </span>
              )}
            </div>
            <h2 className="line-clamp-2 text-2xl font-black tracking-tight text-white sm:text-3xl drop-shadow-lg">{activePlace.title}</h2>
            <div className="mt-1.5 flex items-center gap-3">
              <p className="flex items-center gap-1 text-sm font-semibold text-slate-300">
                <MapPin size={12} className="text-teal-400" />
                {outletLocation}
              </p>
              {activePlace.rating > 0 && (
                <span className="flex items-center gap-1 text-sm font-black text-amber-400">
                  <Star size={12} className="fill-amber-400" />
                  {activePlace.rating}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="relative flex border-b border-[var(--border)] bg-[var(--panel-strong)] px-4 sticky top-0 z-20 backdrop-blur-xl">
          {(["overview", "reviews", "map"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative py-3 px-4 text-xs font-black uppercase tracking-widest transition-colors ${
                activeTab === tab ? "text-teal-300" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab === "overview" ? "Overview" : tab === "reviews" ? "Reviews" : "Map"}
              {activeTab === tab && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-teal-400"
                />
              )}
            </button>
          ))}
          {/* Share button in tab bar */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(placeUrl).then(() => {
                  setCopiedShare(true);
                  setTimeout(() => setCopiedShare(false), 2000);
                });
              }}
              className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--muted-strong)] transition hover:border-teal-400/40 hover:text-teal-300"
            >
              {copiedShare ? (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-emerald-400 flex items-center gap-1"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Copied!
                </motion.span>
              ) : (
                <>
                  <Share2 size={11} /> Share
                </>
              )}
            </button>
          </div>
        </div>

        {activeTab === "overview" && (
        <div className="space-y-4 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] md:space-y-5 md:p-6">
          <p className="text-sm leading-6 text-[var(--muted-strong)] sm:text-base sm:leading-7">{activePlace.description}</p>

          {/* Walking Trail Timeline */}
          {activePlace.trailStops && activePlace.trailStops.length > 0 && (
            <div className="space-y-4 rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-300">
                  <Navigation size={14} className="text-teal-400 rotate-45" />
                  Walking Trail Timeline
                </h3>
                <span className="rounded-full bg-teal-500/10 border border-teal-500/25 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal-300">
                  {activePlace.trailStops.length} Stops
                </span>
              </div>

              <div className="relative border-l border-dashed border-teal-500/30 pl-5 ml-2.5 space-y-5">
                {activePlace.trailStops.map((stop, idx) => (
                  <div key={idx} className="relative space-y-1">
                    {/* Bullet node */}
                    <span className="absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border border-teal-400 text-[9px] font-black text-teal-300 shadow-[0_0_8px_rgba(45,212,191,0.3)]">
                      {idx + 1}
                    </span>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-100 text-xs leading-snug">{stop.title}</h4>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                          {stop.locality}
                        </p>
                        <p className="text-[11px] text-[var(--muted-strong)] leading-relaxed mt-1">{stop.description}</p>
                      </div>
                      {stop.image && (
                        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-slate-900 shadow">
                          <LazyImage src={stop.image} alt={stop.title} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {activePlace.routeWaypoints && activePlace.routeWaypoints.length >= 2 && (
                <div className="pt-2">
                  <a
                    href={getGoogleMapsDirectionsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-400 hover:bg-teal-300 px-4 py-2.5 text-xs font-black text-slate-950 transition shadow-lg cursor-pointer"
                  >
                    <MapPin size={14} />
                    Open Walking Route in Google Maps
                  </a>
                </div>
              )}
            </div>
          )}

          {isCluster && (nearbyPlaces.length > 0 || loadingNearby) && (
            <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-teal-300">
                  <span className="text-base">📍</span>
                  Spots inside this Vibe Hub
                </h3>
                {loadingNearby && (
                  <span className="text-xs font-semibold text-[var(--muted)] animate-pulse">Scanning Hub...</span>
                )}
              </div>
              
              {loadingNearby && nearbyPlaces.length === 0 ? (
                <div className="flex h-36 items-center justify-center gap-2 text-sm font-semibold text-[var(--muted)]">
                  <span className="animate-spin text-lg">⏳</span> Scanning OpenStreetMap for live food stalls, cafes, and events...
                </div>
              ) : (
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
                  {nearbyPlaces.map((spot) => (
                    <button
                      key={spot.id}
                      onClick={() => handleSelectSubPlace(spot)}
                      className="group/spot-card relative h-40 w-52 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] text-left transition hover:border-teal-400/40 hover:scale-[1.02]"
                    >
                      <div className="relative h-20 w-full overflow-hidden bg-slate-800">
                        <LazyImage
                          src={spot.image}
                          alt={spot.title}
                          className="transition duration-500 group-hover/spot-card:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <span className="absolute bottom-1.5 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-teal-300">
                          {spot.category}
                        </span>
                        {spot.rating > 0 && (
                          <span className="absolute top-1.5 right-2 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold text-amber-400 flex items-center gap-0.5">
                            ★ {spot.rating}
                          </span>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <h4 className="text-xs font-black text-slate-200 line-clamp-1 group-hover/spot-card:text-teal-300 transition-colors">
                          {spot.title}
                        </h4>
                        <p className="text-[10px] text-[var(--muted)] line-clamp-2 leading-relaxed">
                          {spot.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <Star size={14} />
                Rating
              </div>
              <p className="font-black text-[var(--foreground)]">
                {reviewsSummary ? reviewsSummary.averageRating : activePlace.rating} <span className="font-medium text-[var(--muted)]">({reviewsSummary ? reviewsSummary.reviewCount : activePlace.reviewCount})</span>
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted)]">
                {reviewsSummary && reviewsSummary.reviewCount > 0 ? "From local community vibe checks" : getRatingSource(activePlace)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <MapPin size={14} />
                Distance
              </div>
              <p className="font-black text-[var(--foreground)]">{formatDistance(activePlace.distance)}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <Clock size={14} />
                Status
              </div>
              <p className={hasHours ? (open ? "font-black text-emerald-300" : "font-black text-rose-300") : "font-black text-[var(--muted)]"}>
                {!hasHours ? "Hours unavailable" : open ? "Open now" : "Closed"}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted)]">{getStatusText(activePlace, open)}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <Users size={14} />
                Crowd
              </div>
              {hasCrowdSignal && currentSummary?.crowdLevel ? (
                <div className="space-y-1">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${crowdStyles[currentSummary.crowdLevel]}`}>
                    {crowdLabels[currentSummary.crowdLevel]}
                  </span>
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    {getCrowdDetail(currentSummary)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-black text-[var(--foreground)]">No live crowd update</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted)]">Be the first to report today.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Smart Visit Time Heatmap ─────────────────────────── */}
          {(() => {
            const vtp = getVisitTimeProfile(activePlace, new Date(), visitSignals);
            const intensityBar: Record<string, string> = {
              quiet:    "bg-emerald-500",
              moderate: "bg-amber-400",
              busy:     "bg-orange-500",
              peak:     "bg-rose-600",
            };
            const intensityGlow: Record<string, string> = {
              quiet:    "shadow-[0_0_6px_rgba(16,185,129,0.6)]",
              moderate: "shadow-[0_0_6px_rgba(251,191,36,0.6)]",
              busy:     "shadow-[0_0_6px_rgba(249,115,22,0.6)]",
              peak:     "shadow-[0_0_6px_rgba(225,29,72,0.7)]",
            };
            const headerColors: Record<string, string> = {
              quiet:    "text-emerald-300",
              moderate: "text-amber-300",
              busy:     "text-orange-300",
              peak:     "text-rose-400",
            };
            const currentColor = headerColors[vtp.currentIntensity];
            return (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                      <TrendingUp size={13} />
                      Best Time to Visit
                      {vtp.hasRealData && (
                        <span className="ml-1 rounded-full bg-teal-500/15 border border-teal-500/25 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-teal-400">
                          From real data
                        </span>
                      )}
                    </p>
                    <p className={`mt-1 text-sm font-black ${currentColor}`}>
                      {{
                        quiet:    "🟢 Quiet — Great time now",
                        moderate: "🟡 Moderate crowd right now",
                        busy:     "🟠 Getting busy now",
                        peak:     "🔴 Peak hours — might be crowded",
                      }[vtp.currentIntensity]}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Best time</p>
                    <p className="mt-0.5 text-sm font-black text-teal-300">{vtp.bestLabel}</p>
                    <p className="text-[10px] font-semibold text-[var(--muted)]">{vtp.bestDayLabel}</p>
                  </div>
                </div>

                {/* Hourly bar chart */}
                <div className="space-y-1.5">
                  <div className="flex items-end gap-[3px] h-12">
                    {vtp.hourlySlots.map((slot) => (
                      <div
                        key={slot.hour}
                        className="relative flex-1 flex flex-col items-center justify-end group/slot"
                        title={`${slot.label}: ${slot.intensity}`}
                      >
                        <div
                          className={`w-full rounded-sm transition-all duration-300 ${
                            intensityBar[slot.intensity]
                          } ${slot.isNow ? intensityGlow[slot.intensity] : "opacity-60 group-hover/slot:opacity-80"}`}
                          style={{ height: `${Math.max(10, slot.score * 100)}%` }}
                        />
                        {slot.isNow && (
                          <span className="absolute -top-4 left-1/2 -translate-x-1/2 flex h-3 w-3 items-center justify-center">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                          </span>
                        )}
                        {slot.isRealData && !slot.isNow && (
                          <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-teal-300 opacity-80" />
                        )}
                      </div>
                    ))}

                  </div>
                  {/* Hour labels — show every 3rd */}
                  <div className="flex items-center gap-[3px]">
                    {vtp.hourlySlots.map((slot, idx) => (
                      <div
                        key={slot.hour}
                        className={`flex-1 text-center text-[8px] font-bold leading-none ${
                          slot.isNow ? "text-white" : "text-[var(--muted)]"
                        }`}
                      >
                        {idx % 3 === 0 ? slot.label : ""}
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] font-semibold leading-relaxed text-[var(--muted)]">
                  {vtp.tip}
                </p>
              </div>
            );
          })()}

          <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">

            <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Today</p>
                <p className="mt-1 font-semibold text-[var(--muted-strong)]">{formatHours(activePlace.hours)}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {hasCrowdSignal && currentSummary?.latestReportedAt
                    ? `Live crowd status uses reports from the last 45 minutes. Last updated ${formatReportTime(currentSummary.latestReportedAt)}.`
                    : "Opening hours come from the place listing when available. Live crowd updates appear here after someone reports."}
                </p>
              </div>

              {metroInfo && (
                <div className="mt-1 border-t border-[var(--border)] pt-3">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    <Train size={14} className="text-cyan-400" />
                    Transit Access
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-[var(--foreground)]">
                    {metroInfo.label}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <Users size={14} />
                Report Crowd
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {crowdOptions.map((option) => {
                  const active = selectedCrowdLevel === option.level;
                  return (
                    <button
                      key={option.level}
                      type="button"
                      onClick={() => setSelectedCrowdLevel(option.level)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        active
                          ? "border-teal-300 bg-teal-300/15"
                          : "border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel-strong)]"
                      }`}
                    >
                      <span className="block text-sm font-black text-[var(--foreground)]">{option.label}</span>
                      <span className="mt-0.5 block text-xs font-semibold text-[var(--muted)]">{option.description}</span>
                    </button>
                  );
                })}
              </div>

              <textarea
                value={crowdNote}
                onChange={(event) => setCrowdNote(event.target.value)}
                maxLength={180}
                placeholder="Optional note, like queue at entry"
                className="mt-3 min-h-20 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-teal-300"
              />

              <button
                type="button"
                onClick={submitCrowdReport}
                disabled={crowdStatus === "saving"}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-black text-[var(--primary-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Users size={18} />
                {crowdStatus === "saving" ? "Sharing..." : user ? "Submit Report" : "Log In To Report"}
              </button>

              {crowdMessage && (
                <p className={`mt-2 text-sm font-semibold ${crowdStatus === "error" ? "text-rose-400" : "text-emerald-400"}`}>
                  {crowdMessage}
                </p>
              )}
            </div>
          </div>

          {/* Surroundings & Nearby Conveniences (Live Overpass Scan) */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4 space-y-4 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <span className="text-teal-400 animate-pulse">📡</span>
                Surroundings & Conveniences (Live Scan)
              </h3>
              {loadingSurroundings && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 rounded-full px-2 py-0.5 border border-teal-500/20 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping mr-1" />
                  Scanning 350m...
                </span>
              )}
            </div>

            {loadingSurroundings && surroundings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-[var(--muted-strong)]">
                <div className="relative mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-teal-500/20 bg-teal-500/5">
                  <span className="absolute h-full w-full rounded-full border border-teal-400 animate-ping opacity-30" />
                  <span className="text-lg">📡</span>
                </div>
                <p className="font-bold max-w-sm leading-relaxed">Scanning OpenStreetMap for nearby parking, toilets, ATMs, and transit...</p>
              </div>
            ) : surroundingsError ? (
              <p className="text-xs font-semibold text-rose-400">{surroundingsError}</p>
            ) : surroundings.length === 0 ? (
              <p className="text-xs font-semibold text-[var(--muted)] italic">No conveniences (toilets, parking, ATMs) found within 350m.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {surroundings.slice(0, 10).map((item) => {
                  let icon = "📍";
                  let typeColor = "text-slate-300";
                  
                  if (item.type === "toilets") {
                    icon = "🚻";
                    typeColor = "text-pink-300";
                  } else if (item.type === "parking") {
                    icon = "🅿️";
                    typeColor = "text-blue-300";
                  } else if (item.type === "atm") {
                    icon = "💵";
                    typeColor = "text-emerald-300";
                  } else if (item.type === "water") {
                    icon = "💧";
                    typeColor = "text-cyan-300";
                  } else if (item.type === "transit") {
                    icon = "🚌";
                    typeColor = "text-amber-300";
                  } else if (item.type === "police") {
                    icon = "👮";
                    typeColor = "text-indigo-300";
                  } else if (item.type === "hospital") {
                    icon = "🏥";
                    typeColor = "text-rose-300";
                  } else if (item.type === "pharmacy") {
                    icon = "💊";
                    typeColor = "text-teal-300";
                  }

                  const distMeters = Math.round(item.distance * 1000);
                  const distText = distMeters < 1000 ? `${distMeters}m` : `${(distMeters / 1000).toFixed(1)} km`;

                  const extraLabels = [];
                  if (item.details.fee === "yes") extraLabels.push("Paid");
                  if (item.details.fee === "no") extraLabels.push("Free");
                  if (item.details.wheelchair === "yes") extraLabels.push("♿ Access");
                  if (item.details.capacity) extraLabels.push(`Cap: ${item.details.capacity}`);

                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;

                  return (
                    <a
                      key={item.id}
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 hover:border-teal-400/40 hover:bg-[var(--panel-strong)] transition animate-fade-in group cursor-pointer"
                    >
                      <div className="text-xl shrink-0 mt-0.5">{icon}</div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${typeColor}`}>
                            {item.label}
                          </span>
                          <span className="text-[10px] font-black text-[var(--muted-strong)] group-hover:text-teal-300 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1">
                            🚶 {distText}
                            <ExternalLink size={10} className="opacity-60" />
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-slate-200 line-clamp-1 leading-tight group-hover:text-teal-300 transition-colors">
                          {item.name || `Unlabeled ${item.label}`}
                        </h4>
                        {extraLabels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {extraLabels.map((lbl, idx) => (
                              <span key={idx} className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                                {lbl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reviews & Ratings Section */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4 space-y-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              <Star size={14} className="text-amber-400 fill-amber-400" />
              Reviews & Ratings
            </h3>

            <div className="space-y-4">
              {/* Creator Highlights */}
              {activePlace.influencerFeatures && activePlace.influencerFeatures.length > 0 && (
                <div className="space-y-2 border-b border-[var(--border)] pb-4">
                  <p className="text-xs font-black uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                    <Sparkles size={13} className="animate-pulse" />
                    Creator Choices & Vibe Checks ({activePlace.influencerFeatures.length})
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activePlace.influencerFeatures.map((feat, idx) => (
                      <a
                        key={idx}
                        href={feat.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded-lg border border-teal-500/20 bg-teal-500/5 p-2.5 transition hover:border-teal-400 hover:bg-teal-500/10 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-teal-300 text-xs">{feat.creatorName}</span>
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-teal-200 transition">
                              {feat.handle}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 text-amber-400">
                            <Star size={9} fill="currentColor" />
                            <span className="text-[10px] font-black">{feat.rating}</span>
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-200 italic">
                          "{feat.quote}"
                        </p>
                        <div className="mt-1.5 flex items-center justify-end text-[9px] font-black uppercase tracking-widest text-teal-400 group-hover:translate-x-0.5 transition-transform">
                          Watch Reel ↗
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Form */}
              <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3 space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-300">
                  {reviews.some((r) => r.userEmail === user?.email) ? "Update your review" : "Leave a vibe check"}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setUserRating(star)}
                        className="text-amber-400 hover:scale-110 transition cursor-pointer"
                      >
                        <Star
                          size={20}
                          fill={userRating >= star ? "currentColor" : "none"}
                          className={userRating >= star ? "drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" : "text-slate-500"}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-black text-slate-400">
                    {userRating === 5 ? "Mindblowing 🚀" : userRating === 4 ? "Great vibe ✨" : userRating === 3 ? "Decent spot ☕" : userRating === 2 ? "Meh 🥱" : "Avoid 🙅"}
                  </span>
                </div>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  maxLength={500}
                  placeholder="Share details of your experience: vibe, pricing, must-try items..."
                  className="min-h-16 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-teal-300"
                />

                {/* Photo attachments */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {reviewImages.map((img, index) => (
                      <div key={index} className="relative h-20 w-20 overflow-hidden rounded-lg">
                        <LazyImage src={img} alt="preview" />
                        <button
                          type="button"
                          onClick={() => removeReviewImage(index)}
                          className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[8px] text-white hover:bg-black/90 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {reviewImages.length < 5 && (
                      <label className="flex h-14 w-14 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/[0.02] hover:bg-white/[0.05] transition">
                        <span className="text-base font-bold text-slate-400 leading-none">+</span>
                        <span className="text-[8px] font-black uppercase text-slate-500 mt-0.5">Photos</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={submitReview}
                  disabled={submittingReview}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 hover:bg-teal-400 px-4 py-2 text-xs font-black text-slate-950 transition disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  <Star size={14} className="fill-slate-950" />
                  {submittingReview ? "Submitting..." : user ? "Submit Review (+15 XP)" : "Log In to Write a Review"}
                </button>
                {reviewMessage && (
                  <p className={`text-xs font-semibold ${reviewMessage.includes("error") || reviewMessage.includes("Please") ? "text-rose-400" : "text-emerald-400"}`}>
                    {reviewMessage}
                  </p>
                )}
              </div>

              {/* Reviews List */}
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Visitor Reviews ({reviews.length})
                </p>
                {loadingReviews ? (
                  <p className="text-xs font-semibold text-[var(--muted)]">Loading reviews...</p>
                ) : reviewsError ? (
                  <p className="text-xs font-semibold text-rose-400">{reviewsError}</p>
                ) : reviews.length === 0 ? (
                  <p className="text-xs font-semibold text-[var(--muted)] italic">No reviews yet. Be the first to share the vibe!</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                    {reviews.map((r) => {
                      const avatarColors = getAvatarColors(r.userFullName || "");
                      return (
                        <div key={r.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 space-y-1.5 text-xs transition duration-200 hover:border-slate-700/60 hover:bg-slate-900/35">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black ${avatarColors.bg} ${avatarColors.text}`}>
                                {getInitials(r.userFullName)}
                              </div>
                              <span className="font-bold text-[var(--foreground)]">{r.userFullName}</span>
                            </div>
                            <span className="text-[10px] text-[var(--muted)]">{formatReportTime(r.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-0.5 text-amber-400">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={10}
                                fill={i < r.rating ? "currentColor" : "none"}
                                className={i < r.rating ? "" : "text-slate-600"}
                              />
                            ))}
                          </div>
                          <p className="text-[var(--muted-strong)] font-medium leading-relaxed break-words">{r.text}</p>
                          {r.imageUrls && r.imageUrls.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {r.imageUrls.map((url: string, imgIdx: number) => (
                                <div key={imgIdx} className="relative h-16 w-16 overflow-hidden rounded-lg cursor-pointer border border-[var(--border)] hover:border-[var(--muted)] transition">
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                                    <LazyImage src={url} alt={`Review photo ${imgIdx + 1}`} />
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                 )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              <Share2 size={14} />
              Share this place
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setPostcardOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-3 font-black text-slate-950 transition hover:opacity-90 shadow-[0_0_16px_rgba(45,212,191,0.25)]"
              >
                <ImageIcon size={16} />
                Customize Postcard
              </button>
              <button
                type="button"
                onClick={shareVisualCard}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 font-black text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
              >
                <Download size={16} />
                Quick Download
              </button>
              <button
                type="button"
                onClick={shareOnWhatsApp}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 font-black text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
              >
                <Share2 size={16} />
                WhatsApp
              </button>
            </div>
            {shareMessage && <p className="mt-2 text-sm font-semibold text-emerald-300">{shareMessage}</p>}
          </div>

          {isFoodCategory && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <UtensilsCrossed size={14} className="text-teal-400 animate-pulse" />
                Order & Table Vibe Check
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <a
                  href={swiggyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#fc8019] px-4 py-3 font-black text-white shadow-md shadow-orange-600/10 transition hover:bg-[#e47316] hover:scale-[1.01]"
                >
                  <span className="text-base">🛵</span>
                  Order on Swiggy
                </a>
                <a
                  href={zomatoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#cb202d] px-4 py-3 font-black text-white shadow-md shadow-rose-700/10 transition hover:bg-[#b31c27] hover:scale-[1.01]"
                >
                  <span className="text-base">🍽️</span>
                  Check on Zomato
                </a>
              </div>
            </div>
          )}
          {!isCluster && (nearbyPlaces.length > 0 || loadingNearby) && (
            <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-teal-300">
                  <span className="text-base">✨</span>
                  Explore Nearby Spots & Happenings
                </h3>
                {loadingNearby && (
                  <span className="text-xs font-semibold text-[var(--muted)] animate-pulse">Searching area...</span>
                )}
              </div>
              
              {loadingNearby && nearbyPlaces.length === 0 ? (
                <div className="flex h-36 items-center justify-center gap-2 text-sm font-semibold text-[var(--muted)]">
                  <span className="animate-spin text-lg">⏳</span> Finding nearby cafes, food stalls, and events...
                </div>
              ) : (
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
                  {nearbyPlaces.slice(0, 10).map((spot) => (
                    <button
                      key={spot.id}
                      onClick={() => handleSelectSubPlace(spot)}
                      className="group/spot-card relative h-40 w-52 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] text-left transition hover:border-teal-400/40 hover:scale-[1.02]"
                    >
                      <div className="relative h-20 w-full overflow-hidden bg-slate-800">
                        <LazyImage
                          src={spot.image}
                          alt={spot.title}
                          className="transition duration-500 group-hover/spot-card:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <span className="absolute bottom-1.5 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-teal-300">
                          {spot.category}
                        </span>
                        {spot.rating > 0 && (
                          <span className="absolute top-1.5 right-2 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold text-amber-400 flex items-center gap-0.5">
                            ★ {spot.rating}
                          </span>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <h4 className="text-xs font-black text-slate-200 line-clamp-1 group-hover/spot-card:text-teal-300 transition-colors">
                          {spot.title}
                        </h4>
                        <p className="text-[10px] text-[var(--muted)] line-clamp-2 leading-relaxed">
                          {spot.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {activePlace.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-sm font-semibold text-[var(--muted-strong)]"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 font-black text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              <Navigation size={18} />
              Directions
            </a>
            <a
              href={searchWebUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 font-black text-[var(--foreground)] transition hover:bg-[var(--panel)]"
            >
              <ExternalLink size={18} />
              Search Web
            </a>
          </div>
        </div>
        )}

        {/* ── Reviews Tab ── */}
        {activeTab === "reviews" && (
          <div className="p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] md:p-6 space-y-5">
            {loadingReviews ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--panel-soft)]" />
                ))}
              </div>
            ) : reviewsError ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 p-6 text-center">
                <p className="text-sm font-semibold text-rose-300">{reviewsError}</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-8 text-center">
                <Star size={32} className="mx-auto mb-3 text-[var(--muted)] opacity-40" />
                <p className="font-black text-[var(--foreground)]">No reviews yet</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Be the first to review this place!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviewsSummary && (
                  <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
                    <div className="text-center">
                      <p className="text-4xl font-black text-[var(--foreground)]">{reviewsSummary.averageRating.toFixed(1)}</p>
                      <div className="mt-1 flex items-center justify-center gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={12} className={s <= Math.round(reviewsSummary.averageRating) ? "fill-amber-400 text-amber-400" : "text-[var(--border)]"} />
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--muted)]">{reviewsSummary.reviewCount} reviews</p>
                    </div>
                  </div>
                )}
                {reviews.map((review: any) => {
                  const avatarColors = getAvatarColors(review.userFullName || review.userEmail || "U");
                  return (
                    <motion.div
                      key={review.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 space-y-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${avatarColors.bg} ${avatarColors.text} text-sm font-black`}>
                          {getInitials(review.userFullName || review.userEmail || "U")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-black text-[var(--foreground)]">{review.userFullName || "Explorer"}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} size={10} className={s <= review.rating ? "fill-amber-400 text-amber-400" : "text-[var(--border)]"} />
                              ))}
                            </div>
                            <span className="text-[10px] text-[var(--muted)]">{formatReportTime(review.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--muted-strong)] leading-relaxed">{review.text}</p>
                      {review.imageUrls?.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
                          {review.imageUrls.map((url: string, i: number) => (
                            <div key={i} className="relative h-20 w-28 shrink-0 rounded-lg overflow-hidden border border-[var(--border)]">
                              <LazyImage src={url} alt={`Review photo ${i+1}`} />
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Write review */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 space-y-3">
              <h3 className="text-sm font-black text-[var(--foreground)] flex items-center gap-2">
                <Star size={14} className="text-amber-400" />
                {reviews.find((r: any) => r.userEmail === user?.email) ? "Update Your Review" : "Write a Review"}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted)]">Rating:</span>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setUserRating(s)} className="transition hover:scale-125">
                      <Star size={18} className={s <= userRating ? "fill-amber-400 text-amber-400" : "text-[var(--border)]"} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder="Share your experience..."
                rows={3}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--input)] p-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-teal-400/70 resize-none"
              />
              {reviewMessage && (
                <p className={`text-xs font-semibold ${reviewMessage.includes("success") || reviewMessage.includes("🚀") ? "text-emerald-400" : "text-rose-400"}`}>{reviewMessage}</p>
              )}
              <button
                onClick={submitReview}
                disabled={submittingReview}
                className="w-full rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 px-4 py-2.5 text-sm font-black text-slate-950 transition"
              >
                {submittingReview ? "Submitting…" : "Publish Review"}
              </button>
            </div>
          </div>
        )}

        {/* ── Map Tab ── */}
        {activeTab === "map" && (
          <div className="p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] md:p-6 space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] overflow-hidden">
              <iframe
                title={`Map of ${activePlace.title}`}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${activePlace.longitude - 0.005},${activePlace.latitude - 0.005},${activePlace.longitude + 0.005},${activePlace.latitude + 0.005}&layer=mapnik&marker=${activePlace.latitude},${activePlace.longitude}`}
                className="w-full h-64 sm:h-80 border-0"
                loading="lazy"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 font-black text-[var(--primary-foreground)] transition hover:opacity-90"
              >
                <Navigation size={16} />
                Get Directions
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activePlace.title + " " + outletLocation)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 font-black text-[var(--foreground)] transition hover:bg-[var(--panel)]"
              >
                <MapPin size={16} />
                Open in Google Maps
              </a>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-teal-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-black text-[var(--foreground)]">{activePlace.title}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">{outletLocation}</p>
                  <p className="text-[10px] font-mono text-[var(--muted)] mt-1 opacity-60">
                    {activePlace.latitude.toFixed(5)}, {activePlace.longitude.toFixed(5)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
    <PostcardCustomizer
      place={activePlace}
      imageSrc={imageSrc}
      open={postcardOpen}
      onClose={() => setPostcardOpen(false)}
    />
    </>
  );
};
