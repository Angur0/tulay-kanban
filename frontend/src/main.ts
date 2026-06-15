import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css";

polyfill({
    holdToDrag: 250
});

const app = mount(App, {
	target: document.getElementById('app')!
});

export default app;