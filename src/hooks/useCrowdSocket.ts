"use client";

/**
 * Singleton socket connection for crowd-update events.
 * All DiscoveryCard instances share ONE socket connection
 * instead of each opening their own. Listeners subscribe by placeId.
 */

import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "@/lib/utils";
import { CrowdSummary } from "@/types";

type Listener = (summary: CrowdSummary) => void;

let socket: Socket | null = null;
const listeners = new Map<string, Set<Listener>>();
const joinedRooms = new Set<string>();

function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { withCredentials: true });
    socket.on(
      "crowd-update",
      (data: { placeId: string; summary: CrowdSummary }) => {
        const fns = listeners.get(data.placeId);
        if (fns) {
          fns.forEach((fn) => fn(data.summary));
        }
      }
    );
  }
  return socket;
}

export function useCrowdSocket(
  placeId: string,
  onUpdate: (summary: CrowdSummary) => void
) {
  useEffect(() => {
    const s = getSocket();

    // Add listener
    if (!listeners.has(placeId)) {
      listeners.set(placeId, new Set());
    }
    listeners.get(placeId)!.add(onUpdate);

    // Join room only once per placeId
    if (!joinedRooms.has(placeId)) {
      s.emit("join-place", placeId);
      joinedRooms.add(placeId);
    }

    return () => {
      const fns = listeners.get(placeId);
      if (fns) {
        fns.delete(onUpdate);
        // Only leave the room when the last listener unsubscribes
        if (fns.size === 0) {
          listeners.delete(placeId);
          joinedRooms.delete(placeId);
          s.emit("leave-place", placeId);
        }
      }
    };
  }, [placeId, onUpdate]);
}
