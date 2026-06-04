// test-fetch-live-events.js
import { fetchLiveTownEvents } from "./src/lib/town-events";
(async () => {
  const events = await fetchLiveTownEvents("Pune");
  console.log("Fetched events count:", events.length);
  console.log(events.slice(0, 3)); // show first 3
})();
