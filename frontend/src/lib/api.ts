export async function authFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response | null> {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return null;
    }

    const incomingHeaders = (options.headers as Record<string, string>) || {};
    const hasExplicitContentType = Object.keys(incomingHeaders).some(
        (key) => key.toLowerCase() === 'content-type'
    );

    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        ...(options.body instanceof FormData || hasExplicitContentType
            ? {}
            : { 'Content-Type': 'application/json' }),
        ...incomingHeaders,
    };

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        return null;
    }

    return response;
}

