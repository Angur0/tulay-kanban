import asyncio
import json
from typing import Any, List, Optional

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from fastapi import WebSocket

KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
KAFKA_TOPIC = "kanban-events"


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Error broadcasting to client: {e}")


manager = ConnectionManager()
producer: Optional[AIOKafkaProducer] = None
consumer_task: Optional[asyncio.Task] = None
storage: Any = None


async def consume_events():
    consumer = AIOKafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id="kanban-consumer-group",
        auto_offset_reset="latest",
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
    )

    try:
        await consumer.start()
        print(f"Kafka consumer started, listening to topic: {KAFKA_TOPIC}")

        async for msg in consumer:
            print(f"Consumed event: {msg.value}")
            await manager.broadcast(json.dumps(msg.value))

    except Exception as e:
        print(f"Kafka consumer error: {e}")
    finally:
        await consumer.stop()


async def publish_or_broadcast(event_data: dict):
    if producer:
        await producer.send_and_wait(KAFKA_TOPIC, event_data)
    else:
        await manager.broadcast(json.dumps(event_data))
