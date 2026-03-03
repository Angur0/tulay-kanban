import { writable, get } from 'svelte/store';
import type { KafkaEvent } from '$lib/types';
import { activeBoardId } from './board';
import { API_URL } from '$lib/constants';

// Internal websocket reference
let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;

export const isKafkaConnected = writable(false);
export const globalEvents = writable<KafkaEvent[]>([]);

export function setKafkaConnected(connected: boolean) {
    isKafkaConnected.set(connected);
}

export function addKafkaEvent(event: KafkaEvent) {
    globalEvents.update(events => [event, ...events]);
}

export function setGlobalEvents(events: KafkaEvent[]) {
    globalEvents.set(events);
}

function getWsUrl(boardId: string): string {
    const protocol = API_URL.startsWith('https') ? 'wss' : 'ws';
    const hostUrl = API_URL.replace(/^https?:\/\//, '');
    return `${protocol}://${hostUrl}/api/ws/${boardId}`;
}

export function disconnectKafka() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (ws) {
        ws.close();
        ws = null;
    }
    setKafkaConnected(false);
}

export function connectKafka() {
    const boardId = get(activeBoardId);
    if (!boardId) return;

    // Don't connect if already connected to the same board
    if (ws && ws.readyState === WebSocket.OPEN) {
        // We'd need to store the current connected board ID to be perfect, 
        // but for now we'll just disconnect and reconnect to be safe when activeBoardId changes
        disconnectKafka();
    }

    try {
        const wsUrl = getWsUrl(boardId);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('WebSocket connected to board:', boardId);
            setKafkaConnected(true);
        };

        ws.onmessage = (event) => {
            console.log('WebSocket message:', event.data);
            try {
                const kafkaEventStr = event.data as string;
                const kafkaEventRaw = JSON.parse(kafkaEventStr);

                const formattedEvent: KafkaEvent = {
                    type: kafkaEventRaw.type,
                    taskId: kafkaEventRaw.taskId,
                    originalTaskId: kafkaEventRaw.taskId,
                    data: kafkaEventRaw.data || {},
                    time: new Date().toLocaleTimeString(),
                    timestamp: new Date().toISOString(),
                };

                addKafkaEvent(formattedEvent);

                // Dispatch a custom event so components can react (e.g., reloading tasks)
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('kafka-message', { detail: formattedEvent }));
                }

            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting in 3s...');
            setKafkaConnected(false);
            ws = null;
            reconnectTimer = window.setTimeout(() => connectKafka(), 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setKafkaConnected(false);
        };
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        reconnectTimer = window.setTimeout(() => connectKafka(), 3000);
    }
}

// React to active board changes to reconnect websocket
if (typeof window !== 'undefined') {
    activeBoardId.subscribe((id) => {
        if (id) {
            disconnectKafka();
            connectKafka();
        } else {
            disconnectKafka();
        }
    });
}
