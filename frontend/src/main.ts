/**
 * Tulay Kanban - Main Entry Point
 * Vite + TypeScript
 */

import './shared.css';
import { init } from './events.ts';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    init();
});
