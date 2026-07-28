import { useEffect, useState } from 'react'

/**
 * Current theme ("dark" | "light"), read from the data-theme attribute that
 * App.jsx stamps onto <html>.
 *
 * Why an observer instead of a prop: colours that end up inside a canvas or a
 * Leaflet style callback can't be expressed as CSS custom properties — the
 * value has to be resolved in JS. Anything that resolves a token in JS must
 * also re-resolve it when the theme flips, otherwise it silently keeps the
 * colours it happened to read on mount. Watching the attribute keeps that
 * correct without threading a prop through every intermediate component.
 */
export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark'
  )

  useEffect(() => {
    const el = document.documentElement
    const sync = () => setTheme(el.dataset.theme || 'dark')

    const observer = new MutationObserver(sync)
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] })

    sync() // catch a flip that landed between render and effect
    return () => observer.disconnect()
  }, [])

  return theme
}

/**
 * Resolve a CSS custom property to its current computed value. Pass the theme
 * from useTheme() as a dependency wherever this is memoised.
 */
export function readCssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return v || fallback
}
