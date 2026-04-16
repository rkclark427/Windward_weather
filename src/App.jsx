import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, Star, Search, Wind, Droplets, Eye, Gauge, AlertTriangle,
  Loader2, Navigation, X, Waves, ChevronDown,
  Sunrise, Sunset, RefreshCw, Trash2, Thermometer
} from 'lucide-react';

// ===================== Storage keys =====================
const K_FAVS = 'windward-weather:favorites';
const K_LAST = 'windward-weather:lastLocation';
const K_VIEW = 'windward-weather:view';

// ===================== Palette =====================
const C = {
  paper:     '#F3ECD8',
  paperSoft: '#EFE7D0',
  paperDeep: '#E6DBBB',
  ink:       '#0E2233',
  inkSoft:   '#3D556E',
  inkFaint:  '#7B8B9E',
  rule:      '#C8B98E',
  ruleSoft:  '#D9CDA8',
  signal:    '#B84A2E',
  amber:     '#B88327',
  sea:       '#2E5E7E',
};

// ===================== Unit helpers =====================
const cToF       = (c)   => c == null ? null : c * 9 / 5 + 32;
const msToMph    = (ms)  => ms == null ? null : ms * 2.23694;
const msToKnots  = (ms)  => ms == null ? null : ms * 1.94384;
const kmhToMph   = (kmh) => kmh == null ? null : kmh * 0.621371;
const kmhToKnots = (kmh) => kmh == null ? null : kmh * 0.539957;
const paToInHg   = (pa)  => pa == null ? null : pa * 0.0002953;
const mToMi      = (m)   => m == null ? null : m * 0.000621371;
const mphToKnots = (mph) => mph == null ? null : mph * 0.868976;

function degToCardinal(deg) {
  if (deg == null) return '';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                'S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function cardinalToDeg(card) {
  if (!card) return null;
  const m = {N:0,NNE:22.5,NE:45,ENE:67.5,E:90,ESE:112.5,SE:135,SSE:157.5,
             S:180,SSW:202.5,SW:225,WSW:247.5,W:270,WNW:292.5,NW:315,NNW:337.5};
  return m[card.toUpperCase()] ?? null;
}

function fromNws(value, unitCode, preferred) {
  if (value == null) return null;
  const unit = (unitCode || '').replace('wmoUnit:', '');
  switch (unit) {
    case 'degC':
      return preferred === 'degF' ? cToF(value) : value;
    case 'km_h-1':
      return preferred === 'mph' ? kmhToMph(value) : preferred === 'knots' ? kmhToKnots(value) : value;
    case 'm_s-1':
      return preferred === 'mph' ? msToMph(value) : preferred === 'knots' ? msToKnots(value) : value;
    case 'Pa':
      return preferred === 'inHg' ? paToInHg(value) : value;
    case 'm':
      return preferred === 'mi' ? mToMi(value) : value;
    default:
      return value;
  }
}

function parseWindString(s) {
  if (!s) return { min: null, max: null };
  const m = s.match(/(\d+)(?:\s*to\s*(\d+))?/);
  if (!m) return { min: null, max: null };
  return { min: parseInt(m[1], 10), max: m[2] ? parseInt(m[2], 10) : parseInt(m[1], 10) };
}

function fmt(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toFixed(digits);
}

