# Vendored libraries

Copied here so the game loads nothing from a CDN at runtime (no build step, no npm at runtime).

| File | Library | Version | Licence | Source |
|---|---|---|---|---|
| `peerjs-1.5.5.min.js` | PeerJS (browser build, `dist/peerjs.min.js`; source-map comment removed) | 1.5.5 | MIT, `peerjs-LICENSE.txt` | https://www.npmjs.com/package/peerjs/v/1.5.5 |

Loaded only when playing a friend online (`src/net/peer.js`); it sets `window.Peer`.
