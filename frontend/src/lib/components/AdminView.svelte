<script lang="ts">
    import { onMount } from 'svelte';
    import { API_URL } from '$lib/constants';
    import { currentUser } from '$lib/stores/user';
    import type { AdminUser } from '$lib/types';

    let users: AdminUser[] = [];
    let searchFilter = "";
    let isLoading = false;
    let errorMsg = "";
    let successMsg = "";

    // Temporary Password Modal state
    let showTempPwModal = false;
    let tempPwUser = "";
    let generatedTempPw = "";

    // Confirm Delete Modal state
    let showDeleteModal = false;
    let deleteUserId = "";
    let deleteUserEmail = "";

    // Manage Ban/Timeout state
    let selectedUserForBan: AdminUser | null = null;
    let banForever = false;
    let banUntilDate = "";

    let maintenanceMode = false;
    let maintenanceStart = "";
    let maintenanceEnd = "";
    let isSavingSettings = false;

    onMount(async () => {
        await fetchUsers();
        await fetchSettings();
    });

    async function fetchSettings() {
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${API_URL}/api/admin/settings`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                maintenanceMode = data.maintenance_mode;
                if (data.maintenance_start) {
                    maintenanceStart = formatUTCForInput(data.maintenance_start);
                } else {
                    maintenanceStart = "";
                }
                if (data.maintenance_end) {
                    maintenanceEnd = formatUTCForInput(data.maintenance_end);
                } else {
                    maintenanceEnd = "";
                }
            }
        } catch (e: any) {
            console.error("Failed to load settings:", e);
        }
    }

    function formatUTCForInput(utcString: string): string {
        const d = new Date(utcString);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    async function saveSettings() {
        isSavingSettings = true;
        errorMsg = "";
        successMsg = "";
        try {
            const token = localStorage.getItem('access_token');
            const payload = {
                maintenance_mode: maintenanceMode,
                maintenance_start: maintenanceStart ? new Date(maintenanceStart).toISOString() : null,
                maintenance_end: maintenanceEnd ? new Date(maintenanceEnd).toISOString() : null
            };

            const res = await fetch(`${API_URL}/api/admin/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to update settings");
            }

            successMsg = "System settings updated successfully.";
            await fetchSettings();
        } catch (e: any) {
            errorMsg = e.message;
        } finally {
            isSavingSettings = false;
        }
    }

    async function fetchUsers() {
        isLoading = true;
        errorMsg = "";
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${API_URL}/api/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error("Failed to load users");
            users = await res.json();
        } catch (e: any) {
            errorMsg = e.message;
        } finally {
            isLoading = false;
        }
    }

    // Generate random 10-char password
    function generateRandomPassword() {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let pw = "";
        for (let i = 0; i < 10; i++) {
            pw += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pw;
    }

    async function resetPassword(user: AdminUser) {
        const newPassword = generateRandomPassword();
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${API_URL}/api/admin/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    password: newPassword
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to reset password");
            }

            tempPwUser = user.email;
            generatedTempPw = newPassword;
            showTempPwModal = true;
            successMsg = `Password reset for ${user.email}`;
            await fetchUsers();
        } catch (e: any) {
            errorMsg = e.message;
        }
    }

    function openBanModal(user: AdminUser) {
        selectedUserForBan = user;
        banForever = user.is_banned && !user.ban_until;
        if (user.ban_until) {
            // format to YYYY-MM-DD
            banUntilDate = new Date(user.ban_until).toISOString().split('T')[0];
        } else {
            banUntilDate = "";
        }
    }

    async function saveBanSettings() {
        if (!selectedUserForBan) return;
        try {
            const token = localStorage.getItem('access_token');
            let bodyData: any = {
                is_banned: banForever,
                ban_until: null
            };

            if (!banForever && banUntilDate) {
                // Parse date at start of day UTC
                const dateObj = new Date(banUntilDate);
                bodyData.ban_until = dateObj.toISOString();
                bodyData.is_banned = false;
            } else if (!banForever) {
                bodyData.is_banned = false;
                bodyData.ban_until = null;
            }

            const res = await fetch(`${API_URL}/api/admin/users/${selectedUserForBan.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(bodyData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to update ban settings");
            }

            successMsg = `Updated status for ${selectedUserForBan.email}`;
            selectedUserForBan = null;
            await fetchUsers();
        } catch (e: any) {
            errorMsg = e.message;
        }
    }

    function openDeleteModal(user: AdminUser) {
        deleteUserId = user.id;
        deleteUserEmail = user.email;
        showDeleteModal = true;
    }

    async function confirmDeleteUser() {
        if (!deleteUserId) return;
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${API_URL}/api/admin/users/${deleteUserId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to delete user");
            }

            successMsg = `User ${deleteUserEmail} has been deleted`;
            showDeleteModal = false;
            deleteUserId = "";
            deleteUserEmail = "";
            await fetchUsers();
        } catch (e: any) {
            errorMsg = e.message;
        }
    }

    function isUserBanned(user: AdminUser) {
        if (user.is_banned) return true;
        if (user.ban_until) {
            return new Date(user.ban_until) > new Date();
        }
        return false;
    }

    function getBanText(user: AdminUser) {
        if (user.is_banned) return "Banned (Forever)";
        if (user.ban_until) {
            const dateStr = new Date(user.ban_until).toLocaleDateString();
            return `Suspended until ${dateStr}`;
        }
        return "Active";
    }

    $: filteredUsers = users.filter(user => 
        user.full_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        user.email.toLowerCase().includes(searchFilter.toLowerCase())
    );
</script>

<div class="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full font-display">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
            <h1 class="text-3xl font-extrabold tracking-tight text-[#111418] dark:text-white mb-2">User Administration</h1>
            <p class="text-sm text-[#5c6b7f] dark:text-gray-400">Manage accounts, reset passwords, suspend or delete users</p>
        </div>

        <div class="relative w-full md:w-80">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a98a8]">
                <span class="material-symbols-outlined text-[20px]">search</span>
            </span>
            <input 
                type="text" 
                bind:value={searchFilter}
                placeholder="Search by name or email..." 
                class="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            />
        </div>
    </div>

    <!-- System Settings & Maintenance Mode Card -->
    <div class="mb-8 bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-xl p-6 shadow-sm">
        <div class="flex items-center gap-3 mb-6">
            <span class="material-symbols-outlined text-primary text-[28px]">settings_system_daydream</span>
            <div>
                <h2 class="text-xl font-bold text-[#111418] dark:text-white">System Maintenance Settings</h2>
                <p class="text-xs text-[#5c6b7f] dark:text-gray-400">Toggle emergency maintenance mode or schedule future downtime</p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            <!-- Toggle column -->
            <div class="bg-[#fbfcfd] dark:bg-[#0d141c] p-4 rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] flex flex-col justify-center min-h-[92px]">
                <label class="flex items-center gap-3 cursor-pointer group">
                    <input 
                        type="checkbox" 
                        bind:checked={maintenanceMode}
                        class="size-5 text-primary border-[#e5e7eb] dark:border-[#1e2936] rounded focus:ring-primary focus:ring-opacity-25 cursor-pointer"
                    />
                    <div>
                        <p class="font-bold text-[#111418] dark:text-white text-sm">Emergency Mode</p>
                        <p class="text-[11px] text-[#5c6b7f] dark:text-gray-400">Instantly lock out all non-admin users.</p>
                    </div>
                </label>
                
                {#if maintenanceMode}
                    <div class="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium pt-2">
                        <span class="material-symbols-outlined text-[16px] animate-[pulse_1.5s_infinite]">warning</span>
                        Active immediately upon saving
                    </div>
                {/if}
            </div>

            <!-- Start Date -->
            <div class="bg-[#fbfcfd] dark:bg-[#0d141c] p-4 rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] flex flex-col justify-center min-h-[92px]">
                <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 mb-1.5">Scheduled Start (Local Time)</label>
                <input 
                    type="datetime-local" 
                    bind:value={maintenanceStart}
                    class="w-full px-3 py-2 bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary transition-all text-xs"
                />
            </div>

            <!-- End Date -->
            <div class="bg-[#fbfcfd] dark:bg-[#0d141c] p-4 rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] flex flex-col justify-center min-h-[92px]">
                <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 mb-1.5">Scheduled End (Local Time)</label>
                <input 
                    type="datetime-local" 
                    bind:value={maintenanceEnd}
                    class="w-full px-3 py-2 bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary transition-all text-xs"
                />
            </div>
        </div>

        <div class="mt-6 pt-4 border-t border-[#e5e7eb] dark:border-[#1e2936] flex justify-end gap-3">
            {#if maintenanceStart || maintenanceEnd}
                <button 
                    on:click={() => { maintenanceStart = ""; maintenanceEnd = ""; }}
                    class="px-4 py-2 border border-[#e5e7eb] dark:border-[#1e2936] text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all"
                >
                    Clear Schedule
                </button>
            {/if}
            <button 
                on:click={saveSettings}
                disabled={isSavingSettings}
                class="px-5 py-2 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
            >
                {#if isSavingSettings}
                    <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    Saving...
                {:else}
                    <span class="material-symbols-outlined text-[16px]">save</span>
                    Save System Settings
                {/if}
            </button>
        </div>
    </div>

    <!-- Feedback Messages -->
    {#if errorMsg}
        <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[20px]">error</span>
                <span>{errorMsg}</span>
            </div>
            <button on:click={() => errorMsg = ""} class="text-red-400 hover:text-red-600">
                <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
        </div>
    {/if}

    {#if successMsg}
        <div class="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-600 dark:text-emerald-400 text-sm flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[20px]">check_circle</span>
                <span>{successMsg}</span>
            </div>
            <button on:click={() => successMsg = ""} class="text-emerald-400 hover:text-emerald-600">
                <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
        </div>
    {/if}

    <!-- Table/Grid Card -->
    <div class="bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-xl overflow-hidden shadow-sm">
        {#if isLoading}
            <div class="p-12 flex flex-col items-center justify-center text-[#8a98a8]">
                <span class="material-symbols-outlined text-4xl animate-spin mb-4 text-primary">progress_activity</span>
                <p class="text-sm">Fetching user records...</p>
            </div>
        {:else if filteredUsers.length === 0}
            <div class="p-12 text-center text-[#8a98a8]">
                <span class="material-symbols-outlined text-4xl mb-4 opacity-30">group_off</span>
                <p class="text-sm">No users found matching filter.</p>
            </div>
        {:else}
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-[#fbfcfd] dark:bg-[#0d141c] border-b border-[#e5e7eb] dark:border-[#1e2936]">
                            <th class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#5c6b7f] dark:text-gray-400">User</th>
                            <th class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#5c6b7f] dark:text-gray-400">Role</th>
                            <th class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#5c6b7f] dark:text-gray-400">Status</th>
                            <th class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#5c6b7f] dark:text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#e5e7eb] dark:divide-[#1e2936]">
                        {#each filteredUsers as user (user.id)}
                            <tr class="hover:bg-gray-50/50 dark:hover:bg-[#0d141c]/40 transition-colors">
                                <!-- User Identity -->
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-3">
                                        <div class="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                            {user.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div class="text-sm font-semibold text-[#111418] dark:text-white flex items-center gap-1.5">
                                                {user.full_name}
                                                {#if user.id === $currentUser?.id}
                                                    <span class="px-1.5 py-0.5 text-[10px] font-bold bg-[#f3f4f6] dark:bg-gray-800 text-gray-500 rounded">You</span>
                                                {/if}
                                            </div>
                                            <div class="text-xs text-[#5c6b7f] dark:text-gray-400">{user.email}</div>
                                        </div>
                                    </div>
                                </td>

                                <!-- Role Badge -->
                                <td class="px-6 py-4 whitespace-nowrap">
                                    {#if user.is_admin}
                                        <span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-full">
                                            <span class="material-symbols-outlined text-[14px]">shield</span>
                                            Admin
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-full">
                                            Member
                                        </span>
                                    {/if}
                                </td>

                                <!-- Status Badge -->
                                <td class="px-6 py-4 whitespace-nowrap">
                                    {#if isUserBanned(user)}
                                        <span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full" title={getBanText(user)}>
                                            <span class="material-symbols-outlined text-[14px]">block</span>
                                            {user.ban_until ? 'Suspended' : 'Banned'}
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full">
                                            <span class="material-symbols-outlined text-[14px]">check_circle</span>
                                            Active
                                        </span>
                                    {/if}
                                </td>

                                <!-- Actions -->
                                <td class="px-6 py-4 whitespace-nowrap text-right">
                                    {#if user.id !== $currentUser?.id}
                                        <div class="flex items-center justify-end gap-2">
                                            <button 
                                                on:click={() => openBanModal(user)}
                                                class="px-2.5 py-1.5 text-xs font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-all flex items-center gap-1"
                                                title="Suspend or Ban user"
                                            >
                                                <span class="material-symbols-outlined text-[16px]">block</span>
                                                Status
                                            </button>
                                            
                                            <button 
                                                on:click={() => resetPassword(user)}
                                                class="px-2.5 py-1.5 text-xs font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded transition-all flex items-center gap-1"
                                                title="Reset password to a temporary password"
                                            >
                                                <span class="material-symbols-outlined text-[16px]">lock_reset</span>
                                                Reset PW
                                            </button>

                                            <button 
                                                on:click={() => openDeleteModal(user)}
                                                class="px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-all flex items-center gap-1"
                                                title="Permanently delete user"
                                            >
                                                <span class="material-symbols-outlined text-[16px]">delete</span>
                                                Delete
                                            </button>
                                        </div>
                                    {:else}
                                        <span class="text-xs text-[#8a98a8] italic pr-4">Self (Protected)</span>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
</div>

<!-- Password Reset Temporary Output Modal -->
{#if showTempPwModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-4">
                <span class="material-symbols-outlined text-3xl">key</span>
                <h3 class="text-lg font-bold text-[#111418] dark:text-white">Temporary Password Generated</h3>
            </div>
            <p class="text-sm text-[#5c6b7f] dark:text-gray-400 mb-4">
                A temporary password has been set for <strong class="text-[#111418] dark:text-white">{tempPwUser}</strong>. They will be forced to change it upon their next login.
            </p>
            <div class="bg-gray-50 dark:bg-[#0d141c] border border-dashed border-[#e5e7eb] dark:border-[#1e2936] rounded-lg p-4 mb-6 flex items-center justify-between">
                <code class="text-lg font-mono text-primary select-all font-semibold">{generatedTempPw}</code>
                <button 
                    on:click={() => {
                        navigator.clipboard.writeText(generatedTempPw);
                        successMsg = "Temporary password copied to clipboard";
                    }}
                    class="text-xs text-[#5c6b7f] dark:text-gray-400 hover:text-primary flex items-center gap-1"
                >
                    <span class="material-symbols-outlined text-[16px]">content_copy</span>
                    Copy
                </button>
            </div>
            <div class="flex justify-end">
                <button 
                    on:click={() => {
                        showTempPwModal = false;
                        tempPwUser = "";
                        generatedTempPw = "";
                    }} 
                    class="px-4 py-2 bg-primary hover:bg-blue-600 text-white font-semibold rounded-lg text-sm transition-all"
                >
                    Done
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Confirm Delete User Modal -->
{#if showDeleteModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
                <span class="material-symbols-outlined text-3xl">warning</span>
                <h3 class="text-lg font-bold text-[#111418] dark:text-white">Delete User Account?</h3>
            </div>
            <p class="text-sm text-[#5c6b7f] dark:text-gray-400 mb-4">
                Are you sure you want to permanently delete the user <strong class="text-[#111418] dark:text-white">{deleteUserEmail}</strong>?
            </p>
            <div class="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3 text-xs text-red-600 dark:text-red-400 mb-6 space-y-1">
                <p>• All their workspaces and boards will be deleted permanently.</p>
                <p>• Tasks assigned to them on other boards will be marked as <strong>orphaned</strong>.</p>
                <p>• This action is permanent and cannot be undone.</p>
            </div>
            <div class="flex justify-end gap-3">
                <button 
                    on:click={() => {
                        showDeleteModal = false;
                        deleteUserId = "";
                        deleteUserEmail = "";
                    }}
                    class="px-4 py-2 border border-[#e5e7eb] dark:border-[#1e2936] text-[#5c6b7f] dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold rounded-lg text-sm transition-all"
                >
                    Cancel
                </button>
                <button 
                    on:click={confirmDeleteUser}
                    class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition-all"
                >
                    Confirm Delete
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Manage Ban/Timeout Modal -->
{#if selectedUserForBan}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center gap-3 text-primary mb-4">
                <span class="material-symbols-outlined text-3xl">gavel</span>
                <h3 class="text-lg font-bold text-[#111418] dark:text-white">Account Suspension Settings</h3>
            </div>
            <p class="text-sm text-[#5c6b7f] dark:text-gray-400 mb-6">
                Suspend <strong class="text-[#111418] dark:text-white">{selectedUserForBan.email}</strong> from accessing the platform.
            </p>

            <div class="space-y-4 mb-6">
                <!-- Forever Toggle -->
                <label class="flex items-center gap-3 cursor-pointer group">
                    <input 
                        type="checkbox" 
                        bind:checked={banForever}
                        class="size-4 text-primary border-[#e5e7eb] dark:border-[#1e2936] rounded focus:ring-primary focus:ring-opacity-25"
                    />
                    <div class="text-sm">
                        <p class="font-semibold text-[#111418] dark:text-white">Suspend Forever (Ban)</p>
                        <p class="text-xs text-[#5c6b7f] dark:text-gray-400">Completely block this user indefinitely.</p>
                    </div>
                </label>

                <!-- Timeout Picker -->
                {#if !banForever}
                    <div class="pt-4 border-t border-[#e5e7eb] dark:border-[#1e2936]">
                        <label class="block text-sm font-semibold text-[#111418] dark:text-white mb-2">Suspend Until Date</label>
                        <input 
                            type="date" 
                            bind:value={banUntilDate}
                            min={new Date().toISOString().split('T')[0]}
                            class="w-full px-3 py-2 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary transition-all text-sm"
                        />
                        <p class="text-xs text-[#5c6b7f] dark:text-gray-400 mt-2">Leave blank to lift the suspension.</p>
                    </div>
                {/if}
            </div>

            <div class="flex justify-end gap-3">
                <button 
                    on:click={() => selectedUserForBan = null}
                    class="px-4 py-2 border border-[#e5e7eb] dark:border-[#1e2936] text-[#5c6b7f] dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold rounded-lg text-sm transition-all"
                >
                    Cancel
                </button>
                <button 
                    on:click={saveBanSettings}
                    class="px-4 py-2 bg-primary hover:bg-blue-600 text-white font-semibold rounded-lg text-sm transition-all"
                >
                    Save Changes
                </button>
            </div>
        </div>
    </div>
{/if}
