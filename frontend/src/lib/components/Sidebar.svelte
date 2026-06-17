<script lang="ts">
    import { currentUser } from "$lib/stores/user";
    import {
        isSidebarCollapsed,
        isDarkMode,
        activeView,
        toggleSidebar,
        toggleTheme,
        switchView,
        openModal,
        isMobileSidebarOpen,
        closeMobileSidebar,
    } from "$lib/stores/ui";
    import {
        boards,
        activeBoardId,
        setActiveBoardId,
        setDeleteBoardTarget,
    } from "$lib/stores/board";
    import { normalizeBoardIcon } from "$lib/constants";
    import { openContextMenu } from "$lib/stores/context-menu";

    function handleLogout() {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
    }

    function selectBoard(boardId: string) {
        setActiveBoardId(boardId);
        closeMobileSidebar();
    }

    function selectView(view: "board" | "my-tasks" | "admin") {
        switchView(view);
        closeMobileSidebar();
    }

    function openResponsiveModal(modalId: string) {
        openModal(modalId);
        closeMobileSidebar();
    }

    function handleBoardContextMenu(
        event: MouseEvent,
        boardId: string,
        boardName: string,
    ) {
        event.preventDefault();
        event.stopPropagation();
        openContextMenu({
            type: "board",
            x: event.clientX,
            y: event.clientY,
            boardId,
            boardName,
        });
    }

    function handleDeleteBoard(event: MouseEvent, boardId: string) {
        event.preventDefault();
        event.stopPropagation();

        const board = $boards.find((item) => item.id === boardId);
        if (!board) return;

        setDeleteBoardTarget(board);
        openModal("deleteBoardModal");
    }

    function handleMouseEnter(event: MouseEvent) {
        const item = event.currentTarget as HTMLElement;
        const scrollContainer = item.querySelector('.board-name-scroll-container') as HTMLElement;
        const innerSpan = item.querySelector('.board-name-scroll-inner') as HTMLElement;
        if (scrollContainer && innerSpan) {
            const overflow = innerSpan.scrollWidth - scrollContainer.clientWidth;
            if (overflow > 0) {
                innerSpan.style.setProperty('--board-name-overflow', `-${overflow}px`);
                innerSpan.classList.add('is-overflowing');
            }
        }
    }

    function handleMouseLeave(event: MouseEvent) {
        const item = event.currentTarget as HTMLElement;
        const innerSpan = item.querySelector('.board-name-scroll-inner') as HTMLElement;
        if (innerSpan) {
            innerSpan.classList.remove('is-overflowing');
            innerSpan.style.removeProperty('--board-name-overflow');
        }
    }
</script>

<aside
    id="sidebar"
    class="w-[210px] flex-shrink-0 bg-[#fbfcfd] dark:bg-[#151e29] flex flex-col justify-between h-full z-20 transition-[width] duration-300 ease-in-out"
    class:collapsed={$isSidebarCollapsed}
    class:mobile-open={$isMobileSidebarOpen}
