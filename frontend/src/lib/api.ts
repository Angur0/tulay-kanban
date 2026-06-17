import { isServerOffline, isMaintenanceMode, maintenanceEndTime } from '$lib/stores/ui';

let pingInterval: ReturnType<typeof setInterval> | null = null;

function startRecoveryPing() {
    if (pingInterval) return;
    pingInterval = setInterval(async () => {
        try {
            const token = localStorage.getItem('access_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            // Simple ping to check if server is reachable and out of maintenance
            const response = await fetch('/api/boards?limit=1', { headers }).catch(() => fetch('/api/boards?limit=1'));
            if (response.status !== 502 && response.status !== 503 && response.status !== 504) {
                isServerOffline.set(false);
                isMaintenanceMode.set(false);
                maintenanceEndTime.set(null);
                if (pingInterval) clearInterval(pingInterval);
                pingInterval = null;
            }
        } catch (e) {
            // Still offline
        }
    }, 3000);
}

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

    try {
        const response = await fetch(url, { ...options, headers });
        
        if (response.status === 503) {
            try {
                const data = await response.clone().json();
                if (data.detail && typeof data.detail === 'object' && data.detail.message) {
                    isMaintenanceMode.set(true);
                    maintenanceEndTime.set(data.detail.end_time || null);
                    isServerOffline.set(true);
                    startRecoveryPing();
                    return response;
                }
            } catch (e) {
                // Not maintenance JSON
            }
        }

        if (response.status === 502 || response.status === 503 || response.status === 504) {
            isServerOffline.set(true);
            startRecoveryPing();
            return response;
        }

        isServerOffline.set(false);
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }

        if (response.status === 401) {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
            return null;
        }

        return response;
    } catch (error) {
        isServerOffline.set(true);
        startRecoveryPing();
        throw error;
    }
}

