<script lang="ts">
    import { activeModal, closeModal } from "$lib/stores/ui";
    import { boardMembers } from "$lib/stores/board";
    import { currentBoardRole } from "$lib/stores/user";

    let emailInput = "";
    let isAdding = false;
    let addError: string | null = null;

    $: canManage = ["owner", "moderator"].includes($currentBoardRole);

    async function handleAddMember(e: Event) {
        e.preventDefault();
        if (!emailInput.trim() || !canManage) return;

        isAdding = true;
        addError = null;

        try {
            // API logic would be dispatched here
            emailInput = "";
        } catch (err: any) {
            addError = err.message || "Failed to add member";
        } finally {
            isAdding = false;
        }
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) closeModal();
    }
</script>

{#if $activeModal === "manageMembersModal"}
    <div class="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
        <!-- svelte-ignore a11y-click-events-have-key-events bg-click -->
        <div
            class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
            on:click={handleBackdropClick}
        ></div>

        <div
            class="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        >
            <div
                class="bg-white dark:bg-[#151e29] rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-[#e5e7eb] dark:border-[#1e2936] pointer-events-auto flex flex-col max-h-[85vh]"
            >
                <div
                    class="flex items-center justify-between p-6 border-b border-[#e5e7eb] dark:border-[#1e2936]"
                >
                    <div class="flex items-center gap-3 text-primary">
                        <div
                            class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                            <span class="material-symbols-outlined text-2xl"
                                >group</span
                            >
                        </div>
                        <h3
                            class="text-lg font-bold text-[#111418] dark:text-white"
                        >
                            Manage Board Members
                        </h3>
                    </div>
                    <button
                        on:click={closeModal}
                        class="p-2 text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded-lg transition-colors"
                    >
                        <span class="material-symbols-outlined text-xl"
                            >close</span
                        >
                    </button>
                </div>

                <div class="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {#if canManage}
                        <form on:submit={handleAddMember} class="mb-6">
                            <label
                                for="memberEmail"
                                class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                                >Add Member</label
                            >
                            <div class="flex gap-2">
                                <input
                                    type="email"
                                    id="memberEmail"
                                    bind:value={emailInput}
                                    required
                                    placeholder="Enter email address"
                                    class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                    disabled={isAdding}
                                />
                                <button
                                    type="submit"
                                    disabled={isAdding || !emailInput.trim()}
                                    class="px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {#if isAdding}
                                        <span
                                            class="material-symbols-outlined animate-spin text-[18px]"
                                            >progress_activity</span
                                        > Adding...
                                    {:else}
                                        <span
                                            class="material-symbols-outlined text-[18px]"
                                            >person_add</span
                                        > Add
                                    {/if}
                                </button>
                            </div>
                            {#if addError}
                                <p
                                    class="mt-2 text-sm text-red-600 dark:text-red-400"
                                >
                                    {addError}
                                </p>
                            {/if}
                        </form>
                    {/if}

                    <div>
                        <h4
                            class="text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-3"
                        >
                            Current Members
                        </h4>
                        <div class="flex flex-col gap-2">
                            {#if $boardMembers.length === 0}
                                <div
                                    class="text-center py-4 text-sm text-[#8a98a8]"
                                >
                                    No members found.
                                </div>
                            {/if}
                            {#each $boardMembers as member}
                                <!-- Mock member list items -->
                                <div
                                    class="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1a232e] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936]"
                                >
                                    <div
                                        class="flex items-center gap-3 min-w-0"
                                    >
                                        <div
                                            class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm"
                                        >
                                            {(member.user.full_name ||
                                                member.user
                                                    .email)[0].toUpperCase()}
                                        </div>
                                        <div class="min-w-0">
                                            <p
                                                class="text-sm font-medium text-[#111418] dark:text-white truncate"
                                            >
                                                {member.user.full_name}
                                            </p>
                                            <p
                                                class="text-xs text-[#5c6b7f] dark:text-gray-400 truncate"
                                            >
                                                {member.user.email}
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        class="flex items-center gap-2 flex-shrink-0 ml-4"
                                    >
                                        <span
                                            class="px-2 py-1 bg-[#eff1f3] dark:bg-[#1e2936] text-[#5c6b7f] dark:text-gray-400 text-xs font-medium rounded capitalize"
                                            >{member.role}</span
                                        >
                                        {#if canManage && member.role !== "owner"}
                                            <button
                                                class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                title="Remove member"
                                            >
                                                <span
                                                    class="material-symbols-outlined text-[18px]"
                                                    >person_remove</span
                                                >
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
                <div
                    class="px-6 py-4 border-t border-[#e5e7eb] dark:border-[#1e2936] bg-gray-50 dark:bg-[#1a232e]/50 flex justify-end"
                >
                    <button
                        on:click={closeModal}
                        class="px-4 py-2 text-sm font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors rounded-lg hover:bg-[#eff1f3] dark:hover:bg-[#1e2936]"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
