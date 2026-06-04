// src/types/event.ts

import { Place } from "./index";

/**
 * Event type mirrors the Place interface for event data fetched from Townscript.
 * This alias allows future extensions without altering existing Place typings.
 */
export type Event = Place;
