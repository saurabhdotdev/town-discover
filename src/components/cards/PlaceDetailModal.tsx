"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { LazyImage } from "@/components/common/LazyImage";

import { Clock, Download, ExternalLink, MapPin, Navigation, Share2, Sparkles, Star, Train, Users, X, UtensilsCrossed, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { CrowdLevel, CrowdSummary, Place } from "@/types";
import { API_URL, formatDistance, formatHours, formatPlaceArea, formatTime, getCategoryLabel, getInitials, isOpenNow } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { getCategoryFallbackImage } from "@/lib/place-images";
import { SupportedCityName } from "@/lib/pune-location";
import { io } from "socket.io-client";
import { getMetroAccess } from "@/lib/geo";

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
        className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-lg border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl md:max-h-[90vh] md:max-w-2xl md:rounded-lg"
      >
        <div className="relative h-56 overflow-hidden bg-slate-900 sm:h-64">
          <Image
            src={imageSrc || activePlace.image}
            alt={`${activePlace.title} in ${activePlace.locality}`}
            fill
            sizes="(max-width: 768px) 100vw, 672px"
            onError={() => {
              const fallback = getCategoryFallbackImage(activePlace.city as SupportedCityName, activePlace.category, activePlace.title);
              if (imageSrc !== fallback) {
                setImageSrc(fallback);
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10151d] via-[#10151d]/24 to-black/20" />
          
          {placeHistory.length > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="absolute left-4 top-4 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs font-black uppercase tracking-wider text-white backdrop-blur-md transition hover:bg-black/70 z-50 hover:scale-[1.02] active:scale-[0.98]"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close place details"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
          >
            <X size={20} />
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <span className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-950">
              {getCategoryLabel(activePlace.category, activePlace.tags)}
            </span>
            <h2 className="line-clamp-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{activePlace.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-300">{outletLocation}</p>
          </div>
        </div>

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
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {reviews.map((r) => (
                      <div key={r.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2.5 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/10 text-[9px] font-black text-teal-300">
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
                    ))}
                  </div>
                 )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              <Share2 size={14} />
              Share this place
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={shareVisualCard}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-black text-[var(--primary-foreground)] transition hover:opacity-90"
              >
                <Download size={18} />
                Share Visual Card
              </button>
              <button
                type="button"
                onClick={shareOnWhatsApp}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 font-black text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
              >
                <Share2 size={18} />
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
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-black text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              <Navigation size={18} />
              Directions
            </a>
            <a
              href={searchWebUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 font-black text-[var(--foreground)] transition hover:bg-[var(--panel)]"
            >
              <ExternalLink size={18} />
              Search Web
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
