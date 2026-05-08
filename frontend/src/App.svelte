<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import HomePage from './routes/+page.svelte';
	import LoginPage from './routes/login/+page.svelte';

	let path = window.location.pathname;

	const syncPath = () => {
		path = window.location.pathname;
	};

	onMount(() => {
		window.addEventListener('popstate', syncPath);
		window.addEventListener('hashchange', syncPath);

		return () => {
			window.removeEventListener('popstate', syncPath);
			window.removeEventListener('hashchange', syncPath);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if path === '/login'}
	<LoginPage />
{:else}
	<HomePage />
{/if}