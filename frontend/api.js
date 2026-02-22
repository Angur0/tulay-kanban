export async function authFetch(url, options = {}) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return null;
    }

    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        return null;
    }

    return response;
}

export async function sendKafkaEventRequest(apiUrl, event) {
    const response = await fetch(`${apiUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
    });

    return response.json();
}
