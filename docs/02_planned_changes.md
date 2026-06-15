# High Priority

- [ ] Test the login, account settings, board/list/task modals, search modal, filter bar, and label/member management modals at common breakpoints: 360px, 390px, 768px, and desktop.
- [ ] Implement robust frontend form validation and API feedback for the Login, Account Settings, and user registration flows.

# Upcoming Features

### Accounts Support
- [ ] Enable self-serve user registration (un-disable backend registration endpoint and add frontend validation).
- [ ] Add password change and reset mechanisms inside the Account Settings panel.
- [ ] Add profile avatar uploads with support for local and Cloudflare R2 storage backends.
- [ ] Implement self-serve account deletion with clean cascade/cleanup of owned workspaces, boards, and tasks.
- [ ] Add session inactivity timeouts and secure HttpOnly cookie options for JWT auth tokens.

### Testing
- [ ] Write Python backend integration tests (`pytest`) covering JWT token authentication, workspace membership authorization, and RBAC rules.
- [ ] Write frontend component unit tests for critical components: `AccountSettingsModal.svelte`, `Login/+page.svelte`, and `TaskModal.svelte`.
- [ ] Implement Playwright end-to-end (E2E) tests testing the login flow, card creation, dragging, and Gantt chart rendering over the proxied port 5173.
- [ ] Perform network reliability and latency profile testing (simulating Tailscale VPN connections) to verify WebSocket reconnection robustly handles drops.

# Technical Debt

- [ ] Consolidate repeated color and spacing utility classes into shared CSS variables or reusable component patterns before broad responsive edits.

