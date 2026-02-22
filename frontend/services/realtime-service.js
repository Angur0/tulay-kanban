export async function sendKafkaEventService({
    sendKafkaEventRequest,
    API_URL,
    setKafkaConnected,
    updateKafkaStatusUI
}, eventType, taskId, data = {}) {
    const event = {
        type: eventType,
        taskId,
        data,
        timestamp: new Date().toISOString()
    };

    try {
        const result = await sendKafkaEventRequest(API_URL, event);
        console.log('Kafka API response:', result);

        if (result.status === 'sent') {
            setKafkaConnected(true);
            updateKafkaStatusUI();
        }
    } catch (error) {
        console.error('Failed to send Kafka event:', error);
        setKafkaConnected(false);
        updateKafkaStatusUI();
    }
}

export function connectWebSocketService({
    getActiveBoardId,
    getWsUrl,
    setWebsocket,
    setKafkaConnected,
    updateKafkaStatusUI,
    handleIncomingKafkaEvent,
    reconnect
}) {
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
                const kafkaEvent = JSON.parse(event.data);
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

export function handleIncomingKafkaEventService({
    globalEvents,
    renderActivityLog,
    elements,
    currentUser,
    isDragInProgress,
    loadColumns,
    loadTasks,
    currentEditingTask,
    loadComments
}, kafkaEvent) {
    globalEvents.unshift({
        type: kafkaEvent.type,
        taskId: kafkaEvent.taskId,
        originalTaskId: kafkaEvent.taskId,
        data: kafkaEvent.data || {},
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString()
    });

    if (!elements.activityView.classList.contains('hidden')) renderActivityLog();

    if (['TASK_CREATED', 'TASK_UPDATED', 'TASK_MOVED', 'TASK_DELETED'].includes(kafkaEvent.type)) {
        const isOwnEvent = currentUser && kafkaEvent.user_id === currentUser.id;
        if (!isDragInProgress && !isOwnEvent) {
            loadColumns().then(loadTasks);
        }
    }

    if (['COMMENT_ADDED', 'COMMENT_UPDATED', 'COMMENT_DELETED'].includes(kafkaEvent.type)) {
        if (currentEditingTask && currentEditingTask.id === kafkaEvent.taskId) {
            loadComments(kafkaEvent.taskId);
        }
    }
}

export function notifyKafkaEventService({ showKafkaEvent, elements, updateKafkaStatusUI }, message, type = 'info') {
    showKafkaEvent(elements.kafkaStatus, updateKafkaStatusUI, elements.toastContainer, message, type);
}
