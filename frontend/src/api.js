const BASE_URL = 'http://localhost:8000'

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('bfp_token')

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('bfp_token')
    localStorage.removeItem('bfp_user')
    window.location.reload()
  }

  return res
}
