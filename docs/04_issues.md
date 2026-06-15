# Active Issues

- None currently tracked.

# Resolved Issues

- [2026-06-15-tailscale-port-access]: Page accessible with local IP but not with Tailscale IP. (Resolved by proxying backend traffic through the Vite dev server on port 5173 and exposing only port 5173, bypassing Tailscale firewall/port forwarding complexities for port 8000).
- [2026-06-15-board-scroll-touch-drag]: Board lists intercept sideways scrolling, and touch dragging of tasks between columns is unreliable on mobile. (Resolved via mobile-drag-drop polyfill and overscroll-y-contain)
- [2026-06-15-same-network-login]: Logging in from another device on the same local network or VPN gives `NetworkError` due to hardcoded API URL referencing `localhost`. (Resolved by deriving backend URL dynamically from `window.location.hostname`).
- [2026-06-15-tailscale-cors]: Mobile devices connecting via Tailscale IPs hit CORS blocks despite private IP regex. (Resolved by adding Tailscale CGNAT `100.64.0.0/10` block to the backend's allowed origins).
- [2026-06-15-mobile-uploads]: Images uploaded from one device fail to load on others because the absolute URL with the uploader's host was stored in the database. (Resolved by storing relative paths in the DB and resolving them dynamically on render).
- [2026-06-15-mobile-add-card-visibility]: The column "Add Card" button was invisible/inaccessible on smaller mobile viewports. (Resolved by moving the button inside the scrollable column task list container).
- [2026-06-15-gantt-read-only]: Gantt chart allowed task dragging and editing for all users. (Resolved by setting `readonly: true` on the Frappe Gantt instance and disabling write callbacks/labels).

