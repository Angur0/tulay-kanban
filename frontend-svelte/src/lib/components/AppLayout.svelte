<script lang="ts">
    import Sidebar from "./Sidebar.svelte";
    import Header from "./Header.svelte";
    import { isSidebarCollapsed } from "$lib/stores/ui";
    import CreateBoardModal from "./CreateBoardModal.svelte";
    import CreateListModal from "./CreateListModal.svelte";
    import TaskModal from "./TaskModal.svelte";
    import ManageMembersModal from "./ManageMembersModal.svelte";
    import { onMount, onDestroy } from "svelte";
    import { loadColumnsAndTasks } from "$lib/api/taskApi";
    import type { KafkaEvent } from "$lib/types";
    import { authFetch } from "$lib/api";
    import { API_URL } from "$lib/constants";
    import { setCurrentUser, setActiveWorkspaceId } from "$lib/stores/user";
    import { loadBoards } from "$lib/api/boardApi";

    let { children } = $props();
    let kafkaListener: (e: any) => void;

    onMount(async () => {
        // Initialize app data
        try {
            const userRes = await authFetch(`${API_URL}/api/auth/me`);
            if (userRes && userRes.ok) {
                const user = await userRes.json();
                setCurrentUser(user);
            }

            const wsRes = await authFetch(`${API_URL}/api/workspaces`);
            if (wsRes && wsRes.ok) {
                const workspaces = await wsRes.json();
                if (workspaces.length > 0) {
                    setActiveWorkspaceId(workspaces[0].id);
                    await loadBoards();
                }
            }
        } catch (e) {
            console.error("Failed to initialize app data", e);
        }

        kafkaListener = (e: any) => {
            const event: KafkaEvent = e.detail;
            if (
                [
                    "TASK_CREATED",
                    "TASK_UPDATED",
                    "TASK_MOVED",
                    "TASK_DELETED",
                    "COLUMN_CREATED",
                ].includes(event.type)
            ) {
                // We're taking a simple approach: if any relevant event happens, just reload tasks/columns
                // (In a real heavy app you'd parse `event.data` and do optimistic updates strictly here)
                loadColumnsAndTasks();
            }
        };
        window.addEventListener("kafka-message", kafkaListener);
    });

    onDestroy(() => {
        if (typeof window !== "undefined" && kafkaListener) {
            window.removeEventListener("kafka-message", kafkaListener);
        }
    });
</script>

<div
    class="flex h-screen w-full bg-background-light dark:bg-background-dark text-[#111418] dark:text-white font-display overflow-hidden"
>
    <Sidebar />
    <main
        class="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-background-dark relative"
    >
        <Header />
        {@render children()}
    </main>
    <CreateBoardModal />
    <CreateListModal />
    <TaskModal />
    <ManageMembersModal />
</div>
