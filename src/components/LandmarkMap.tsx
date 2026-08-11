/**
 * OWNER: teammate C (T-32).
 *
 * DONE:  a real map — the visitor's position, a pin per landmark coloured by
 *        category, tap a pin to open its story, and the view framed to fit
 *        whatever is currently in the list.
 * TODO:  nothing structural.
 *
 * ── Why Leaflet and OpenStreetMap ──────────────────────────────────────────
 * A map needs tiles from somewhere. Google Maps and Mapbox both want a key in
 * the browser, and a key in the browser is a published key — the same reason
 * the Gemini key lives on the server. OpenStreetMap tiles need no key and no
 * account, and Leaflet is 42 KB with no telemetry.
 *
 * Directions still hand off to Google Maps, because that is where a visitor's
 * navigation actually happens. This map is for seeing where things are.
 *
 * ── Markers are HTML, not images ───────────────────────────────────────────
 * Leaflet's default marker is a PNG resolved relative to the CSS, which
 * breaks under a bundler and is the single most common thing to go wrong with
 * it. These are divIcons — plain HTML we style ourselves — so there is no
 * asset to lose, and each pin can carry its category colour.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { categoryColor } from '../lib/categories';
import { useLang } from '../lib/i18n';
import type { Coordinates, Landmark } from '../lib/types';

/** Zoom used when there is only one thing to look at. */
const SINGLE_POINT_ZOOM = 14;

function landmarkPin(landmark: Landmark): L.DivIcon {
  const colour = categoryColor(landmark.category);
  // A ring rather than a filled blob: the recognisable ones get a solid core
  // so the ten the camera can identify stand out at a glance.
  const core = landmark.test_ready
    ? `<span style="width:8px;height:8px;border-radius:50%;background:${colour}"></span>`
    : '';
  return L.divIcon({
    className: '',
    html:
      `<span style="display:flex;align-items:center;justify-content:center;` +
      `width:18px;height:18px;border-radius:50%;` +
      `border:2.5px solid ${colour};background:rgba(14,14,18,.85);` +
      `box-shadow:0 0 0 1px rgba(0,0,0,.4)">${core}</span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function youArePin(): L.DivIcon {
  return L.divIcon({
    className: '',
    html:
      `<span style="display:block;width:16px;height:16px;border-radius:50%;` +
      `background:#6C4BF4;border:3px solid #fff;box-shadow:0 0 0 6px rgba(108,75,244,.25)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function LandmarkMap({
  landmarks,
  origin,
  className = '',
}: {
  /** Exactly what the list below is showing, so the two never disagree. */
  landmarks: Landmark[];
  /** The visitor's real position, or null when we do not have one. */
  origin: Coordinates | null;
  className?: string;
}) {
  const navigate = useNavigate();
  const { lang } = useLang();
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  // Create the map once. Re-creating it on every render would tear down and
  // rebuild every tile.
  useEffect(() => {
    if (!holder.current || map.current) return;

    const instance = L.map(holder.current, {
      zoomControl: false,
      attributionControl: true,
      // The map sits above a scrolling list; grabbing the page scroll to zoom
      // is the classic way to trap a thumb.
      scrollWheelZoom: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(instance);

    L.control.zoom({ position: 'topright' }).addTo(instance);

    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);

    return () => {
      instance.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  // Redraw the pins whenever the list or the position changes.
  useEffect(() => {
    const instance = map.current;
    const pins = layer.current;
    if (!instance || !pins) return;

    pins.clearLayers();
    const points: L.LatLngExpression[] = [];

    if (origin) {
      L.marker([origin.lat, origin.lng], {
        icon: youArePin(),
        // Above the landmark pins, and not clickable — it is not a place.
        zIndexOffset: 1000,
        interactive: false,
        keyboard: false,
      }).addTo(pins);
      points.push([origin.lat, origin.lng]);
    }

    for (const landmark of landmarks) {
      const name = (lang === 'ar' ? landmark.name_ar : landmark.name_en) || landmark.name_en;
      L.marker([landmark.lat, landmark.lng], {
        icon: landmarkPin(landmark),
        title: name,
        alt: name,
      })
        .addTo(pins)
        .bindTooltip(name, { direction: 'top', offset: [0, -10] })
        .on('click', () => navigate(`/story/${landmark.id}`));
      points.push([landmark.lat, landmark.lng]);
    }

    if (points.length === 0) {
      // Nothing to show. Sit on the country rather than the null island.
      instance.setView([24.0, 45.0], 4);
    } else if (points.length === 1) {
      instance.setView(points[0], SINGLE_POINT_ZOOM);
    } else {
      instance.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 15 });
    }
  }, [landmarks, origin, lang, navigate]);

  return <div ref={holder} className={className} aria-label={lang === 'ar' ? 'خريطة المعالم' : 'Landmark map'} />;
}
