export const PANABO_CENTER = [7.307, 125.635]
export const PANABO_ZOOM   = 12

export const PANABO_BOUNDS = {
  latMin: 7.15, latMax: 7.50,
  lngMin: 125.50, lngMax: 125.90,
}

export function withinPanabo(lat, lng) {
  return (
    lat >= PANABO_BOUNDS.latMin && lat <= PANABO_BOUNDS.latMax &&
    lng >= PANABO_BOUNDS.lngMin && lng <= PANABO_BOUNDS.lngMax
  )
}

/**
 * Style for the out-of-jurisdiction mask — the fill that dims everything
 * outside the Panabo boundary on picker maps.
 *
 * It has to invert with the theme: a near-black scrim reads as "dimmed" over a
 * dark basemap, but as a hole punched in the page over a light one. Shared here
 * because the station, edit-station and log-incident pickers all draw it.
 */
export function maskStyle(theme) {
  return theme === 'light'
    ? { fillColor: '#f0f3f7', fillOpacity: 0.78, stroke: false }
    : { fillColor: '#060810', fillOpacity: 0.72, stroke: false }
}

export const TILE_OPTIONS = [
  {
    id: 'street',
    label: 'Light',
    thumb: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/5/27/15.png',
    layers: [
      {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      },
    ],
  },
  {
    id: 'dark',
    label: 'Dark',
    thumb: 'https://a.basemaps.cartocdn.com/dark_all/5/27/15.png',
    layers: [
      {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      },
    ],
  },
  {
    id: 'satellite',
    label: 'Satellite',
    thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/15/27',
    layers: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
        maxZoom: 19,
        maxNativeZoom: 17,
      },
    ],
  },
]
