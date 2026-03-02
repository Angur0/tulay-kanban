import type { AppElements, KafkaEvent } from '../types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

interface SendKafkaCtx {
    sendKafkaEventRequest: AnyFn;
    API_URL: string;
    setKafkaConnected: (connected: boolean) => void;
    updateKafkaStatusUI: () => void;
}
export async function sendKafkaEventService(
    ctx: SendKafkaCtx,
    eventType: string,
    taskId: string,
    data: Record<string, unknown> = {}
): Promise<void> {
    const { sendKafkaEventRequest, API_URL, setKafkaConnected, updateKafkaStatusUI } = ctx;
    const event = { type: eventType, taskId, data, timestamp: new Date().toISOString() };
    try {
        const result = await sendKafkaEventRequest(API_URL, event) as { status?: string };
        console.log('Kafka API response:', result);
        if (result.status === 'sent') { setKafkaConnected(true); updateKafkaStatusUI(); }
    } catch (error) {
        console.error('Failed to send Kafka event:', error);
        setKafkaConnected(false);
        updateKafkaStatusUI();
    }
}

interface ConnectWsCtx {
    getActiveBoardId: () => string | null;
    getWsUrl: (boardId: string) => string;
    setWebsocket: (ws: WebSocket | null) => void;
    setKafkaConnected: (connected: boolean) => void;
    updateKafkaStatusUI: () => void;
    handleIncomingKafkaEvent: (event: Record<string, unknown>) => void;
    reconnect: () => void;
}
export function connectWebSocketService(ctx: ConnectWsCtx): void {
    const { getActiveBoardId, getWsUrl, setWebsocket, setKafkaConnected, updateKafkaStatusUI, handleIncomingKafkaEvent, reconnect } = ctx;
    const activeBoardId = getActiveBoardId();
    if (!activeBoardId) return;
    try {
        const wsUrl = getWsUrl(activeBoardId);
        const websocket = new WebSocket(wsUrl);
        setWebsocket(websocket);
        websocket.onopen = () => {
            console.log('WebSocket connected to board:', activeBoardId);
            setKafkaConnected(true);
            updateKafkaStatusUI();
        };
        websocket.onmessage = (event) => {
            console.log('WebSocket message:', event.data);
            try {
                const kafkaEvent = JSON.parse(event.data as string);
                handleIncomingKafkaEvent(kafkaEvent);
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };
        websocket.onclose = () => {
            console.log('WebSocket disconnected, reconnecting in 3s...');
            setKafkaConnected(false);
            updateKafkaStatusUI();
            setTimeout(reconnect, 3000);
        };
        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            setKafkaConnected(false);
            updateKafkaStatusUI();
        };
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setTimeout(reconnect, 3000);
    }
}

interface HandleIncomingCtx {
    globalEvents: KafkaEvent[];
    renderActivityLog: () => void;
    elements: AppElements;
    currentUser: { id: string } | null;
    isDragInProgress: boolean;
    loadColumns: () => Promise<void>;
    loadTasks: () => Promise<void>;
    currentEditingTask: { id: string } | null;
    loadComments: (taskId: string) => void;
}
export function handleIncomingKafkaEventService(
    ctx: HandleIncomingCtx,
    kafkaEvent: Record<string, unknown>
): void {
    const { globalEvents, renderActivityLog, elements, currentUser, isDragInProgress, loadColumns, loadTasks, currentEditingTask, loadComments } = ctx;
    globalEvents.unshift({
        type: kafkaEvent['type'] as string,
        taskId: kafkaEvent['taskId'] as string,
        originalTaskId: kafkaEvent['taskId'] as string,
        data: (kafkaEvent['data'] || {}) as Record<string, unknown>,
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
    });
    if (!elements.activityView!.classList.contains('hidden')) renderActivityLog();
    if (['TASK_CREATED', 'TASK_UPDATED', 'TASK_MOVED', 'TASK_DELETED'].includes(kafkaEvent['type'] as string)) {
        const isOwnEvent = currentUser && kafkaEvent['user_id'] === currentUser.id;
        if (!isDragInProgress && !isOwnEvent) {
            loadColumns().then(loadTasks);
        }
    }
    if (['COMMENT_ADDED', 'COMMENT_UPDATED', 'COMMENT_DELETED'].includes(kafkaEvent['type'] as string)) {
        if (currentEditingTask && currentEditingTask.id === kafkaEvent['taskId']) {
            loadComments(kafkaEvent['taskId'] as string);
        }
    }
}

interface NotifyKafkaCtx {
    showKafkaEvent: AnyFn;
    elements: AppElements;
    updateKafkaStatusUI: () => void;
}
export function notifyKafkaEventService(
    ctx: NotifyKafkaCtx,
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
): void {
    const { showKafkaEvent, elements, updateKafkaStatusUI } = ctx;
    showKafkaEvent(elements.kafkaStatus, updateKafkaStatusUI, elements.toastContainer, message, type);
}
