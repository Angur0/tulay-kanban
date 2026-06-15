<script lang="ts">
    import Sidebar from "./Sidebar.svelte";
    import Header from "./Header.svelte";
    import SearchModal from "./SearchModal.svelte";
    import { isMobileSidebarOpen, closeMobileSidebar } from "$lib/stores/ui";
    import CreateBoardModal from "./CreateBoardModal.svelte";
    import CreateListModal from "./CreateListModal.svelte";
    import TaskModal from "./TaskModal.svelte";
    import ManageMembersModal from "./ManageMembersModal.svelte";
    import ManageLabelsModal from "./ManageLabelsModal.svelte";
    import DeleteListModal from "./DeleteListModal.svelte";
    import DeleteTaskModal from "./DeleteTaskModal.svelte";
    import EditBoardModal from "./EditBoardModal.svelte";
    import DeleteBoardModal from "./DeleteBoardModal.svelte";
    import AccountSettingsModal from "./AccountSettingsModal.svelte";
    import ContextMenus from "./ContextMenus.svelte";
    import { onMount, onDestroy } from "svelte";
    import { createColumn } from "$lib/api/listsApi";
    import { createTask } from "$lib/api/tasksApi";
    import { loadColumnsAndTasks } from "$lib/api/boardDataApi";
    import {
        activeBoardId,
        activeTask,
        setActiveTask,
    } from "$lib/stores/board";
    import type { RealtimeEvent } from "$lib/types";
    import { authFetch } from "$lib/api";
    import { API_URL } from "$lib/constants";
    import {
        setCurrentUser,
        setActiveWorkspaceId,
        setCurrentBoardRole,
    } from "$lib/stores/user";
    import {
        createBoard,
        loadBoards,
        loadBoardMembers,
    } from "$lib/api/boardApi";
    import { getWorkspaces } from "$lib/api/workspaceApi";
    import { isSearchOpen, openSearch, closeSearch } from "$lib/stores/filter";

    let { children } = $props();
    let wsListener: (e: any) => void;
    let unsubscribeActiveBoard: (() => void) | null = null;
    let handleGlobalKeydown: ((e: KeyboardEvent) => void) | null = null;

    async function handleCreateBoard(
        event: CustomEvent<{ name: string; icon: string; color: string }>,
    ) {
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

        wsListener = (e: any) => {
            const event: RealtimeEvent = e.detail;
            if (
                [
                    "TASK_CREATED",
                    "TASK_UPDATED",
                    "TASK_MOVED",
                    "TASK_DELETED",
                    "COLUMN_CREATED",
                    "SUBTASK_CREATED",
                    "SUBTASK_UPDATED",
                    "SUBTASK_DELETED",
                ].includes(event.type)
            ) {
                // We're taking a simple approach: if any relevant event happens, just reload tasks/columns
                // (In a real heavy app you'd parse `event.data` and do optimistic updates strictly here)
                loadColumnsAndTasks();
            }
        };
        window.addEventListener("ws-message", wsListener);

        // Global search shortcut (Ctrl+K / ⌘K)
        handleGlobalKeydown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                if ($isSearchOpen) closeSearch();
                else openSearch();
            }
        };
        window.addEventListener("keydown", handleGlobalKeydown);
    });

    onDestroy(() => {
        if (unsubscribeActiveBoard) {
            unsubscribeActiveBoard();
            unsubscribeActiveBoard = null;
        }

        if (typeof window !== "undefined") {
            if (wsListener) window.removeEventListener("ws-message", wsListener);
            if (handleGlobalKeydown) window.removeEventListener("keydown", handleGlobalKeydown);
        }

        setActiveTask(null);
    });
</script>

<div
    class="app-shell flex h-screen w-full bg-background-light dark:bg-background-dark text-[#111418] dark:text-white font-display overflow-hidden"
>
    <Sidebar />
    {#if $isMobileSidebarOpen}
        <button
            type="button"
            class="mobile-sidebar-backdrop fixed inset-0 z-[55] bg-slate-950/45 backdrop-blur-[2px] md:hidden"
            on:click={closeMobileSidebar}
            aria-label="Close navigation"
        ></button>
    {/if}
    <main
        class="responsive-main flex-1 flex flex-col h-full overflow-hidden bg-[#fbfcfd] dark:bg-[#151e29] relative"
    >
        <Header />
        <div class="flex-1 flex flex-col relative overflow-hidden">
            {@render children()}
            <TaskModal task={$activeTask} />
        </div>
    </main>
    <CreateBoardModal on:create={handleCreateBoard} />
    <CreateListModal on:create={handleCreateList} />
    <DeleteListModal />
    <DeleteTaskModal />
    <EditBoardModal />
    <DeleteBoardModal />
    <ManageMembersModal />
    <ManageLabelsModal />
    <AccountSettingsModal />
    <ContextMenus />
    {#if $isSearchOpen}
        <SearchModal />
    {/if}
</div>
