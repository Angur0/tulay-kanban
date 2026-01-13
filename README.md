# Tulay Kanban

A modern, real-time Kanban board powered by **Apache Kafka** and **FastAPI**. Features a sleek, Superthread-style design with live event streaming and real-time synchronization.

![Tulay Kanban Board](https://img.shields.io/badge/Status-Active-green)

## Features

- **Kanban Board** - Three-column layout for task management (To Do, In Progress, Done).
- **Kafka Activity Stream** - A dedicated global feed of all task events (creation, movements, updates, deletions).
- **Real-time Sync** - WebSocket-powered updates across multiple clients.
- **Drag & Drop** - Smooth reordering and column-to-column movement with visual indicators.
- **Inline Card Creation** - Quick add cards directly in each column for high-speed workflow.
- **Side Panel Editor** - Comprehensive task management in a sleek slide-out panel, including a per-task Kafka event log.
- **Light/Dark Mode** - Full theme support with persistent preferences.
- **Persistence** - Hybrid storage using local browser storage and Kafka event log.

## Tech Stack

- **Frontend**: Vanilla JavaScript, Tailwind CSS (via CDN), Semantic HTML5.
- **Backend**: FastAPI (Python) for asynchronous event handling and WebSocket broadcasting.
- **Streaming**: Apache Kafka for distributed event logging and real-time messaging.
- **Containerization**: Docker & Docker Compose for easy service orchestration.

## Getting Started

### 1. Prerequisites
- Docker & Docker Compose
- Python 3.9+

### 2. Setup Services
Start the Kafka broker using Docker:
```bash
docker compose up -d
```

### 3. Setup Python Backend
Install dependencies and run the FastAPI server:
```bash
pip install -r requirements.txt
python main.py
```

### 4. Open Application
Visit `http://localhost:8000` to start using Tulay Kanban.

## Project Structure

```
tulay-kanban/
├── main.py             # FastAPI backend with Kafka producer/consumer
├── app.js              # Frontend logic (State, UI rendering, WebSockets)
├── index.html          # Single-page application UI
├── docker-compose.yml  # Kafka & Zookeeper configuration
├── requirements.txt    # Python dependencies
└── README.md
```

## Usage

- **Manage Tasks** - Click "Add Card" for inline creation or click existing cards to edit details.
- **Move tasks** - Drag and drop cards across columns to trigger Kafka `TASK_MOVED` events.
- **View Activity** - Click **"Activity"** in the sidebar to view the global event stream and real-time Kafka notifications.
- **Toggle Theme** - Use the dark/light mode toggle in the bottom-left corner of the sidebar.

## Future Roadmap

- [x] Kafka producer/consumer integration
- [x] Real-time sync across clients
- [ ] User authentication and team spaces
- [ ] Multiple boards and workspace management
- [ ] Task comments and attachments
- [ ] Advanced labels and filtering

## License

MIT License - Feel free to use and modify.
