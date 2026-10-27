// How two browsers find a path to each other (WebRTC ICE servers).
//
// STUN lets each browser learn its public address, which is enough on most
// home networks. Some networks (strict firewalls, some mobile or school
// networks) block direct connections; then a TURN server has to relay the
// traffic. Metered's free Open Relay gives a small free TURN allowance.
//
// To add one (see README, "If your friend can't connect"):
//   1. Sign up free at https://www.metered.ca/tools/openrelay/ and create an app.
//   2. Put the app's name and its API key below, commit and push.
// Left empty, the game uses STUN only.

export const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// Optional: Metered Open Relay TURN (free tier). Both empty = not used.
export const METERED_TURN = {
  app: '',      // e.g. 'pokemon-legends' (from https://pokemon-legends.metered.live)
  apiKey: '',   // the app's TURN API key
};

// The ICE servers to use: STUN, plus TURN when a Metered key is set (its
// credentials are fetched fresh each time). A failed fetch falls back to STUN.
export async function iceServers(fetcher = globalThis.fetch) {
  const { app, apiKey } = METERED_TURN;
  if (!app || !apiKey || !fetcher) return STUN_SERVERS;
  try {
    const res = await fetcher(`https://${app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const turn = await res.json();
    return [...STUN_SERVERS, ...(Array.isArray(turn) ? turn : [])];
  } catch (err) {
    console.warn('TURN credentials not loaded; using STUN only.', err);
    return STUN_SERVERS;
  }
}
