// Settings → Map Display. Keys are the toggles; MAP_LAYER_NAMES maps them onto
// MapArea's layer names. The two overlays default off because they bury the
// live picture on a busy map.
export const MAP_LAYER_STORAGE_KEY = 'fireops-map-layers'
export const MAP_LAYER_DEFAULTS = {
  incidents: true, personnel: true, routes: true, heatmap: false, boundaries: false,
}

export function readMapLayerPrefs(storage = globalThis.localStorage) {
  try {
    return { ...MAP_LAYER_DEFAULTS, ...JSON.parse(storage.getItem(MAP_LAYER_STORAGE_KEY) || '{}') }
  } catch {
    return MAP_LAYER_DEFAULTS
  }
}

/**
 * Which layers the command map draws. The special view modes each show exactly
 * their own layer; the normal view is shaped by the Map Display toggles.
 */
export function activeLayersFor(viewMode, prefs) {
  switch (viewMode) {
    case 'gnn':          return new Set(['GNN Constraints'])
    case 'heatmap':      return new Set(['Heat Map'])
    case 'barangay':     return new Set(['Barangay'])
    case 'obstructions': return new Set(['Obstructions'])
    default:
      return new Set([
        'Stations',
        prefs?.incidents !== false && 'Incidents',
        prefs?.personnel !== false && 'Personnel',
        prefs?.routes !== false && 'Routes',
        prefs?.heatmap && 'Heat Map',
        prefs?.boundaries && 'Barangay',
      ].filter(Boolean))
  }
}