function fmtHour(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  if (h === 0)  return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function fmtDay(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
}

function fmtTime(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// ===================== Sun times (NOAA algorithm) =====================
function sunTimes(date, lat, lon) {
  const rad = Math.PI / 180;
  const dayMs = 86400000;
  const J1970 = 2440588, J2000 = 2451545;
  const toJulian = (d) => d.valueOf() / dayMs - 0.5 + J1970;
  const fromJulian = (j) => new Date((j + 0.5 - J1970) * dayMs);
  const toDays = (d) => toJulian(d) - J2000;
  const e = rad * 23.4397;
  const solarMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);
  const eclipticLongitude = (M) => {
    const Cv = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2*M) + 0.0003 * Math.sin(3*M));
    return M + Cv + rad * 102.9372 + Math.PI;
  };
  const declination = (l) => Math.asin(Math.sin(e) * Math.sin(l));
  const lw = rad * -lon, phi = rad * lat;
  const d = toDays(date);
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + lw / (2 * Math.PI) + n;
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const w = Math.acos((Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  const a = 0.0009 + (w + lw) / (2 * Math.PI) + n;
  const Jset = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const Jrise = Jnoon - (Jset - Jnoon);
  return { sunrise: fromJulian(Jrise), sunset: fromJulian(Jset) };
}

// ===================== NWS API =====================
const NWS = 'https://api.weather.gov';

async function nwsFetch(url) {
  const res = await fetch(url, { headers: { Accept: 'application/geo+json' } });
  if (!res.ok) { const err = new Error(`NWS ${res.status}`); err.status = res.status; throw err; }
  return res.json();
}

async function getPoints(lat, lon) {
  return nwsFetch(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
}

async function getLatestObservation(stationsUrl) {
  const data = await nwsFetch(stationsUrl);
  const stations = data.features || [];
  for (let i = 0; i < Math.min(4, stations.length); i++) {
    try {
      const id = stations[i].properties.stationIdentifier;
      const obs = await nwsFetch(`${NWS}/stations/${id}/observations/latest`);
      if (obs.properties?.temperature?.value != null) {
        return { obs: obs.properties, stationName: stations[i].properties.name };
      }
    } catch { /* try next */ }
  }
  return null;
}

async function getAlerts(lat, lon) {
  const data = await nwsFetch(`${NWS}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`);
  return data.features || [];
}

// ===================== Geocoding (Nominatim) =====================
async function geocodeSearch(q) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`
  );
  if (!res.ok) throw new Error('Geocoding failed');
  return (await res.json()).map(it => ({
    lat: parseFloat(it.lat), lon: parseFloat(it.lon), name: formatName(it),
  }));
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    );
    if (!res.ok) return null;
    return formatName(await res.json());
  } catch { return null; }
}

function formatName(n) {
  const a = n.address || {};
  const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || a.county;
  const state = a.state;
  const cc = (a.country_code || '').toUpperCase();
  if (city && state) return cc === 'US' ? `${city}, ${state}` : `${city}, ${state}, ${cc}`;
  if (city && cc) return `${city}, ${cc}`;
  return (n.display_name || 'Unknown').split(',').slice(0, 2).join(', ');
}

// ===================== localStorage helpers =====================
function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ===================== Derive current conditions =====================
function deriveCurrent(o, windPref) {
  const temp = fromNws(o.temperature?.value, o.temperature?.unitCode, 'degF');
  const flVal = o.heatIndex?.value ?? o.windChill?.value ?? o.temperature?.value;
  const flUnit = o.heatIndex?.value != null ? o.heatIndex.unitCode
               : o.windChill?.value != null ? o.windChill.unitCode
               : o.temperature?.unitCode;
  return {
    temp,
    feelsLike: fromNws(flVal, flUnit, 'degF'),
    dewpoint: fromNws(o.dewpoint?.value, o.dewpoint?.unitCode, 'degF'),
    windSpeed: fromNws(o.windSpeed?.value, o.windSpeed?.unitCode, windPref),
    gust: fromNws(o.windGust?.value, o.windGust?.unitCode, windPref),
    windDir: o.windDirection?.value,
    humidity: o.relativeHumidity?.value,
    pressure: fromNws(o.barometricPressure?.value ?? o.seaLevelPressure?.value,
                      o.barometricPressure?.unitCode ?? o.seaLevelPressure?.unitCode, 'inHg'),
    visibility: fromNws(o.visibility?.value, o.visibility?.unitCode, 'mi'),
    text: o.textDescription || '—',
  };
}

// Consolidate NWS day/night periods into days
function consolidateForecast(periods) {
  const byDay = {};
  for (const p of periods) {
    const key = new Date(p.startTime).toISOString().slice(0, 10);
    if (!byDay[key]) byDay[key] = { date: p.startTime, day: null, night: null };
    if (p.isDaytime) byDay[key].day = p; else byDay[key].night = p;
  }
  return Object.values(byDay).slice(0, 7);
}

// ===================== Small UI components =====================

function WindArrow({ deg, size = 14, color = C.ink }) {
  if (deg == null) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16"
         style={{ transform: `rotate(${(deg + 180) % 360}deg)`, display: 'inline-block', flexShrink: 0 }}>
      <path d="M8 1 L11 8 L8 6.5 L5 8 Z" fill={color} />
    </svg>
  );
}

function CompassRose({ size = 42 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ opacity: 0.25, flexShrink: 0 }}>
      <circle cx="20" cy="20" r="18" fill="none" stroke={C.ink} strokeWidth="0.5" />
      <circle cx="20" cy="20" r="12" fill="none" stroke={C.ink} strokeWidth="0.3" />
      <path d="M20 2 L22 20 L20 18 L18 20 Z" fill={C.ink} />
      <path d="M20 38 L22 20 L20 22 L18 20 Z" fill={C.ink} opacity="0.5" />
      <path d="M2 20 L20 22 L18 20 L20 18 Z" fill={C.ink} opacity="0.5" />
      <path d="M38 20 L20 22 L22 20 L20 18 Z" fill={C.ink} opacity="0.5" />
      <text x="20" y="7" fontSize="4" textAnchor="middle" fill={C.ink} fontFamily="serif">N</text>
    </svg>
  );
}

function SectionHeader({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <h3 style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
        letterSpacing: '0.2em', textTransform: 'uppercase', color: C.inkSoft, whiteSpace: 'nowrap',
      }}>{label}</h3>
      <div style={{ flex: 1, borderTop: `1px solid ${C.rule}` }} />
    </div>
  );
}

function DataPoint({ icon, label, primary, secondary, emphasis }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: C.inkFaint }}>
        {icon}
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem',
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>{label}</span>
      </div>
      <div style={{
        fontFamily: emphasis ? "'Fraunces', Georgia, serif" : "'DM Sans', sans-serif",
        fontWeight: 500, fontSize: emphasis ? '1.5rem' : '1.25rem',
        color: C.ink, lineHeight: 1.1,
      }}>{primary}</div>
      {secondary && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
          color: C.inkSoft, marginTop: 2,
        }}>{secondary}</div>
      )}
    </div>
  );
}

// ===================== Search Box =====================
function SearchBox({ open, setOpen, onPick }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  useEffect(() => {
    if (!q || q.length < 3) { setRes([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try { setRes(await geocodeSearch(q)); } catch { setRes([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer.current);
  }, [q]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
          fontSize: '0.875rem', backgroundColor: C.paperSoft,
          border: `1px solid ${C.rule}`, color: C.ink, borderRadius: 2,
        }}
      >
        <Search size={13} /> Search
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
          backgroundColor: C.paper, border: `1px solid ${C.rule}`,
          minWidth: 300, maxWidth: '90vw', boxShadow: '0 8px 24px rgba(14,34,51,0.12)',
          borderRadius: 2, padding: 8,
        }}>
          <input
            ref={inputRef} type="text" value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="City, harbor, landmark…"
            style={{
              width: '100%', padding: '8px 10px', fontSize: '0.875rem',
              backgroundColor: C.paperSoft, border: `1px solid ${C.ruleSoft}`,
              color: C.ink, borderRadius: 2, outline: 'none',
            }}
          />
          {searching && <div style={{ padding: '8px', fontSize: '0.75rem', color: C.inkFaint }}>Searching…</div>}
          {!searching && res.length > 0 && (
            <ul style={{ marginTop: 4 }}>
              {res.map((r, i) => (
                <li key={i}>
                  <button
                    onClick={() => { onPick(r); setQ(''); setRes([]); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px',
                      fontSize: '0.875rem', color: C.ink,
                      borderBottom: i < res.length - 1 ? `1px solid ${C.ruleSoft}` : 'none',
                    }}
                  >
                    <div>{r.name}</div>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.65rem', color: C.inkFaint,
                    }}>
                      {r.lat.toFixed(3)}, {r.lon.toFixed(3)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!searching && q.length >= 3 && res.length === 0 && (
            <div style={{ padding: 8, fontSize: '0.75rem', color: C.inkFaint }}>No results</div>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== Alert Card =====================
function AlertCard({ alert }) {
  const [open, setOpen] = useState(false);
  const sev = (alert.severity || '').toLowerCase();
  const severe = sev === 'extreme' || sev === 'severe';
  const color = severe ? C.signal : C.amber;
  return (
    <div style={{
      border: `1.5px solid ${color}`, padding: 14, marginBottom: 8,
      backgroundColor: severe ? '#FBEDE8' : '#FBF4E1', borderRadius: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <AlertTriangle size={18} style={{ color, flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500,
            fontSize: '1.05rem', color: C.ink, lineHeight: 1.3,
          }}>{alert.event}</div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem',
            color: C.inkSoft, marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {alert.severity} · Until {alert.ends ? fmtTime(alert.ends) : '—'}
          </div>
          <div style={{ marginTop: 8, fontSize: '0.875rem', color: C.ink }}>{alert.headline}</div>
          <button
            onClick={() => setOpen(v => !v)}
            style={{ marginTop: 8, fontSize: '0.75rem', textDecoration: 'underline', color: C.inkSoft }}
          >{open ? 'Hide details' : 'Show details'}</button>
          {open && (
            <div style={{
              marginTop: 12, fontSize: '0.875rem', whiteSpace: 'pre-wrap',
              color: C.ink, lineHeight: 1.5,
            }}>{alert.description}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== Current Conditions =====================
function CurrentConditions({ current, hourly, view, windPref, windUnit, sunrise, sunset, isMarine }) {
  const next = hourly && hourly[0];
  const temp = current?.temp ?? next?.temperature ?? null;
  const text = current?.text ?? next?.shortForecast ?? '—';
  const windSpd = current?.windSpeed != null
    ? current.windSpeed
    : next?.windSpeed ? (windPref === 'knots' ? mphToKnots(parseWindString(next.windSpeed).max) : parseWindString(next.windSpeed).max) : null;
  const windDir = current?.windDir ?? (next ? cardinalToDeg(next.windDirection) : null);
  const windCard = windDir != null ? degToCardinal(windDir) : (next?.windDirection || '');

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)',
        gap: '24px 40px',
      }} className="conditions-grid">
        {/* Temperature */}
        <div>
          <div style={{
            fontFamily: "'Fraunces', Georgia, serif", fontWeight: 300,
            fontSize: 'clamp(4rem, 14vw, 7rem)', lineHeight: 0.9,
            color: C.ink, letterSpacing: '-0.03em',
          }}>
            {temp != null ? fmt(temp) : '—'}
            <span style={{ fontSize: '0.4em', verticalAlign: 'top', marginLeft: 4, color: C.inkSoft }}>°F</span>
          </div>
          <p style={{
            fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400,
            fontStyle: 'italic', fontSize: '1.1rem', marginTop: 6, color: C.inkSoft,
          }}>{text}</p>
          {current?.dewpoint != null && (
            <p style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
              color: C.inkFaint, marginTop: 8, letterSpacing: '0.05em',
            }}>
              Feels {fmt(current.feelsLike ?? current.temp)}° · Dew {fmt(current.dewpoint)}°
            </p>
          )}
        </div>

        {/* Data grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '20px 24px',
        }}>
          <DataPoint
            icon={<WindArrow deg={windDir} size={16} />}
            label="Wind" emphasis={isMarine}
            primary={`${windSpd != null ? fmt(windSpd) : '—'} ${windUnit}`}
            secondary={`${windCard || '—'}${current?.gust != null ? ` · gust ${fmt(current.gust)}` : ''}`}
          />
          <DataPoint
            icon={<Gauge size={14} />}
            label="Pressure" emphasis={isMarine}
            primary={current?.pressure != null ? fmt(current.pressure, 2) : '—'}
            secondary={current?.pressure != null ? 'inHg' : ''}
          />
          <DataPoint
            icon={<Droplets size={14} />} label="Humidity"
            primary={current?.humidity != null ? `${fmt(current.humidity)}%` : '—'}
          />
          <DataPoint
            icon={<Eye size={14} />} label="Visibility"
            primary={current?.visibility != null ? `${fmt(current.visibility)} mi` : '—'}
          />
          <DataPoint
            icon={<Sunrise size={14} />} label="Sunrise"
            primary={sunrise ? fmtTime(sunrise) : '—'}
          />
          <DataPoint
            icon={<Sunset size={14} />} label="Sunset"
            primary={sunset ? fmtTime(sunset) : '—'}
          />
        </div>
      </div>
    </section>
  );
}

// ===================== Hourly strip =====================
function HourlyStrip({ hourly, windUnit, windPref }) {
  return (
    <div className="hourly-scroll" style={{ overflowX: 'auto', marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
      <div style={{
        display: 'flex', gap: 0, minWidth: 'max-content',
        borderTop: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}`,
      }}>
        {hourly.map((h, i) => {
          const w = parseWindString(h.windSpeed);
          const ws = windPref === 'knots' ? mphToKnots(w.max) : w.max;
          const wd = cardinalToDeg(h.windDirection);
          const pop = h.probabilityOfPrecipitation?.value;
          return (
            <div key={i} style={{
              flexShrink: 0, textAlign: 'center', padding: '12px 12px',
              minWidth: 62, borderRight: i < hourly.length - 1 ? `1px solid ${C.ruleSoft}` : 'none',
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                color: C.inkFaint, letterSpacing: '0.05em',
              }}>{fmtHour(h.startTime)}</div>
              <div style={{
                fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400,
                fontSize: '1.2rem', color: C.ink, margin: '6px 0 4px',
              }}>{h.temperature}°</div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 18,
              }}>
                <WindArrow deg={wd} size={12} color={C.inkSoft} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: C.inkSoft }}>
                  {ws != null ? fmt(ws) : '—'}
                </span>
              </div>
              {pop != null && pop > 0 && (
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem',
                  color: C.sea, marginTop: 2,
                }}>{pop}%</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===================== 7-day list =====================
