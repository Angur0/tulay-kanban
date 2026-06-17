<script lang="ts">
    import { onMount } from 'svelte';
    import { API_URL } from '$lib/constants';
    import { authFetch } from '$lib/api';
    import { currentUser } from '$lib/stores/user';

    let showPrompt = false;
    let newPassword = "";
    let confirmPassword = "";
    let isLoading = false;
    let errorMsg = "";
    let successMsg = "";

    onMount(() => {
        const mustChange = localStorage.getItem("must_change_password") === "true";
        const dismissedThisSession = sessionStorage.getItem("dismissed_password_prompt") === "true";

        if (mustChange && !dismissedThisSession) {
            showPrompt = true;
        }
    });

    async function handlePasswordChange() {
        errorMsg = "";
        successMsg = "";

        if (newPassword.length < 6) {
            errorMsg = "Password must be at least 6 characters long";
            return;
        }

        if (newPassword !== confirmPassword) {
            errorMsg = "Passwords do not match";
            return;
        }

        isLoading = true;
        try {
            const res = await authFetch(`${API_URL}/api/auth/me`, {
                method: 'PUT',
                body: JSON.stringify({
                    password: newPassword
                })
            });

            if (!res?.ok) {
                const data = await res?.json().catch(() => ({}));
                throw new Error(data?.detail || "Failed to update password");
            }

            // Password updated successfully
            successMsg = "Password updated successfully!";
            localStorage.removeItem("must_change_password");
            
            // Update current user store if possible
            if ($currentUser) {
                $currentUser.must_change_password = false;
            }

            setTimeout(() => {
                showPrompt = false;
            }, 1500);

        } catch (e: any) {
            errorMsg = e.message;
        } finally {
            isLoading = false;
        }
    }

    function skipForNow() {
        sessionStorage.setItem("dismissed_password_prompt", "true");
        showPrompt = false;
    }
</script>

{#if showPrompt}
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-display">
        <div class="bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <!-- Warning Banner -->
            <div class="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-4">
                <span class="material-symbols-outlined text-3xl">warning</span>
                <h3 class="text-lg font-bold text-[#111418] dark:text-white">Security Update Required</h3>
            </div>
            
            <p class="text-sm text-[#5c6b7f] dark:text-gray-400 mb-6 leading-relaxed">
                You are currently using a default or temporary password. For the security of your account, please set a new password.
            </p>

            <form on:submit|preventDefault={handlePasswordChange} class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-2">New Password</label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a98a8]">
                            <span class="material-symbols-outlined text-[18px]">lock</span>
                        </span>
                        <input 
                            type="password" 
                            bind:value={newPassword}
                            required
                            placeholder="Min 6 characters" 
                            class="w-full pl-10 pr-4 py-2.5 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary transition-all text-sm"
                        />
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-2">Confirm New Password</label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a98a8]">
                            <span class="material-symbols-outlined text-[18px]">lock</span>
                        </span>
                        <input 
                            type="password" 
                            bind:value={confirmPassword}
                            required
                            placeholder="Repeat password" 
                            class="w-full pl-10 pr-4 py-2.5 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary transition-all text-sm"
                        />
                    </div>
                </div>

                {#if errorMsg}
                    <p class="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">error</span>
                        {errorMsg}
                    </p>
                {/if}

                {#if successMsg}
                    <p class="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                        <span class="material-symbols-outlined text-[14px]">check_circle</span>
                        {successMsg}
                    </p>
                {/if}

                <div class="flex items-center justify-end gap-3 pt-4 border-t border-[#e5e7eb] dark:border-[#1e2936]">
                    <button 
                        type="button" 
                        on:click={skipForNow}
                        disabled={isLoading}
                        class="px-4 py-2 border border-[#e5e7eb] dark:border-[#1e2936] text-[#5c6b7f] dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold rounded-lg text-sm transition-all"
                    >
                        Skip for now
                    </button>
                    <button 
                        type="submit"
                        disabled={isLoading}
                        class="px-4 py-2 bg-primary hover:bg-blue-600 text-white font-semibold rounded-lg text-sm transition-all flex items-center gap-2"
                    >
                        {#if isLoading}
                            <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                            Updating...
                        {:else}
                            Save Password
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}
