const gatewayBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    super(`API request failed: ${status}`)
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await requestRaw(path, init)
  return response.json() as Promise<T>
}

export async function requestRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      'Accept-Language': localStorage.getItem('astro-locale') || 'zh-CN',
      ...init.headers
    }
  })

  if (!response.ok) {
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
    throw new HttpError(response.status, payload)
  }
  return response
}

export function apiUrl(path: string): string {
  return gatewayBaseUrl + path
}