function DayList({ days, windUnit, windPref }) {
  return (
    <div style={{ borderTop: `1px solid ${C.rule}` }}>
      {days.map((d, i) => {
        const high = d.day?.temperature;
        const low = d.night?.temperature;
        const summary = d.day?.shortForecast || d.night?.shortForecast || '';
        const wind = d.day?.windSpeed || d.night?.windSpeed || '';
        const wdir = d.day?.windDirection || d.night?.windDirection || '';
        const wParsed = parseWindString(wind);
        const wMin = windPref === 'knots' ? mphToKnots(wParsed.min) : wParsed.min;
        const wMax = windPref === 'knots' ? mphToKnots(wParsed.max) : wParsed.max;
        const wDeg = cardinalToDeg(wdir);
        const pop = d.day?.probabilityOfPrecipitation?.value ?? d.night?.probabilityOfPrecipitation?.value;

        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '60px 80px 1fr auto',
            gap: '8px 16px', alignItems: 'center', padding: '12px 0',
            borderBottom: `1px solid ${C.ruleSoft}`,
          }} className="day-row">
            <div style={{
              fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: '1rem', color: C.ink,
            }}>{i === 0 ? 'Today' : fmtDay(d.date)}</div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{
                fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400,
                fontSize: '1.2rem', color: C.ink,
              }}>{high != null ? `${high}°` : '—'}</span>
              <span style={{
                fontFamily: "'Fraunces', Georgia, serif", fontWeight: 300,
                fontSize: '1rem', color: C.inkFaint,
              }}>{low != null ? `${low}°` : ''}</span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: C.inkSoft,
              overflow: 'hidden',
            }}>
              <WindArrow deg={wDeg} size={12} color={C.inkSoft} />
              <span style={{ whiteSpace: 'nowrap' }}>
                {wdir || '—'} {wMin != null ? `${fmt(wMin)}–${fmt(wMax)}` : '—'} {windUnit}
              </span>
              <span style={{
                marginLeft: 8, fontSize: '0.82rem', color: C.ink,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: "'DM Sans', sans-serif",
              }}>{summary}</span>
            </div>

            <div>
              {pop != null && pop > 0 && (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
                  color: C.sea, whiteSpace: 'nowrap',
                }}>{pop}%</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===================== Main App =====================
