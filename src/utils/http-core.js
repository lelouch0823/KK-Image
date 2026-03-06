export async function request(url, options = {}) {
  const res = await fetch(url, options)

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data.error || data.message || res.statusText)
    err.status = res.status
    err.data = data
    throw err
  }

  return res
}
