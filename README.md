# Windward Weather

A clean, fast weather dashboard built on NOAA/NWS data. No ads, no tracking, no nonsense.

![NOAA Data](https://img.shields.io/badge/data-NOAA%2FNWS-0E2233)
![License](https://img.shields.io/badge/license-MIT-blue)

## Why

Every weather app is bloated with ads, "feels like" indexes, pollen counts, engagement tricks, and auto-playing video. The actual weather data — sourced free from NOAA — gets buried under the noise.

Windward Weather strips all of that away. It shows you what matters: current conditions, wind, pressure, the next 24 hours, and a 7-day outlook. That's it.

Built for sailors and anyone else who makes real decisions based on weather.

## Features

- **Current conditions** — temperature, wind speed/direction/gusts, barometric pressure, humidity, visibility, dewpoint
- **Hourly forecast** — next 24 hours with temperature, wind, and precipitation probability
- **7-day outlook** — high/low temps, wind range with direction, conditions summary
- **Active NWS alerts** — prominent but not obnoxious, expandable for full text
- **Shore / Marine toggle** — marine mode displays wind in knots and emphasizes wind and pressure
- **Location handling** — browser geolocation, IP-based fallback, manual search (OpenStreetMap/Nominatim), saved favorites via localStorage
- **Sunrise / sunset** — calculated locally, no extra API call
- **Responsive** — works on desktop and mobile
- **Zero dependencies on paid services** — all data sources are free and public

## Data Sources

| Data | Source | Cost |
|------|--------|------|
| Forecasts & observations | [NWS API](https://api.weather.gov) (NOAA) | Free, no key |
| Geocoding & search | [Nominatim](https://nominatim.openstreetmap.org) (OpenStreetMap) | Free, no key |
| IP-based location fallback | [ipapi.co](https://ipapi.co) | Free tier (1k/day) |

## Limitations

- **US coverage only (v1).** The NWS API covers the US and territories. Locations outside the US return a clear error message. Open-Meteo international fallback is planned for v2.
- **Marine view is display-only in v1.** It changes units to knots and reweights the visual hierarchy, but doesn't yet pull NWS marine zone forecasts (wave heights, seas, mariner-specific narratives). Planned for v2.
- **No tides, waves, or radar yet.** Tides (NOAA CO-OPS), wave heights (NDBC buoys or Open-Meteo Marine API), and radar (link-out or embed) are on the roadmap.
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
- [Lucide](https://lucide.dev/) — icons
- Vanilla CSS with inline styles — no Tailwind, no CSS framework

## Roadmap

- [ ] Open-Meteo fallback for international locations
- [ ] NWS marine zone forecasts (wave heights, seas, marine narratives)
- [ ] Tide data via NOAA CO-OPS API
- [ ] Wave/swell data via Open-Meteo Marine API or NDBC buoys
- [ ] Radar link-out or lightweight embed
- [ ] Pressure trend indicator (rising/falling/steady)
- [ ] Hourly wind gust data from NWS gridpoint endpoint
- [ ] Dark mode / night watch theme

## License

MIT
