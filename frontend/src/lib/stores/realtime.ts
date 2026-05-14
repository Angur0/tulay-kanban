import { writable, get } from 'svelte/store';
import type { RealtimeEvent } from '$lib/types';
import { activeBoardId } from './board';
import { API_URL } from '$lib/constants';

// Internal websocket reference
let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;

export const isWsConnected = writable(false);
export const globalEvents = writable<RealtimeEvent[]>([]);

export function setWsConnected(connected: boolean) {
    isWsConnected.set(connected);
}

export function addRealtimeEvent(event: RealtimeEvent) {
    globalEvents.update(events => [event, ...events]);
}

export function setGlobalEvents(events: RealtimeEvent[]) {
    globalEvents.set(events);
}

function getWsUrl(boardId: string): string {
    const protocol = API_URL.startsWith('https') ? 'wss' : 'ws';
    const hostUrl = API_URL.replace(/^https?:\/\//, '');
    return `${protocol}://${hostUrl}/ws/${boardId}`;
}

export function disconnectWs() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (ws) {
        ws.close();
        ws = null;
    }
    setWsConnected(false);
}

export function connectWs() {
    const boardId = get(activeBoardId);
    if (!boardId) return;

    // Don't connect if already connected to the same board
    if (ws && ws.readyState === WebSocket.OPEN) {
        disconnectWs();
    }

    try {
        const wsUrl = getWsUrl(boardId);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('WebSocket connected to board:', boardId);
            setWsConnected(true);
        };

        ws.onmessage = (event) => {
            console.log('WebSocket message:', event.data);
            try {
                const rawStr = event.data as string;
                const raw = JSON.parse(rawStr);

                const formattedEvent: RealtimeEvent = {
                    type: raw.type,
                    taskId: raw.taskId,
                    originalTaskId: raw.taskId,
                    data: raw.data || {},
                    time: new Date().toLocaleTimeString(),
                    timestamp: new Date().toISOString(),
                };

                addRealtimeEvent(formattedEvent);

                // Dispatch a custom event so components can react (e.g., reloading tasks)
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('ws-message', { detail: formattedEvent }));
                }

            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting in 3s...');
            setWsConnected(false);
            ws = null;
            reconnectTimer = window.setTimeout(() => connectWs(), 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setWsConnected(false);
        };
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        reconnectTimer = window.setTimeout(() => connectWs(), 3000);
    }
}

// React to active board changes to reconnect websocket
if (typeof window !== 'undefined') {
    activeBoardId.subscribe((id) => {
        if (id) {
            disconnectWs();
            connectWs();
        } else {
            disconnectWs();
        }
    });
}
