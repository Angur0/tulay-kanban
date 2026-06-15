# High Priority

- [ ] Fix horizontal board scrolling when the pointer is over a list so touchpad and touch-drag gestures can pan sideways across columns without getting trapped by inner column scroll areas.
- [ ] Add a touch-friendly task move flow for board columns, since HTML5 drag and drop is unreliable on mobile and touch devices.
- [ ] Test the login, account settings, board/list/task modals, search modal, filter bar, and label/member management modals at common breakpoints: 360px, 390px, 768px, and desktop.

# Upcoming Features

- [ ] Add a responsive QA checklist or visual regression notes for the main app views once the mobile pass begins.
- [ ] Consider storing the user's preferred mobile navigation state if the drawer/bottom-nav design benefits from persistence.

# Technical Debt

- [ ] Consolidate repeated color and spacing utility classes into shared CSS variables or reusable component patterns before broad responsive edits.
- [ ] Reconcile legacy docs that still describe the older vanilla-JS/Kafka-oriented architecture with the current Svelte/WebSocket implementation.
