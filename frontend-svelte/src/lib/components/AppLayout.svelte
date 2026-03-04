<script lang="ts">
    import Sidebar from "./Sidebar.svelte";
    import Header from "./Header.svelte";
    import { isSidebarCollapsed } from "$lib/stores/ui";
    import CreateBoardModal from "./CreateBoardModal.svelte";
    import CreateListModal from "./CreateListModal.svelte";
    import CreateTaskModal from "./CreateTaskModal.svelte";
    import TaskModal from "./TaskModal.svelte";
    import ManageMembersModal from "./ManageMembersModal.svelte";
    import DeleteListModal from "./DeleteListModal.svelte";
    import EditBoardModal from "./EditBoardModal.svelte";
    import DeleteBoardModal from "./DeleteBoardModal.svelte";
    import ContextMenus from "./ContextMenus.svelte";
    import { onMount, onDestroy } from "svelte";
    import { createColumn } from "$lib/api/listsApi";
    import { createTask } from "$lib/api/tasksApi";
    import { loadColumnsAndTasks } from "$lib/api/boardDataApi";
    import { activeBoardId, activeTask, setActiveTask } from "$lib/stores/board";
    import type { KafkaEvent } from "$lib/types";
    import { authFetch } from "$lib/api";
    import { API_URL } from "$lib/constants";
    import { setCurrentUser, setActiveWorkspaceId, setCurrentBoardRole } from "$lib/stores/user";
    import { createBoard, loadBoards, loadBoardMembers } from "$lib/api/boardApi";
    import { getWorkspaces } from "$lib/api/workspaceApi";

    let { children } = $props();
    let kafkaListener: (e: any) => void;
    let unsubscribeActiveBoard: (() => void) | null = null;

    async function handleCreateBoard(event: CustomEvent<{ name: string; icon: string; color: string }>) {
        const payload = event.detail;
        if (!payload?.name?.trim()) return;

        try {
            await createBoard(payload.name, payload.icon, payload.color);
        } catch (e) {
            console.error("Failed to create board", e);
        }
    }

    async function handleCreateList(event: CustomEvent<{ title: string }>) {
        const title = event.detail?.title?.trim();
        if (!title) return;

        try {
            await createColumn(title);
            await loadColumnsAndTasks();
        } catch (e) {
            console.error("Failed to create list", e);
        }
    }

    async function handleCreateTask(event: CustomEvent<{ title: string; columnId: string }>) {
        const title = event.detail?.title?.trim();
        const columnId = event.detail?.columnId;
        if (!title || !columnId) return;

        try {
            await createTask(columnId, title);
            await loadColumnsAndTasks();
        } catch (e) {
            console.error("Failed to create task", e);
        }
    }

    onMount(async () => {
        unsubscribeActiveBoard = activeBoardId.subscribe((id) => {
            if (id) {
                loadColumnsAndTasks();
                loadBoardMembers();
            } else {
                setCurrentBoardRole("viewer");
            }
        });

        // Initialize app data
        try {
            const userRes = await authFetch(`${API_URL}/api/auth/me`);
            if (userRes && userRes.ok) {
                const user = await userRes.json();
                setCurrentUser(user);
            }

            const workspaces = await getWorkspaces();
            if (workspaces.length > 0) {
                setActiveWorkspaceId(workspaces[0].id);
                await loadBoards();
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
        if (unsubscribeActiveBoard) {
            unsubscribeActiveBoard();
            unsubscribeActiveBoard = null;
        }

        if (typeof window !== "undefined" && kafkaListener) {
            window.removeEventListener("kafka-message", kafkaListener);
        }

        setActiveTask(null);
    });
</script>

<div
    class="flex h-screen w-full bg-background-light dark:bg-background-dark text-[#111418] dark:text-white font-display overflow-hidden"
>
    <Sidebar />
    <main
        class="flex-1 flex flex-col h-full overflow-hidden bg-[#fbfcfd] dark:bg-[#151e29] relative"
    >
        <Header />
        {@render children()}
    </main>
    <CreateBoardModal on:create={handleCreateBoard} />
    <CreateListModal on:create={handleCreateList} />
    <CreateTaskModal on:create={handleCreateTask} />
    <DeleteListModal />
    <EditBoardModal />
    <DeleteBoardModal />
    <TaskModal task={$activeTask} />
    <ManageMembersModal />
    <ContextMenus />
</div>