>
    <div class="flex flex-col p-4 gap-6 flex-1 min-h-0">
        <!-- App Header -->
        <div class="flex items-center gap-3 px-2 sidebar-header">
            <button
                on:click={toggleSidebar}
                class="flex items-center justify-center size-8 rounded-lg bg-primary text-white shadow-sm flex-shrink-0 hover:bg-blue-600 transition-colors"
                data-sidebar-tooltip="Toggle Sidebar"
            >
                <span class="material-symbols-outlined text-xl"
                    >developer_board</span
                >
            </button>
            <h1
                class="text-base font-semibold tracking-tight text-[#111418] dark:text-white whitespace-nowrap sidebar-text"
            >
                Tulay Kanban
            </h1>
        </div>

        <!-- Boards Section -->
        <div
            class="flex flex-col gap-2 sidebar-section boards-section flex-1 min-h-0"
        >
            <div class="flex items-center justify-between px-3 flex-shrink-0">
                <p
                    class="text-xs font-semibold text-[#8a98a8] uppercase tracking-wider sidebar-text"
                >
                    Boards
                </p>
                <button
                    on:click={() => openResponsiveModal("createBoardModal")}
                    class="text-[#5c6b7f] dark:text-gray-400 hover:text-primary transition-colors flex-shrink-0"
                    title="Create Board"
                    data-sidebar-tooltip="Create Board"
                >
                    <span class="material-symbols-outlined text-[18px]"
                        >add</span
                    >
                </button>
            </div>
            <div
                id="boardList"
                class="flex-1 flex flex-col gap-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0"
            >
                {#if $boards.length === 0}
                    <div
                        class="board-list-empty px-3 py-4 text-center text-xs text-[#8a98a8]"
                    >
                        No boards yet
                    </div>
                {/if}
                {#each $boards as board}
                    <div
                        class="flex items-center gap-1 group/board board-item cursor-pointer"
                        on:click={() => selectBoard(board.id)}
                        on:contextmenu={(event) =>
                            handleBoardContextMenu(event, board.id, board.name)}
                        on:mouseenter={handleMouseEnter}
                        on:mouseleave={handleMouseLeave}
                    >
                        <a
                            href="#"
                            class="flex items-center gap-3 px-3 py-2 rounded-lg flex-1 sidebar-item transition-colors {$activeBoardId ===
                            board.id
                                ? 'bg-[#eff1f3] dark:bg-[#1e2936] text-[#111418] dark:text-white'
                                : 'text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936]'}"
                            data-sidebar-tooltip={board.name}
                        >
                            <span
                                class="material-symbols-outlined flex-shrink-0"
                                style="color: {board.icon_color || '#3b82f6'}"
                                >{normalizeBoardIcon(board.icon)}</span
                            >
                            <div class="board-name-scroll-container sidebar-text flex-1 overflow-hidden">
                                <span class="text-sm font-medium board-name-scroll-inner inline-block whitespace-nowrap">
                                    {board.name}
                                </span>
                            </div>
                        </a>
                        <!-- TODO: Delete board logic -->
                        {#if board.role !== 'viewer'}
                        <button
                            on:click={(event) =>
                                handleDeleteBoard(event, board.id)}
                            class="opacity-0 group-hover/board:opacity-100 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[#8a98a8] hover:text-red-600 transition-all sidebar-text"
                            title="Delete board"
                        >
                            <span class="material-symbols-outlined text-[16px]"
                                >delete</span
                            >
                        </button>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>

        <!-- Navigation -->
        <nav class="flex flex-col gap-1 mt-4 flex-shrink-0">
            <a
                on:click|preventDefault={() => selectView("board")}
                class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group justify-start sidebar-item {$activeView ===
                'board'
                    ? 'bg-[#eff1f3] dark:bg-[#1e2936] text-[#111418] dark:text-white'
                    : 'text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936]'}"
                data-sidebar-tooltip="Board"
                href="#"
            >
                <span
                    class="material-symbols-outlined transition-colors flex-shrink-0 {$activeView ===
                    'board'
                        ? 'text-[#5c6b7f] dark:text-gray-400 group-hover:text-primary'
                        : 'group-hover:text-primary'}">dashboard</span
                >
                <span class="text-sm font-medium sidebar-text whitespace-nowrap"
                    >Board</span
                >
            </a>
            <a
                on:click|preventDefault={() => selectView("my-tasks")}
                class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group justify-start sidebar-item {$activeView ===
                'my-tasks'
                    ? 'bg-[#eff1f3] dark:bg-[#1e2936] text-[#111418] dark:text-white'
                    : 'text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936]'}"
                data-sidebar-tooltip="My Tasks"
                href="#"
            >
                <span
                    class="material-symbols-outlined transition-colors flex-shrink-0 group-hover:text-primary"
                    >check_circle</span
                >
                <span class="text-sm font-medium sidebar-text whitespace-nowrap"
                    >My Tasks</span
                >
            </a>
            <a
                on:click|preventDefault={() => openResponsiveModal("labelManagerModal")}
                class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group justify-start sidebar-item text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] hover:text-[#111418] dark:hover:text-white"
                data-sidebar-tooltip="Labels"
                href="#"
            >
                <span
                    class="material-symbols-outlined transition-colors flex-shrink-0 group-hover:text-primary"
                    >label</span
                >
                <span class="text-sm font-medium sidebar-text whitespace-nowrap"
                    >Labels</span
                >
            </a>
            {#if $currentUser?.is_admin}
                <a
                    on:click|preventDefault={() => selectView("admin")}
                    class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group justify-start sidebar-item {$activeView ===
                    'admin'
                        ? 'bg-[#eff1f3] dark:bg-[#1e2936] text-[#111418] dark:text-white'
                        : 'text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936]'}"
                    data-sidebar-tooltip="Admin Panel"
                    href="#"
                >
                    <span
                        class="material-symbols-outlined transition-colors flex-shrink-0 group-hover:text-primary"
                        >shield</span
                    >
                    <span class="text-sm font-medium sidebar-text whitespace-nowrap"
                        >Admin Panel</span
                    >
                </a>
            {/if}
        </nav>
    </div>

    <!-- Theme Toggle, Logout & Info -->
    <div
        class="p-4 border-t border-[#e5e7eb] dark:border-[#1e2936] flex flex-col gap-1"
    >
        {#if $currentUser}
            <div class="flex items-center gap-3 px-3 py-2 w-full rounded-lg hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] text-[#111418] dark:text-white transition-colors cursor-pointer justify-start sidebar-item"
                 on:click={() => openResponsiveModal("accountSettingsModal")}
                 data-sidebar-tooltip="Account Settings">
                <div class="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {$currentUser.full_name ? $currentUser.full_name.charAt(0).toUpperCase() : $currentUser.email.charAt(0).toUpperCase()}
                </div>
                <div class="flex flex-col min-w-0 overflow-hidden sidebar-text text-left">
                    <span class="text-sm font-semibold truncate">{$currentUser.full_name || "User"}</span>
                    <span class="text-xs text-[#5c6b7f] dark:text-gray-400 truncate">{$currentUser.email}</span>
                </div>
            </div>
            
            <div class="h-px bg-[#e5e7eb] dark:bg-[#1e2936] my-1 sidebar-text"></div>
        {/if}
        
        <button
            on:click={toggleTheme}
            class="flex items-center gap-3 px-3 py-2 w-full rounded-lg hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors justify-start sidebar-item"
            data-sidebar-tooltip="Toggle Theme"
        >
            <span class="material-symbols-outlined flex-shrink-0"
                >{$isDarkMode ? "light_mode" : "dark_mode"}</span
            >
            <span class="text-sm font-medium sidebar-text whitespace-nowrap"
                >{$isDarkMode ? "Light Mode" : "Dark Mode"}</span
            >
        </button>
        <button
            on:click={handleLogout}
            class="flex items-center gap-3 px-3 py-2 w-full rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[#5c6b7f] dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors justify-start sidebar-item"
            data-sidebar-tooltip="Logout"
        >
            <span class="material-symbols-outlined flex-shrink-0">logout</span>
            <span class="text-sm font-medium sidebar-text whitespace-nowrap"
                >Logout</span
            >
        </button>
    </div>
</aside>
