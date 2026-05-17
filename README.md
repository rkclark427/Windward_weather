# Windward Weather

A clean, fast weather dashboard built on NOAA/NWS data. No ads, no tracking, no nonsense.

![NOAA Data](https://img.shields.io/badge/data-NOAA%2FNWS-0E2233)
![License](https://img.shields.io/badge/license-MIT-blue)

## Why

Every weather app is bloated with ads, "feels like" indexes, pollen counts, engagement tricks, and auto-playing video. The actual weather data — sourced free from NOAA — gets buried under the noise.

Windward Weather strips all of that away. It shows you what matters: current conditions, wind, pressure, the next 24 hours, a 7-day outlook, animated radar, and (in marine mode) tides. That's it.

Built for sailors and anyone else who makes real decisions based on weather.

## Features

- **Current conditions** — temperature, wind speed/direction/gusts, barometric pressure, humidity, visibility, dewpoint
- **Hourly forecast** — next 24 hours with temperature, wind, and precipitation probability
- **7-day outlook** — high/low temps, wind range with direction, conditions summary
- **Animated radar** — RainViewer NEXRAD-style radar with past frames and short-range nowcast; scrubable timeline, play/pause, opacity control
- **Active NWS alerts** — prominent but not obnoxious, expandable for full text
- **Shore / Marine toggle:**
  - Shore mode: wind in mph, pressure in inHg
  - Marine mode: wind in knots, pressure in millibars (hPa), tide predictions
- **Tide predictions (marine mode)** — nearest NOAA CO-OPS tide station within 150 miles; next 4 hi/lo events with height in feet and local time; tied to the actively displayed location, not the device's GPS
- **Location handling** — browser geolocation, IP-based fallback, manual search (OpenStreetMap/Nominatim), saved favorites via localStorage
- **Sunrise / sunset** — calculated locally, no extra API call
- **Responsive** — works on desktop and mobile
- **Zero dependencies on paid services** — all data sources are free and public

## Data Sources

| Data | Source | Cost |
|------|--------|------|
| Forecasts & observations | [NWS API](https://api.weather.gov) (NOAA) | Free, no key |
| Tide predictions | [NOAA CO-OPS Tides & Currents](https://api.tidesandcurrents.noaa.gov) | Free, no key |
| Radar | [RainViewer](https://www.rainviewer.com/api.html) | Free, no key |
| Geocoding & search | [Nominatim](https://nominatim.openstreetmap.org) (OpenStreetMap) | Free, no key |
| IP-based location fallback | [ipapi.co](https://ipapi.co) | Free tier (1k/day) |

## Limitations

- **US coverage only (v1).** The NWS API covers the US and territories. Locations outside the US return a clear error message. Open-Meteo international fallback is planned for v2.
- **Marine view is partial in v1.** It changes units (knots, millibars), shows tide predictions, and reweights the visual hierarchy, but doesn't yet pull NWS marine zone forecasts (wave heights, seas, mariner-specific narratives).
- **Great Lakes tides not yet handled.** The Great Lakes have no meaningful tidal signal, but NOAA CO-OPS does list some lake-level gauge stations as tide stations. The app currently shows whatever the nearest station returns; a proper "no ocean tides near this location" filter for the Great Lakes region is on the roadmap.
- **No wave/swell data yet.** NDBC buoy wave heights are the next planned marine feature.
- **NWS API reliability.** The NWS API is free but not enterprise-grade — occasional slow responses or brief outages happen. The app handles these gracefully with error messages.

## Running Locally

Requires [Node.js](https://nodejs.org/) (18+).

```bash
git clone https://github.com/YOUR_USERNAME/windward-weather.git
cd windward-weather
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Building for Production

```bash
npm run build
```

Output goes to `dist/`. These are static files — HTML, CSS, JS — ready to deploy anywhere.

## Deploying to Cloudflare Pages

1. Push this repo to GitHub
2. Go to [Cloudflare Pages](https://pages.cloudflare.com/) → Create a project → Connect your GitHub repo
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Deploy

You'll get a permanent URL at `your-project.pages.dev`. Auto-deploys on every push to `main`.

Alternatively, deploy to Netlify, Vercel, or any static hosting — the app has no server-side requirements.

## Tech Stack

- [React](https://react.dev/) — UI
- [Vite](https://vite.dev/) — build tooling
- [Leaflet](https://leafletjs.com/) — radar map
- [Lucide](https://lucide.dev/) — icons
- Vanilla CSS with inline styles — no Tailwind, no CSS framework

## Roadmap

### Next up
- [ ] **Great Lakes handling for tides** — detect when the nearest NOAA station is a lake-level gauge rather than a tidal station and show an appropriate message instead of lake surge data
- [ ] **Wave/swell data via NDBC buoys** — fetch the nearest National Data Buoy Center station in marine mode; display significant wave height, dominant period, and wave direction

### Also planned
- [ ] NWS marine zone forecasts (seas, marine narratives)
- [ ] Pressure trend indicator (rising/falling/steady)
- [ ] Hourly wind gust data from NWS gridpoint endpoint
- [ ] Open-Meteo fallback for international locations
- [ ] Dark mode / night watch theme

### Done
- [x] Animated radar (RainViewer NEXRAD, scrubable timeline, nowcast) — radar tile zoom capped at 7 to avoid tile 404s at higher zoom levels
- [x] Tide predictions via NOAA CO-OPS (marine mode, nearest station within 150 mi, next 4 hi/lo events)
- [x] Pressure units by mode — inHg in shore, millibars in marine
- [x] Shore / Marine toggle with knots, wind/pressure emphasis
- [x] Favorites, geolocation, search, IP fallback

## License

GPL 3.0
