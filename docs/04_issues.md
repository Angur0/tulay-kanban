# Active Issues

- [2026-06-15-postgres-unavailable]: Backend startup fails because PostgreSQL is not reachable in the current environment. Reproduction: run `source venv/bin/activate && python main.py`; SQLAlchemy raises `psycopg2.OperationalError` while connecting to `postgresql://user:password@localhost:5432/kanban`. Attempted workaround: `docker compose up -d`, but Docker socket access is denied in this sandboxed session.
- [2026-06-15-board-scroll-touch-drag]: Board lists intercept sideways scrolling, and touch dragging of tasks between columns is unreliable on mobile. Reproduction: open the board view, place the pointer/finger over a column list, and try to pan horizontally; then try dragging a task card between columns on a touch device. Current theory: the vertical list scrollers and HTML5 drag/drop handlers are capturing the interaction path; likely workaround is a dedicated touch/pointer move mode or drag handle plus scroll gesture passthrough.

# Resolved Issues

- None currently tracked.
