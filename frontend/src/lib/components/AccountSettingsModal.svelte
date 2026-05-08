<script lang="ts">
    import { activeModal, closeModal } from "$lib/stores/ui";
    import { currentUser, setCurrentUser } from "$lib/stores/user";
    import { authFetch } from "$lib/api";
    import { API_URL } from "$lib/constants";
    
    let fullName = "";
    let email = "";
    let password = "";
    
    let isLoading = false;
    let errorMessage = "";
    let successMessage = "";

    // Load initial values
    $: if ($activeModal === "accountSettingsModal" && $currentUser) {
        fullName = $currentUser.full_name || "";
        email = $currentUser.email || "";
        password = "";
        errorMessage = "";
        successMessage = "";
    }

    async function handleUpdate() {
        if (!fullName.trim() || !email.trim()) {
            errorMessage = "Name and email are required";
            return;
        }

        isLoading = true;
        errorMessage = "";
        successMessage = "";

        try {
            const body: any = {
                full_name: fullName,
                email: email
            };
            
            if (password) {
                body.password = password;
            }

            const response = await authFetch(`${API_URL}/api/auth/me`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || "Failed to update account");
            }

            const updatedUser = await response.json();
            setCurrentUser(updatedUser);
            successMessage = "Account updated successfully";
            password = ""; // Reset password field
            
            // Close after a brief delay on success
            setTimeout(() => {
                closeModal();
            }, 1500);
            
        } catch (error: any) {
            errorMessage = error.message;
        } finally {
            isLoading = false;
        }
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) closeModal();
    }
</script>

{#if $activeModal === "accountSettingsModal"}
    <div class="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
        <!-- svelte-ignore a11y-click-events-have-key-events bg-click -->
        <div
            class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
            on:click={handleBackdropClick}
        ></div>
        <div
            class="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        >
            <div
                class="bg-white dark:bg-[#151e29] rounded-xl shadow-2xl w-full max-w-sm overflow-visible transform transition-all border border-[#e5e7eb] dark:border-[#1e2936] pointer-events-auto flex flex-col"
            >
                <div class="p-6">
                    <div class="flex items-center gap-3 mb-4 text-primary">
                        <div
                            class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                            <span class="material-symbols-outlined text-2xl"
                                >manage_accounts</span
                            >
                        </div>
                        <h3
                            class="text-lg font-bold text-[#111418] dark:text-white"
                        >
                            Account Settings
                        </h3>
                    </div>

                    <!-- Error Message -->
                    {#if errorMessage}
                        <div
                            class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center gap-2"
                        >
                            <span class="material-symbols-outlined text-[18px]">error</span>
                            <span>{errorMessage}</span>
                        </div>
                    {/if}

                    <!-- Success Message -->
                    {#if successMessage}
                        <div
                            class="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2"
                        >
                            <span class="material-symbols-outlined text-[18px]">check_circle</span>
                            <span>{successMessage}</span>
                        </div>
                    {/if}

                    <div class="mb-4">
                        <label
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >Full Name</label
                        >
                        <input
                            type="text"
                            bind:value={fullName}
                            class="w-full px-3 py-2.5 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            placeholder="Your full name"
                        />
                    </div>
                    
                    <div class="mb-4">
                        <label
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >Email Address</label
                        >
                        <input
                            type="email"
                            bind:value={email}
                            class="w-full px-3 py-2.5 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            placeholder="you@example.com"
                        />
                    </div>
                    
                    <div class="mb-6">
                        <label
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >New Password (optional)</label
                        >
                        <input
                            type="password"
                            bind:value={password}
                            class="w-full px-3 py-2.5 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            placeholder="Leave blank to keep current"
                        />
                    </div>

                    <div class="flex justify-end gap-3 mt-auto pt-2 border-t border-[#e5e7eb] dark:border-[#1e2936] pt-4">
                        <button
                            on:click={closeModal}
                            class="px-4 py-2 text-sm font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors rounded-lg hover:bg-[#eff1f3] dark:hover:bg-[#1e2936]"
                        >
                            Cancel
                        </button>
                        <button
                            on:click={handleUpdate}
                            disabled={isLoading}
                            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-600 transition-colors rounded-lg shadow-sm disabled:opacity-50"
                        >
                            {#if isLoading}
                                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                Saving...
                            {:else}
                                Save Changes
                            {/if}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
