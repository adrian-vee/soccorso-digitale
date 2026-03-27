const getToken = (): string | null =>
  localStorage.getItem('adminAuthToken')

export async function fetchApi<T>(path: string): Promise<T> {
  const token = getToken()
  const res = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json() as Promise<T>
}
