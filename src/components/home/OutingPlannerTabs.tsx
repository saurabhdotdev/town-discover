"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Compass, Map } from "lucide-react";
import { Place, UserLocation } from "@/types";
import { getCategoryLabel } from "@/lib/utils";

// Matching TypeScript definition from the API route
interface LiveEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  time: string;
  locality: string;
}

interface OutingPlannerTabsProps {
  allPlaces: Place[];
  activeCity: string;
  location: UserLocation | null;
  user: any;
  setSelectedPlace: (place: Place) => void;
}

export function OutingPlannerTabs({
  allPlaces,
  activeCity,
  location,
  user,
  setSelectedPlace,
}: OutingPlannerTabsProps) {
  const router = useRouter();

  // Spontaneous Trail states
  const [widgetStartMode, setWidgetStartMode] = useState<"random" | "geo" | "place">("random");
  const [widgetStartPlaceId, setWidgetStartPlaceId] = useState<string>("");
  const [widgetTimeBudget, setWidgetTimeBudget] = useState<"1" | "3" | "5">("3");
  const [widgetTheme, setWidgetTheme] = useState<"mix" | "cafe" | "food" | "scenic">("mix");
  const [widgetGenerating, setWidgetGenerating] = useState(false);
  const [widgetSearchQuery, setWidgetSearchQuery] = useState("");
  const [widgetSearchFocused, setWidgetSearchFocused] = useState(false);
  const [widgetPreviewStops, setWidgetPreviewStops] = useState<Place[] | null>(null);
  const [widgetPreviewStats, setWidgetPreviewStats] = useState<{ distance: number; duration: number } | null>(null);
  const [widgetPreviewName, setWidgetPreviewName] = useState("");

  // Area Layover Planner states
  const [activePlannerTab, setActivePlannerTab] = useState<"route" | "area" | "outings">("route");
  const [selectedLocality, setSelectedLocality] = useState("");
  const [areaTimeBudget, setAreaTimeBudget] = useState<"1" | "3" | "5">("3");
  const [areaPlanStops, setAreaPlanStops] = useState<Place[] | null>(null);
  const [areaPlanBudgetEstimate, setAreaPlanBudgetEstimate] = useState("");

  // Local Outings Planner states
  const [outingType, setOutingType] = useState<"friends" | "date" | "family" | "solo">("friends");
  const [outingVibe, setOutingVibe] = useState<"food" | "cafe" | "culture" | "nightlife">("food");
  const [outingTimeOfDay, setOutingTimeOfDay] = useState<"morning" | "evening" | "full">("evening");
  const [outingStops, setOutingStops] = useState<Place[] | null>(null);
  const [outingGenerating, setOutingGenerating] = useState(false);
  const [outingPreviewName, setOutingPreviewName] = useState("");
  const [liveEventSuggestions, setLiveEventSuggestions] = useState<LiveEvent[]>([]);
  const [hangoutSuggestions, setHangoutSuggestions] = useState<any[]>([]);

  // Unique localities helper
  const uniqueLocalities = useMemo(() => {
    const set = new Set<string>();
    allPlaces.forEach((p) => {
      if (p.locality) set.add(p.locality);
    });
    return Array.from(set).sort();
  }, [allPlaces]);

  // Initializing default widget values on places load
  useEffect(() => {
    if (allPlaces.length > 0 && !widgetStartPlaceId) {
      setWidgetStartPlaceId(allPlaces[0].id);
    }
  }, [allPlaces, widgetStartPlaceId]);

  // Sync active locality and clear previews when active city changes
  useEffect(() => {
    if (uniqueLocalities.length > 0) {
      setSelectedLocality(uniqueLocalities[0]);
    }
    setWidgetPreviewStops(null);
    setWidgetPreviewStats(null);
    setAreaPlanStops(null);
    setOutingStops(null);
  }, [activeCity, uniqueLocalities]);

  const filteredAutocompletePlaces = useMemo(() => {
    if (!widgetSearchQuery.trim()) {
      return allPlaces.slice(0, 10);
    }
    return allPlaces
      .filter(
        (p) =>
          p.title.toLowerCase().includes(widgetSearchQuery.toLowerCase()) ||
          p.locality.toLowerCase().includes(widgetSearchQuery.toLowerCase())
      )
      .slice(0, 10);
  }, [allPlaces, widgetSearchQuery]);

  const getThemeScore = (place: Place, theme: "mix" | "cafe" | "food" | "scenic") => {
    let score = 0;
    if (theme === "cafe") {
      if (place.category === "cafe") score += 10;
      if (place.category === "dessert" || place.category === "ice-cream") score += 5;
    } else if (theme === "food") {
      if (["restaurant", "street-food", "food-stall"].includes(place.category)) score += 10;
      if (["dessert", "ice-cream"].includes(place.category)) score += 5;
    } else if (theme === "scenic") {
      if (place.tags.some((t) => ["scenic", "viewpoint", "heritage", "walk", "nature", "park"].includes(t))) score += 10;
      if (place.category === "event") score += 5;
    }
    return score;
  };

  const handleGenerateTrail = async (
    startPlace: Place,
    customTimeBudget?: "1" | "3" | "5",
    customTheme?: "mix" | "cafe" | "food" | "scenic",
    isWidget?: boolean
  ) => {
    const activeGeneratingStateSetter = isWidget ? setWidgetGenerating : () => {};
    if (isWidget) setWidgetGenerating(true);

    try {
      const budget = customTimeBudget ?? widgetTimeBudget;
      const theme = customTheme ?? widgetTheme;
      const targetStops = budget === "1" ? 2 : budget === "5" ? 4 : 3;
      const maxRadius = budget === "1" ? 0.006 : budget === "5" ? 0.05 : 0.018;

      const isWithinRadius = (p: Place) => {
        const latDelta = p.latitude - startPlace.latitude;
        const lngDelta = p.longitude - startPlace.longitude;
        const distanceDeg = Math.hypot(latDelta, lngDelta);
        return distanceDeg <= maxRadius;
      };

      const sameCityPlaces = allPlaces.filter(
        (p) =>
          p.city.toLowerCase() === startPlace.city.toLowerCase() &&
          p.id !== startPlace.id &&
          isWithinRadius(p)
      );

      const categoryGroups: Record<string, Place[]> = {};
      sameCityPlaces.forEach((p) => {
        if (!categoryGroups[p.category]) categoryGroups[p.category] = [];
        categoryGroups[p.category].push(p);
      });

      const stops: Place[] = [startPlace];
      const categoriesUsed = new Set<string>([startPlace.category]);

      const availableCategories = Object.keys(categoryGroups).filter((c) => !categoriesUsed.has(c));

      if (theme !== "mix") {
        availableCategories.sort((a, b) => {
          const repA = categoryGroups[a][0];
          const repB = categoryGroups[b][0];
          return getThemeScore(repB, theme) - getThemeScore(repA, theme);
        });
      } else {
        availableCategories.sort(() => 0.5 - Math.random());
      }

      for (const cat of availableCategories) {
        if (stops.length >= targetStops) break;
        const group = categoryGroups[cat];
        const sortedByProximity = [...group].sort((a, b) => {
          const distA = Math.hypot(a.latitude - startPlace.latitude, a.longitude - startPlace.longitude);
          const distB = Math.hypot(b.latitude - startPlace.latitude, b.longitude - startPlace.longitude);
          return distA - distB;
        });

        if (sortedByProximity[0]) {
          stops.push(sortedByProximity[0]);
          categoriesUsed.add(cat);
        }
      }

      if (stops.length < targetStops) {
        const remaining = sameCityPlaces
          .filter((p) => !stops.some((s) => s.id === p.id))
          .sort((a, b) => {
            const distA = Math.hypot(a.latitude - startPlace.latitude, a.longitude - startPlace.longitude);
            const distB = Math.hypot(b.latitude - startPlace.latitude, b.longitude - startPlace.longitude);
            return distA - distB;
          });
        while (stops.length < targetStops && remaining.length > 0) {
          stops.push(remaining.shift()!);
        }
      }

      if (stops.length < targetStops) {
        const beyondRadiusPlaces = allPlaces
          .filter(
            (p) =>
              p.city.toLowerCase() === startPlace.city.toLowerCase() &&
              p.id !== startPlace.id &&
              !stops.some((s) => s.id === p.id)
          )
          .sort((a, b) => {
            const distA = Math.hypot(a.latitude - startPlace.latitude, a.longitude - startPlace.longitude);
            const distB = Math.hypot(b.latitude - startPlace.latitude, b.longitude - startPlace.longitude);
            return distA - distB;
          });
        while (stops.length < targetStops && beyondRadiusPlaces.length > 0) {
          stops.push(beyondRadiusPlaces.shift()!);
        }
      }

      if (stops.length < 2) {
        alert("Not enough places in this city to plan a trail!");
        activeGeneratingStateSetter(false);
        return;
      }

      const durationLabel = budget === "1" ? "1-Hour" : budget === "5" ? "5-Hour" : "2-3 Hour";
      const themeLabel =
        theme === "cafe" ? "Cafe Hop" : theme === "food" ? "Foodie" : theme === "scenic" ? "Scenic" : "Spontaneous";
      const trailName = `${themeLabel} ${durationLabel} ${startPlace.city} Walk`;

      if (isWidget) {
        const coordString = stops.map((s) => `${s.longitude},${s.latitude}`).join(";");
        const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${coordString}?overview=full&geometries=geojson`;
        let distanceKm = 0;
        let durationMinutes = 0;

        try {
          const res = await fetch(osrmUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.code === "Ok" && data.routes?.[0]) {
              const route = data.routes[0];
              distanceKm = parseFloat((route.distance / 1000).toFixed(1));
              durationMinutes = Math.round(route.duration / 60);
            }
          }
        } catch (err) {
          console.warn("OSRM routing preview failed", err);
        }

        if (distanceKm === 0) {
          distanceKm = budget === "1" ? 0.6 : budget === "5" ? 4.5 : 1.8;
          durationMinutes = budget === "1" ? 15 : budget === "5" ? 75 : 30;
        }

        setWidgetPreviewStops(stops);
        setWidgetPreviewStats({ distance: distanceKm, duration: durationMinutes });
        setWidgetPreviewName(trailName);
        activeGeneratingStateSetter(false);
        return;
      }
    } catch (error) {
      console.error("Failed to generate spontaneous trail:", error);
      alert("Something went wrong generating the trail. Opening the map instead.");
      router.push("/map");
    } finally {
      activeGeneratingStateSetter(false);
    }
  };

  const handleWidgetGenerateTrail = async () => {
    if (allPlaces.length === 0) {
      alert("No places available in this city to plan a trail.");
      return;
    }

    let startPlace: Place | null = null;
    if (widgetStartMode === "geo") {
      if (location) {
        let minD = Infinity;
        allPlaces.forEach((p) => {
          const d = Math.hypot(p.latitude - location.latitude, p.longitude - location.longitude);
          if (d < minD) {
            minD = d;
            startPlace = p;
          }
        });
      }
      if (!startPlace) {
        startPlace = allPlaces[Math.floor(Math.random() * allPlaces.length)];
      }
    } else if (widgetStartMode === "place") {
      startPlace = allPlaces.find((p) => p.id === widgetStartPlaceId) || null;
      if (!startPlace) {
        startPlace = allPlaces[0];
      }
    } else {
      const trending = allPlaces.filter((p) => p.isTrending || p.rating >= 4.5);
      const pool = trending.length > 0 ? trending : allPlaces;
      startPlace = pool[Math.floor(Math.random() * pool.length)];
    }

    if (!startPlace) {
      alert("Please select a starting spot first!");
      return;
    }

    await handleGenerateTrail(startPlace, widgetTimeBudget, widgetTheme, true);
  };

  const handleLaunchPreviewTrail = async () => {
    if (!widgetPreviewStops || widgetPreviewStops.length === 0) return;

    setWidgetGenerating(true);
    const stops = widgetPreviewStops;
    const trailName = widgetPreviewName;

    try {
      if (user) {
        const routePathCoords: { latitude: number; longitude: number }[] = [];
        const coordString = stops.map((s) => `${s.longitude},${s.latitude}`).join(";");
        const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${coordString}?overview=full&geometries=geojson`;
        let distanceKm = widgetPreviewStats?.distance ?? 0;
        let durationMinutes = widgetPreviewStats?.duration ?? 0;

        try {
          const res = await fetch(osrmUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.code === "Ok" && data.routes?.[0]) {
              const route = data.routes[0];
              distanceKm = parseFloat((route.distance / 1000).toFixed(1));
              durationMinutes = Math.round(route.duration / 60);
              route.geometry.coordinates.forEach(([lng, lat]: [number, number]) => {
                routePathCoords.push({ latitude: lat, longitude: lng });
              });
            }
          }
        } catch (err) {
          console.warn("OSRM routing failed, falling back to direct paths", err);
        }

        if (routePathCoords.length === 0) {
          stops.forEach((s) => {
            routePathCoords.push({ latitude: s.latitude, longitude: s.longitude });
          });
        }

        const payload = {
          name: trailName,
          source: stops[0].locality || stops[0].city,
          destination: stops[stops.length - 1].locality || stops[0].city,
          distanceKm,
          durationMinutes,
          routePath: routePathCoords,
          stops,
        };

        const saveRes = await fetch("/api/trip-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (saveRes.ok) {
          const data = await saveRes.json();
          if (data.plan?.id) {
            router.push(`/trip/${data.plan.id}`);
            return;
          }
        }
      }

      const stopIds = stops.map((s) => s.id).join(",");
      router.push(
        `/map?mode=trip&stops=${encodeURIComponent(stopIds)}&sourceName=${encodeURIComponent(
          stops[0].title
        )}&destName=${encodeURIComponent(stops[stops.length - 1].title)}&trailName=${encodeURIComponent(trailName)}`
      );
    } catch (err) {
      console.error("Failed to launch preview trail:", err);
      alert("Error opening map. Opening standard map view instead.");
      router.push("/map");
    } finally {
      setWidgetGenerating(false);
    }
  };

  const handleGenerateAreaPlan = () => {
    if (!selectedLocality) return;

    const localitySpots = allPlaces.filter(
      (p) =>
        p.city.toLowerCase() === activeCity.toLowerCase() &&
        p.locality.toLowerCase() === selectedLocality.toLowerCase()
    );

    let candidateSpots = [...localitySpots];
    if (candidateSpots.length < 3 && localitySpots.length > 0) {
      const centroidLat = localitySpots[0].latitude;
      const centroidLng = localitySpots[0].longitude;
      const otherSpots = allPlaces.filter((p) => {
        if (p.city.toLowerCase() !== activeCity.toLowerCase()) return false;
        if (p.locality.toLowerCase() === selectedLocality.toLowerCase()) return false;
        const d = Math.hypot(p.latitude - centroidLat, p.longitude - centroidLng);
        return d <= 0.025;
      });
      candidateSpots = [...candidateSpots, ...otherSpots];
    }

    if (candidateSpots.length === 0) {
      alert("No spots available near this area to build a plan.");
      return;
    }

    const freeSpots = candidateSpots.filter((p) => p.priceRange === "Free" || p.tags.includes("free"));
    const paidSpots = candidateSpots.filter((p) => p.priceRange !== "Free" && !p.tags.includes("free"));

    const targetCount = areaTimeBudget === "1" ? 2 : areaTimeBudget === "5" ? 4 : 3;
    const planStops: Place[] = [];

    const sortedFree = [...freeSpots].sort((a, b) => b.rating - a.rating);
    const sortedPaid = [...paidSpots].sort((a, b) => b.rating - a.rating);

    for (let i = 0; i < targetCount; i++) {
      if (i % 2 === 0) {
        if (sortedFree.length > 0) {
          planStops.push(sortedFree.shift()!);
        } else if (sortedPaid.length > 0) {
          planStops.push(sortedPaid.shift()!);
        }
      } else {
        if (sortedPaid.length > 0) {
          planStops.push(sortedPaid.shift()!);
        } else if (sortedFree.length > 0) {
          planStops.push(sortedFree.shift()!);
        }
      }
    }

    if (planStops.length === 0) {
      alert("Unable to generate plan. Please try another area.");
      return;
    }

    let minCost = 0;
    let maxCost = 0;
    planStops.forEach((p) => {
      if (p.priceRange === "$$") {
        minCost += 200;
        maxCost += 500;
      } else if (p.priceRange === "$$$") {
        minCost += 500;
        maxCost += 1200;
      } else if (p.priceRange === "$") {
        minCost += 50;
        maxCost += 150;
      }
    });

    const budgetText = minCost === 0 ? "Free Entrance Only" : `₹${minCost} - ₹${maxCost} per person`;
    setAreaPlanStops(planStops);
    setAreaPlanBudgetEstimate(budgetText);
  };

  const handleLaunchAreaPlan = () => {
    if (!areaPlanStops || areaPlanStops.length === 0) return;
    const stopIds = areaPlanStops.map((s) => s.id).join(",");
    const trailName = `${selectedLocality} ${
      areaTimeBudget === "1" ? "1-Hour" : areaTimeBudget === "5" ? "5-Hour" : "3-Hour"
    } Plan`;
    router.push(
      `/map?mode=trip&stops=${encodeURIComponent(stopIds)}&sourceName=${encodeURIComponent(
        areaPlanStops[0].title
      )}&destName=${encodeURIComponent(areaPlanStops[areaPlanStops.length - 1].title)}&trailName=${encodeURIComponent(
        trailName
      )}`
    );
  };

  const handleGenerateLocalOuting = async () => {
    if (allPlaces.length === 0) {
      alert("No places available in this city to plan an outing.");
      return;
    }
    setOutingGenerating(true);
    setOutingStops(null);
    setLiveEventSuggestions([]);
    setHangoutSuggestions([]);

    try {
      const targetCount = outingTimeOfDay === "full" ? 4 : 3;
      const cityPlaces = allPlaces.filter((p) => p.city.toLowerCase() === activeCity.toLowerCase());

      if (cityPlaces.length === 0) {
        alert("No places found for the active city.");
        setOutingGenerating(false);
        return;
      }

      let filterFn = (p: Place) => true;
      if (outingVibe === "food") {
        filterFn = (p: Place) => ["restaurant", "food-stall", "street-food", "dessert", "ice-cream"].includes(p.category);
      } else if (outingVibe === "cafe") {
        filterFn = (p: Place) => ["cafe", "dessert", "ice-cream"].includes(p.category);
      } else if (outingVibe === "culture") {
        filterFn = (p: Place) =>
          p.tags.some((t) => ["cultural", "heritage", "museum", "scenic", "nature", "park", "tourist-friendly"].includes(t.toLowerCase())) ||
          p.category === "event";
      } else if (outingVibe === "nightlife") {
        filterFn = (p: Place) => ["bar", "nightlife"].includes(p.category) || p.tags.some((t) => ["night-drive", "late-night"].includes(t.toLowerCase()));
      }

      let candidates = cityPlaces.filter(filterFn);
      if (candidates.length < targetCount) {
        candidates = [...cityPlaces];
      }

      if (outingType === "family") {
        const familyFriendly = candidates.filter((p) =>
          p.tags.some((t) => ["family-friendly", "family", "kids", "kids-friendly"].includes(t.toLowerCase()))
        );
        if (familyFriendly.length >= targetCount) candidates = familyFriendly;
      } else if (outingType === "date") {
        const romantic = candidates.filter(
          (p) => p.rating >= 4.4 || p.tags.some((t) => ["romantic", "cozy", "scenic", "view"].includes(t.toLowerCase()))
        );
        if (romantic.length >= targetCount) candidates = romantic;
      } else if (outingType === "friends") {
        const groupSpots = candidates.filter((p) =>
          p.tags.some((t) => ["group", "friends", "casual", "hangout"].includes(t.toLowerCase()))
        );
        if (groupSpots.length >= targetCount) candidates = groupSpots;
      }

      candidates.sort(() => 0.5 - Math.random());

      const chosenStops: Place[] = [];
      const usedCategories = new Set<string>();

      for (const p of candidates) {
        if (chosenStops.length >= targetCount) break;
        if (candidates.length >= targetCount * 2 && usedCategories.has(p.category)) {
          continue;
        }
        chosenStops.push(p);
        usedCategories.add(p.category);
      }

      if (chosenStops.length < targetCount) {
        const remaining = candidates.filter((p) => !chosenStops.some((s) => s.id === p.id));
        for (const p of remaining) {
          if (chosenStops.length >= targetCount) break;
          chosenStops.push(p);
        }
      }

      chosenStops.sort((a, b) => {
        const score = (category: string) => {
          if (["cafe", "dessert"].includes(category)) return 1;
          if (["event", "street-food", "food-stall"].includes(category)) return 2;
          if (["restaurant"].includes(category)) return 3;
          if (["bar", "nightlife"].includes(category)) return 4;
          return 5;
        };
        return score(a.category) - score(b.category);
      });

      const typeLabel =
        outingType === "friends"
          ? "Friends Outing"
          : outingType === "date"
          ? "Date Night Outing"
          : outingType === "family"
          ? "Family Outing"
          : "Solo Outing";
      const vibeLabel =
        outingVibe === "food"
          ? "Foodie Trail"
          : outingVibe === "cafe"
          ? "Cafe Hop"
          : outingVibe === "culture"
          ? "Heritage & Arts"
          : "Nightlife Crawl";
      const name = `${vibeLabel} for a ${typeLabel} (${
        outingTimeOfDay === "full" ? "Full Day" : outingTimeOfDay === "morning" ? "Day Out" : "Evening Out"
      })`;
      setOutingStops(chosenStops);
      setOutingPreviewName(name);

      try {
        const eventsRes = await fetch(`/api/events/live?city=${encodeURIComponent(activeCity)}`);
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          const eventsList: LiveEvent[] = eventsData.events ?? [];
          const matchedEvents = eventsList.filter((evt) => {
            if (outingTimeOfDay === "evening") {
              const hour = parseInt(evt.time.split(":")[0]);
              if (isNaN(hour) || hour < 16) return false;
            }
            if (outingVibe === "nightlife") {
              return ["music", "nightlife", "comedy"].includes(evt.category);
            }
            if (outingVibe === "culture") {
              return ["cultural", "theatre", "workshop"].includes(evt.category);
            }
            return true;
          });
          setLiveEventSuggestions(matchedEvents.slice(0, 2));
        }

        const hangoutsRes = await fetch(`/api/hangouts?city=${encodeURIComponent(activeCity)}`);
        if (hangoutsRes.ok) {
          const hangoutsData = await hangoutsRes.json();
          const hangoutsList = hangoutsData.hangouts ?? [];
          const stopsLocalities = chosenStops.map((s) => s.locality.toLowerCase());
          const matchedHangouts = hangoutsList.filter((h: any) => {
            return stopsLocalities.some(
              (loc) => h.placeTitle.toLowerCase().includes(loc) || h.description.toLowerCase().includes(loc)
            );
          });
          setHangoutSuggestions(matchedHangouts.slice(0, 2));
        }
      } catch (err) {
        console.warn("Failed to fetch live suggestions for outing planner:", err);
      }
    } catch (e) {
      console.error(e);
      alert("Something went wrong generating the outing.");
    } finally {
      setOutingGenerating(false);
    }
  };

  const handleLaunchOuting = () => {
    if (!outingStops || outingStops.length === 0) return;
    const stopIds = outingStops.map((s) => s.id).join(",");
    router.push(
      `/map?mode=trip&stops=${encodeURIComponent(stopIds)}&sourceName=${encodeURIComponent(
        outingStops[0].title
      )}&destName=${encodeURIComponent(outingStops[outingStops.length - 1].title)}&trailName=${encodeURIComponent(
        outingPreviewName
      )}`
    );
  };

  const handleSaveOuting = async () => {
    if (!outingStops || outingStops.length === 0) return;
    if (!user) {
      alert("Please log in to save your outings!");
      router.push("/profile");
      return;
    }

    try {
      const routePathCoords: { latitude: number; longitude: number }[] = [];
      outingStops.forEach((s) => {
        routePathCoords.push({ latitude: s.latitude, longitude: s.longitude });
      });

      const payload = {
        name: outingPreviewName,
        source: outingStops[0].locality || activeCity,
        destination: outingStops[outingStops.length - 1].locality || activeCity,
        distanceKm: outingTimeOfDay === "full" ? 6 : 3,
        durationMinutes: outingTimeOfDay === "full" ? 180 : 90,
        routePath: routePathCoords,
        stops: outingStops,
      };

      const saveRes = await fetch("/api/trip-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (saveRes.ok) {
        const data = await saveRes.json();
        if (data.plan?.id) {
          alert("🎉 Outing successfully saved to your profile!");
          router.push(`/trip/${data.plan.id}`);
        } else {
          alert("Saved, but failed to retrieve itinerary ID.");
        }
      } else {
        alert("Failed to save outing plan.");
      }
    } catch (error) {
      console.error("Failed to save outing:", error);
      alert("Error saving your outing.");
    }
  };

  const themeGlowClass =
    widgetTheme === "cafe"
      ? "shadow-amber-500/10 border-amber-550"
      : widgetTheme === "food"
      ? "shadow-rose-500/10 border-rose-550"
      : widgetTheme === "scenic"
      ? "shadow-emerald-500/10 border-emerald-550"
      : "shadow-teal-500/10 border-teal-550";

  const themeIconBg =
    widgetTheme === "cafe"
      ? "bg-amber-500/10 text-amber-400"
      : widgetTheme === "food"
      ? "bg-rose-500/10 text-rose-400"
      : widgetTheme === "scenic"
      ? "bg-emerald-500/10 text-emerald-400"
      : "bg-teal-500/10 text-teal-400";

  return (
    <div
      className={`app-surface rounded-lg p-5 border transition-all duration-300 bg-[var(--panel-soft)] relative overflow-hidden group shadow-lg ${themeGlowClass}`}
    >
      <div className="absolute top-0 right-0 h-40 w-40 bg-teal-500/10 rounded-full blur-3xl pointer-events-none transition duration-500 group-hover:bg-teal-500/15" />
      <div className="absolute bottom-0 left-0 h-40 w-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none transition duration-500 group-hover:bg-cyan-500/15" />

      <div className="flex items-center gap-2.5 mb-4 relative z-10">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-300 ${themeIconBg}`}>
          <Compass size={18} className="animate-pulse" />
        </div>
        <div className="text-left">
          <h3 className="text-base font-black text-[var(--foreground)]">Spontaneous City Planner</h3>
          <p className="text-[11px] font-semibold text-[var(--muted)]">Plan routes or explore local hubs within your time budget</p>
        </div>
      </div>

      <div className="flex border-b border-white/5 mb-4 relative z-10">
        <button
          type="button"
          onClick={() => {
            setActivePlannerTab("route");
            setWidgetPreviewStops(null);
            setWidgetPreviewStats(null);
          }}
          className={`flex-1 pb-2.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition duration-205 cursor-pointer ${
            activePlannerTab === "route"
              ? "border-teal-400 text-teal-300 font-black"
              : "border-transparent text-[var(--muted)] hover:text-slate-200"
          }`}
        >
          🗺️ Route Path
        </button>
        <button
          type="button"
          onClick={() => {
            setActivePlannerTab("area");
            setAreaPlanStops(null);
          }}
          className={`flex-1 pb-2.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition duration-205 cursor-pointer ${
            activePlannerTab === "area"
              ? "border-teal-400 text-teal-300 font-black"
              : "border-transparent text-[var(--muted)] hover:text-slate-200"
          }`}
        >
          ⏱️ Area Layover
        </button>
        <button
          type="button"
          onClick={() => {
            setActivePlannerTab("outings");
            setOutingStops(null);
            setLiveEventSuggestions([]);
            setHangoutSuggestions([]);
          }}
          className={`flex-1 pb-2.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition duration-205 cursor-pointer ${
            activePlannerTab === "outings"
              ? "border-teal-400 text-teal-300 font-black"
              : "border-transparent text-[var(--muted)] hover:text-slate-200"
          }`}
        >
          🎉 Local Outing
        </button>
      </div>

      <div className="space-y-4 relative z-10">
        {activePlannerTab === "route" && (
          <div className="space-y-4 animate-fade-in text-left">
            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                1. Starting Point
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1 mb-2">
                {[
                  { id: "random", label: "Random Spot" },
                  { id: "geo", label: "My Location" },
                  { id: "place", label: "Select Spot" },
                ].map((mode) => {
                  const active = widgetStartMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        setWidgetStartMode(mode.id as any);
                        setWidgetPreviewStops(null);
                        setWidgetPreviewStats(null);
                      }}
                      className={`rounded-lg py-1.5 px-1 sm:px-2 text-[10px] sm:text-[11px] font-black transition duration-205 cursor-pointer text-center truncate ${
                        active ? "bg-teal-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              {widgetStartMode === "place" && (
                <div className="relative z-30 animate-fade-in">
                  <input
                    type="text"
                    placeholder="Type a spot name (e.g. Zen Cafe)..."
                    value={widgetSearchQuery}
                    onChange={(e) => {
                      setWidgetSearchQuery(e.target.value);
                      setWidgetSearchFocused(true);
                    }}
                    onFocus={() => setWidgetSearchFocused(true)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3.5 py-2.5 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-teal-300"
                  />
                  {widgetSearchFocused && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setWidgetSearchFocused(false)} />
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl z-20 no-scrollbar divide-y divide-white/5">
                        {filteredAutocompletePlaces.length > 0 ? (
                          filteredAutocompletePlaces.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setWidgetStartPlaceId(p.id);
                                setWidgetSearchQuery(p.title);
                                setWidgetSearchFocused(false);
                                setWidgetPreviewStops(null);
                                setWidgetPreviewStats(null);
                              }}
                              className="w-full text-left px-3.5 py-2.5 text-xs font-semibold hover:bg-white/5 transition duration-150 flex items-center justify-between cursor-pointer"
                            >
                              <div className="text-left">
                                <span className="block font-black text-white">{p.title}</span>
                                <span className="block text-[10px] text-slate-400 font-medium">{p.locality}</span>
                              </div>
                              <span className="text-[9px] font-black text-teal-400 bg-teal-400/10 px-1.5 py-0.5 rounded">
                                {getCategoryLabel(p.category)}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3.5 py-3 text-xs text-[var(--muted-strong)] font-semibold italic text-center">
                            No matching spots found in this city.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {widgetStartMode === "geo" && !location && (
                <p className="text-[10px] text-amber-300 font-semibold mt-1">
                  ⚠️ GPS location not available. We will use a random popular spot as fallback.
                </p>
              )}
            </div>

            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                2. Choose Itinerary Vibe
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "mix", label: "🎲 Surprise Mix" },
                  { id: "cafe", label: "☕ Cafe Hop" },
                  { id: "food", label: "🍔 Foodie Tour" },
                  { id: "scenic", label: "🌿 Scenic & Chill" },
                ].map((theme) => {
                  const active = widgetTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        setWidgetTheme(theme.id as any);
                        setWidgetPreviewStops(null);
                        setWidgetPreviewStats(null);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-black transition border cursor-pointer ${
                        active
                          ? "bg-teal-400 text-slate-950 border-teal-400 shadow-sm"
                          : "bg-[var(--panel)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--panel-strong)] hover:text-white"
                      }`}
                    >
                      {theme.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                3. Select Available Time
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1">
                {[
                  { id: "1", label: "1 Hour", desc: "2 close spots" },
                  { id: "3", label: "2-3 Hours", desc: "3 spots" },
                  { id: "5", label: "5+ Hours", desc: "4 wide exploration" },
                ].map((t) => {
                  const active = widgetTimeBudget === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setWidgetTimeBudget(t.id as any);
                        setWidgetPreviewStops(null);
                        setWidgetPreviewStats(null);
                      }}
                      className={`flex flex-col items-center justify-center rounded-lg py-2 px-1 transition duration-205 cursor-pointer ${
                        active ? "bg-teal-400 text-slate-950 shadow-md font-black" : "text-slate-400 hover:text-white font-semibold"
                      }`}
                    >
                      <span className="text-xs">{t.label}</span>
                      <span className={`text-[9px] ${active ? "text-slate-800" : "text-slate-500"}`}>{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!widgetPreviewStops && (
              <button
                type="button"
                disabled={widgetGenerating}
                onClick={handleWidgetGenerateTrail}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 py-3 font-black text-slate-950 transition hover:bg-teal-350 disabled:opacity-50 active:scale-98 cursor-pointer shadow-lg shadow-teal-500/20 text-xs sm:text-sm"
              >
                {widgetGenerating ? "Mapping Trail..." : "Map Out My Spontaneous Trail 🗺️"}
              </button>
            )}

            {widgetPreviewStops && widgetPreviewStops.length > 0 && (
              <div className="mt-4 p-3 bg-slate-950/70 border border-white/5 rounded-lg animate-slide-down text-left">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-teal-300">Itinerary Preview</span>
                  {widgetPreviewStats && (
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      🚶 Walk: {widgetPreviewStats.distance} km · {widgetPreviewStats.duration} mins
                    </span>
                  )}
                </div>

                <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-2 mb-3.5 scroll-fade-right">
                  {widgetPreviewStops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      onClick={() => setSelectedPlace(stop)}
                      className="w-40 shrink-0 bg-slate-900 border border-white/5 hover:border-teal-400/40 p-2.5 rounded-lg transition duration-200 cursor-pointer select-none group/stop"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-black bg-teal-400/10 text-teal-400 px-1.5 py-0.5 rounded-full">
                          Stop {idx + 1}
                        </span>
                        <span className="text-[8px] font-semibold text-slate-500 uppercase">{getCategoryLabel(stop.category)}</span>
                      </div>
                      <h4 className="text-[11px] font-black text-white line-clamp-1 group-hover/stop:text-teal-300 transition duration-150">
                        {stop.title}
                      </h4>
                      <p className="text-[9px] text-slate-400 line-clamp-1 mt-0.5">{stop.locality || stop.city}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleLaunchPreviewTrail}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-400 py-2.5 text-xs font-black text-slate-950 transition hover:bg-teal-350 active:scale-98 cursor-pointer"
                  >
                    Launch Map 🚀
                  </button>
                  <button
                    type="button"
                    onClick={handleWidgetGenerateTrail}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2.5 text-xs font-black text-white hover:bg-white/10 active:scale-98 cursor-pointer"
                  >
                    Re-roll Trail 🎲
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activePlannerTab === "area" && (
          <div className="space-y-4 animate-fade-in text-left">
            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                1. Select Locality / Area
              </span>
              <select
                value={selectedLocality}
                onChange={(e) => {
                  setSelectedLocality(e.target.value);
                  setAreaPlanStops(null);
                }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3.5 py-2.5 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-teal-300 cursor-pointer"
              >
                {uniqueLocalities.length > 0 ? (
                  uniqueLocalities.map((loc) => (
                    <option key={loc} value={loc} className="bg-slate-950 text-white">
                      {loc}
                    </option>
                  ))
                ) : (
                  <option value="" disabled className="bg-slate-950 text-slate-500">
                    No localities available
                  </option>
                )}
              </select>
            </div>

            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">2. Available Time</span>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1">
                {[
                  { id: "1", label: "1 Hour", desc: "2 spots" },
                  { id: "3", label: "2-3 Hours", desc: "3 spots" },
                  { id: "5", label: "5+ Hours", desc: "4 spots" },
                ].map((t) => {
                  const active = areaTimeBudget === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setAreaTimeBudget(t.id as any);
                        setAreaPlanStops(null);
                      }}
                      className={`flex flex-col items-center justify-center rounded-lg py-2 px-1 transition duration-205 cursor-pointer ${
                        active ? "bg-teal-400 text-slate-950 shadow-md font-black" : "text-slate-400 hover:text-white font-semibold"
                      }`}
                    >
                      <span className="text-xs">{t.label}</span>
                      <span className={`text-[9px] ${active ? "text-slate-800" : "text-slate-500"}`}>{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!areaPlanStops && (
              <button
                type="button"
                onClick={handleGenerateAreaPlan}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 py-3 font-black text-slate-950 transition hover:bg-teal-350 active:scale-98 cursor-pointer shadow-lg shadow-teal-500/20 text-xs sm:text-sm"
              >
                Generate Area Plan ⏱️
              </button>
            )}

            {areaPlanStops && areaPlanStops.length > 0 && (
              <div className="mt-4 p-3 bg-slate-950/70 border border-white/5 rounded-lg animate-slide-down text-left">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-teal-300">{selectedLocality} Area Plan</span>
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                    Budget: {areaPlanBudgetEstimate}
                  </span>
                </div>

                <div className="relative pl-4 border-l border-white/10 space-y-4 mb-4">
                  {areaPlanStops.map((stop, idx) => {
                    const isFree = stop.priceRange === "Free" || stop.tags.includes("free");
                    return (
                      <div
                        key={stop.id}
                        onClick={() => setSelectedPlace(stop)}
                        className="relative cursor-pointer group/timeline select-none"
                      >
                        <span className="absolute -left-[20.5px] top-1 h-3 w-3 rounded-full border border-teal-400 bg-slate-950 ring-4 ring-slate-950 flex items-center justify-center text-[7px] font-black text-teal-300">
                          {idx + 1}
                        </span>
                        <div className="pl-1 text-left">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[12px] font-black text-white group-hover/timeline:text-teal-300 transition duration-150 line-clamp-1">
                              {stop.title}
                            </h4>
                            <span
                              className={`text-[8px] font-black uppercase px-1 rounded ${
                                isFree ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"
                              }`}
                            >
                              {isFree ? "Free" : "Paid"}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>{getCategoryLabel(stop.category)}</span>
                            <span>·</span>
                            {stop.rating && <span className="text-yellow-400 font-bold">★ {stop.rating}</span>}
                            <span>·</span>
                            <span className="font-semibold text-slate-500">{stop.priceRange || "$$"}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleLaunchAreaPlan}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-400 py-2.5 text-xs font-black text-slate-950 transition hover:bg-teal-350 active:scale-98 cursor-pointer"
                  >
                    Launch Map 🚀
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateAreaPlan}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2.5 text-xs font-black text-white hover:bg-white/10 active:scale-98 cursor-pointer"
                  >
                    Re-generate 🔄
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activePlannerTab === "outings" && (
          <div className="space-y-4 animate-fade-in text-left">
            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                1. Outing Partner / Group
              </span>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1">
                {[
                  { id: "friends", label: "👥 Friends" },
                  { id: "date", label: "👩‍❤️‍👨 Date" },
                  { id: "family", label: "👨‍👩‍👧 Family" },
                  { id: "solo", label: "🎒 Solo" },
                ].map((t) => {
                  const active = outingType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setOutingType(t.id as any);
                        setOutingStops(null);
                      }}
                      className={`rounded-lg py-2 px-1 text-[10px] text-center font-black transition duration-200 cursor-pointer truncate ${
                        active ? "bg-teal-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                2. Outing Vibe / Theme
              </span>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1">
                {[
                  { id: "food", label: "🍔 Foodie" },
                  { id: "cafe", label: "☕ Cafe Hop" },
                  { id: "culture", label: "🏛️ Culture" },
                  { id: "nightlife", label: "🍷 Night" },
                ].map((v) => {
                  const active = outingVibe === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setOutingVibe(v.id as any);
                        setOutingStops(null);
                      }}
                      className={`rounded-lg py-2 px-1 text-[10px] text-center font-black transition duration-200 cursor-pointer truncate ${
                        active ? "bg-teal-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                3. Available Outing Hours
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1">
                {[
                  { id: "morning", label: "☀️ Day Out", desc: "3 spots" },
                  { id: "evening", label: "🌇 Evening Out", desc: "3 stops" },
                  { id: "full", label: "⏳ Full Day", desc: "4 stops" },
                ].map((time) => {
                  const active = outingTimeOfDay === time.id;
                  return (
                    <button
                      key={time.id}
                      type="button"
                      onClick={() => {
                        setOutingTimeOfDay(time.id as any);
                        setOutingStops(null);
                      }}
                      className={`flex flex-col items-center justify-center rounded-lg py-1.5 px-1 transition duration-205 cursor-pointer ${
                        active ? "bg-teal-400 text-slate-950 shadow-md font-black" : "text-slate-400 hover:text-white font-semibold"
                      }`}
                    >
                      <span className="text-xs">{time.label}</span>
                      <span className={`text-[9px] ${active ? "text-slate-800" : "text-slate-500"}`}>{time.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!outingStops && (
              <button
                type="button"
                disabled={outingGenerating}
                onClick={handleGenerateLocalOuting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 py-3 font-black text-slate-950 transition hover:bg-teal-350 disabled:opacity-50 active:scale-98 cursor-pointer shadow-lg shadow-teal-500/20 text-xs sm:text-sm"
              >
                {outingGenerating ? "Crafting Outing..." : "Plan Local Outing 🚀"}
              </button>
            )}

            {outingStops && outingStops.length > 0 && (
              <div className="mt-4 p-3 bg-slate-950/70 border border-white/5 rounded-lg animate-slide-down text-left space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-teal-300">{outingPreviewName}</span>
                </div>

                <div className="relative pl-4 border-l border-white/10 space-y-4">
                  {outingStops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      onClick={() => setSelectedPlace(stop)}
                      className="relative cursor-pointer group/timeline select-none"
                    >
                      <span className="absolute -left-[20.5px] top-1 h-3 w-3 rounded-full border border-teal-400 bg-slate-950 ring-4 ring-slate-950 flex items-center justify-center text-[7px] font-black text-teal-300">
                        {idx + 1}
                      </span>
                      <div className="pl-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[12px] font-black text-white group-hover/timeline:text-teal-300 transition duration-150 line-clamp-1">
                            {stop.title}
                          </h4>
                          <span className="text-[8px] font-black uppercase px-1 rounded bg-teal-400/10 text-teal-400">
                            {getCategoryLabel(stop.category)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{stop.locality}</span>
                          <span>·</span>
                          <span className="text-yellow-400 font-bold">★ {stop.rating}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {(liveEventSuggestions.length > 0 || hangoutSuggestions.length > 0) && (
                  <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-rose-400">
                      🔥 Nearby Live Enhancements
                    </span>

                    {liveEventSuggestions.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={() => router.push(`/events?city=${encodeURIComponent(activeCity)}`)}
                        className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 p-2 rounded-lg cursor-pointer transition"
                      >
                        <span className="text-xs">🎭</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-rose-200 line-clamp-1">{evt.title}</p>
                          <p className="text-[9px] text-slate-400">
                            {evt.locality} · {evt.time} today
                          </p>
                        </div>
                      </div>
                    ))}

                    {hangoutSuggestions.map((h) => (
                      <div
                        key={h.id}
                        onClick={() => router.push(`/hangouts`)}
                        className="flex items-center gap-2 bg-teal-500/10 hover:bg-teal-500/15 border border-teal-500/20 p-2 rounded-lg cursor-pointer transition"
                      >
                        <span className="text-xs">👥</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-teal-200 line-clamp-1">{h.title}</p>
                          <p className="text-[9px] text-slate-400">
                            At {h.placeTitle} · Organized by {h.userFullName}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 pt-2">
                  <button
                    type="button"
                    onClick={handleLaunchOuting}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-400 py-2.5 text-xs font-black text-slate-950 transition hover:bg-teal-350 active:scale-98 cursor-pointer"
                    title="Launch Route Map"
                  >
                    Go 🚀
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveOuting}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2.5 text-xs font-black text-white hover:bg-white/10 active:scale-98 cursor-pointer"
                    title="Save to profile"
                  >
                    Save 💾
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const stopsText = outingStops
                        .map((s, idx) => `${idx + 1}️⃣ ${s.title} (${getCategoryLabel(s.category)} in ${s.locality})`)
                        .join("\n");
                      const inviteText = `Hey explorers! 🚀 Let's plan a local outing in ${activeCity}!\n\n📋 *ITINERARY:* \n${stopsText}\n\nJoin and view map route here:\n${
                        window.location.origin
                      }/map?mode=trip&stops=${encodeURIComponent(outingStops.map((s) => s.id).join(","))}&trailName=${encodeURIComponent(
                        outingPreviewName
                      )}\n\nLet's go! 💨`;
                      navigator.clipboard.writeText(inviteText);
                      alert("WhatsApp invite text copied to clipboard! Paste it to your chat group. 📲");
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2.5 text-xs font-black text-white hover:bg-white/10 active:scale-98 cursor-pointer"
                    title="Share WhatsApp Invite"
                  >
                    Invite 📱
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateLocalOuting}
                  className="w-full text-center text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wider transition"
                >
                  🎲 Re-roll Outing
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