export default function App() {
  const [loc, setLoc] = useState(null);
  const [view, setView] = useState(() => lsGet(K_VIEW, 'shore'));
  const [favs, setFavs] = useState(() => lsGet(K_FAVS, []));
  const [favsOpen, setFavsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  // Initial load
  useEffect(() => {
    const last = lsGet(K_LAST, null);
    if (last) setLoc(last);
    else detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { lsSet(K_VIEW, view); }, [view]);

  // Fetch weather when location changes
  useEffect(() => {
    if (!loc) return;
    lsSet(K_LAST, loc);
    fetchWeather(loc);
  }, [loc?.lat, loc?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Location detection ----
  const detectLocation = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setStatus('Detecting location…');

    // 1) Browser geolocation
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, timeout: 8000, maximumAge: 300000,
          });
        });
        setStatus('Resolving location name…');
        const { latitude: lat, longitude: lon } = pos.coords;
        const name = (await reverseGeocode(lat, lon)) || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        setLoc({ lat, lon, name });
        setStatus('');
        return;
      } catch { /* fall through */ }
    }

    // 2) IP-based fallback
    setStatus('Trying IP-based location…');
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (d.latitude && d.longitude) {
        const cityName = [d.city, d.region].filter(Boolean).join(', ') || `${d.latitude.toFixed(2)}, ${d.longitude.toFixed(2)}`;
        setLoc({ lat: d.latitude, lon: d.longitude, name: `${cityName} (approx.)` });
        setStatus('');
        return;
      }
    } catch { /* fall through */ }

    setLoading(false);
    setStatus('');
    setErr("Couldn't detect location. Use Search to pick a city or harbor.");
  }, []);

  // ---- Fetch weather data ----
  async function fetchWeather(location) {
    setLoading(true);
    setErr(null);
    setStatus('Fetching NWS grid data…');
    try {
      const points = await getPoints(location.lat, location.lon);
      const p = points.properties;
      setStatus('Loading forecast & observations…');
      const [fc, hr, alerts, obs] = await Promise.all([
        nwsFetch(p.forecast).catch(() => null),
        nwsFetch(p.forecastHourly).catch(() => null),
        getAlerts(location.lat, location.lon).catch(() => []),
        getLatestObservation(p.observationStations).catch(() => null),
      ]);
      const st = sunTimes(new Date(), location.lat, location.lon);
      setData({
        forecast: fc?.properties?.periods || [],
        hourly: hr?.properties?.periods || [],
        alerts,
        observation: obs?.obs || null,
        stationName: obs?.stationName || null,
        sunrise: st.sunrise,
        sunset: st.sunset,
      });
      setLastFetch(new Date());
      setStatus('');
    } catch (e) {
      if (e.status === 404) {
        setErr('This location is outside NWS coverage (US only). Open-Meteo international fallback coming in v2.');
      } else {
        setErr(`Couldn't load weather: ${e.message}`);
      }
      setData(null);
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  // ---- Favorites ----
  function toggleFavorite() {
    if (!loc) return;
    const exists = favs.some(f => f.lat === loc.lat && f.lon === loc.lon);
    const next = exists
      ? favs.filter(f => !(f.lat === loc.lat && f.lon === loc.lon))
      : [...favs, { ...loc }];
    setFavs(next);
    lsSet(K_FAVS, next);
  }

  function removeFavorite(f) {
    const next = favs.filter(x => !(x.lat === f.lat && x.lon === f.lon));
    setFavs(next);
    lsSet(K_FAVS, next);
  }

  const isFav = loc && favs.some(f => f.lat === loc.lat && f.lon === loc.lon);
  const isMarine = view === 'marine';
  const windUnit = isMarine ? 'kt' : 'mph';
  const windPref = isMarine ? 'knots' : 'mph';
  const current = data?.observation ? deriveCurrent(data.observation, windPref) : null;
  const hourly24 = (data?.hourly || []).slice(0, 24);
  const days = consolidateForecast(data?.forecast || []);

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      backgroundColor: C.paper, color: C.ink, minHeight: '100vh',
      backgroundImage: `
        radial-gradient(circle at 20% 10%, rgba(200,185,142,0.12) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(46,94,126,0.06) 0%, transparent 50%)
      `,
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>

        {/* ===== Header ===== */}
        <header style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 32,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CompassRose />
            <div>
              <h1 style={{
                fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500,
                fontSize: 'clamp(1.5rem, 4vw, 2.1rem)', letterSpacing: '-0.01em',
                lineHeight: 1, color: C.ink,
              }}>Windward Weather</h1>
              <p style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem',
                letterSpacing: '0.15em', color: C.inkFaint, marginTop: 4,
                textTransform: 'uppercase',
              }}>NOAA · No ads · No nonsense</p>
            </div>
          </div>
          <button
            onClick={() => loc && fetchWeather(loc)}
            disabled={!loc || loading}
            title="Refresh"
            style={{ color: C.inkSoft, padding: 8, opacity: (!loc || loading) ? 0.3 : 1 }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </header>

        {/* ===== Location controls ===== */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <button onClick={detectLocation} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            fontSize: '0.875rem', backgroundColor: C.paperSoft,
            border: `1px solid ${C.rule}`, color: C.ink, borderRadius: 2,
          }}>
            <Navigation size={13} /> Current location
          </button>

          {/* Favorites dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setFavsOpen(v => !v); setSearchOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              fontSize: '0.875rem', backgroundColor: C.paperSoft,
              border: `1px solid ${C.rule}`, color: C.ink, borderRadius: 2,
            }}>
              <Star size={13} fill={favs.length ? C.amber : 'none'} stroke={favs.length ? C.amber : C.ink} />
              Favorites ({favs.length})
              <ChevronDown size={12} style={{ transform: favsOpen ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
            </button>
            {favsOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
                backgroundColor: C.paper, border: `1px solid ${C.rule}`,
                minWidth: 260, boxShadow: '0 8px 24px rgba(14,34,51,0.12)', borderRadius: 2,
              }}>
                {favs.length === 0 ? (
                  <div style={{ padding: 12, fontSize: '0.875rem', color: C.inkFaint }}>
                    No favorites yet. Star a location to save it.
                  </div>
                ) : (
                  <ul>
                    {favs.map((f, i) => (
                      <li key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 8, padding: '8px 12px',
                        borderBottom: i < favs.length - 1 ? `1px solid ${C.ruleSoft}` : 'none',
                      }}>
                        <button
                          onClick={() => { setLoc(f); setFavsOpen(false); }}
                          style={{ textAlign: 'left', fontSize: '0.875rem', flex: 1, color: C.ink }}
                        >{f.name}</button>
                        <button onClick={() => removeFavorite(f)} style={{ opacity: 0.4, padding: 4 }}>
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <SearchBox
            open={searchOpen}
            setOpen={(v) => { setSearchOpen(v); if (v) setFavsOpen(false); }}
            onPick={(pick) => { setLoc(pick); setSearchOpen(false); }}
          />
        </div>

        {/* ===== Location header + view toggle ===== */}
        {loc && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end',
            justifyContent: 'space-between', gap: 16,
            marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${C.rule}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <MapPin size={18} style={{ color: C.inkSoft, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <h2 style={{
                  fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400,
                  fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)', lineHeight: 1.1,
                  letterSpacing: '-0.01em', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{loc.name}</h2>
                <p style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                  color: C.inkFaint, marginTop: 4,
                }}>
                  {loc.lat.toFixed(3)}°, {loc.lon.toFixed(3)}°
                  {data?.stationName && ` · Station: ${data.stationName}`}
                </p>
              </div>
              <button onClick={toggleFavorite} title={isFav ? 'Unstar' : 'Star'} style={{ padding: 6, marginLeft: 4 }}>
                <Star size={18} fill={isFav ? C.amber : 'none'} stroke={isFav ? C.amber : C.inkSoft} />
              </button>
            </div>

            <div style={{ display: 'flex', border: `1px solid ${C.rule}`, borderRadius: 2 }}>
              {['shore', 'marine'].map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  fontSize: '0.875rem',
                  backgroundColor: view === v ? C.ink : 'transparent',
                  color: view === v ? C.paper : C.ink,
                  transition: 'background-color 0.15s, color 0.15s',
                }}>
                  {v === 'shore' ? <Thermometer size={13} /> : <Waves size={13} />}
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== Status / Error ===== */}
        {status && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
            color: C.inkFaint,
          }}>
            <Loader2 size={14} className="animate-spin" />
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem',
              letterSpacing: '0.05em',
            }}>{status}</span>
          </div>
        )}
        {err && (
          <div style={{
            marginBottom: 24, padding: '12px 16px', fontSize: '0.875rem',
            backgroundColor: '#FBEDE8', border: `1px solid ${C.signal}`,
            color: C.signal, borderRadius: 2,
          }}>{err}</div>
        )}

        {/* ===== Alerts ===== */}
        {data?.alerts?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            {data.alerts.map((a, i) => <AlertCard key={i} alert={a.properties} />)}
          </div>
        )}

        {/* ===== Current conditions ===== */}
        {data && (
          <CurrentConditions
            current={current} hourly={hourly24}
            view={view} windPref={windPref} windUnit={windUnit}
            sunrise={data.sunrise} sunset={data.sunset} isMarine={isMarine}
          />
        )}

        {/* ===== Next 24 hours ===== */}
        {data && hourly24.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <SectionHeader label="Next 24 hours" />
            <HourlyStrip hourly={hourly24} windUnit={windUnit} windPref={windPref} />
          </section>
        )}

        {/* ===== 7-day forecast ===== */}
        {data && days.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <SectionHeader label="7-day outlook" />
            <DayList days={days} windUnit={windUnit} windPref={windPref} />
          </section>
        )}

        {/* ===== Footer ===== */}
        {data && (
          <footer style={{ paddingTop: 24, marginTop: 40, borderTop: `1px solid ${C.rule}` }}>
            <p style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem',
              color: C.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Data: api.weather.gov (NOAA/NWS) · Location: OpenStreetMap
              {lastFetch && ` · Updated ${fmtTime(lastFetch)}`}
            </p>
          </footer>
        )}
      </div>

      {/* Responsive CSS for small screens */}
      <style>{`
        @media (max-width: 640px) {
          .conditions-grid { grid-template-columns: 1fr !important; }
          .day-row { grid-template-columns: 50px 70px 1fr auto !important; gap: 4px 8px !important; }
        }
      `}</style>
    </div>
  );
}
