const gatewayBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(gatewayBaseUrl + path, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Accept-Language': localStorage.getItem('astro-locale') || 'zh-CN',
      ...init.headers
    }
  })

  if (!response.ok) {
    throw new Error('API request failed: ' + response.status)
  }
  return response.json() as Promise<T>
}
