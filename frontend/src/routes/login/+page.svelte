<script lang="ts">
    import { API_URL } from "$lib/constants";
    import { onMount } from "svelte";
    import { isDarkMode, toggleTheme } from "$lib/stores/ui";

    let activeTab: "login" | "register" = "login";

    // Form fields
    let loginEmail = "";
    let loginPassword = "";

    let registerName = "";
    let registerEmail = "";
    let registerPassword = "";

    // Messages
    let errorMessage = "";
    let successMessage = "";
    let isLoading = false;

    // We can't use SvelteKit's standard `goto` properly if not setup, so we fallback to window.location
    onMount(() => {
        if (localStorage.getItem("access_token")) {
            window.location.href = "/";
        }
    });

    async function handleLogin() {
        errorMessage = "";
        successMessage = "";
        isLoading = true;

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    username: loginEmail,
                    password: loginPassword,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || "Login failed");
            }

            const data = await response.json();
            localStorage.setItem("access_token", data.access_token);
            window.location.href = "/";
        } catch (error: any) {
            errorMessage = error.message;
        } finally {
            isLoading = false;
        }
    }

    async function handleRegister() {
        errorMessage = "";
        successMessage = "";
        isLoading = true;

        try {
            const response = await fetch(`${API_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: registerEmail,
                    password: registerPassword,
                    full_name: registerName,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || "Registration failed");
            }

            successMessage =
                "Account created successfully! You can now sign in.";
            activeTab = "login";
            loginEmail = registerEmail;
            loginPassword = ""; // require typing password again for safety or leave as is
        } catch (error: any) {
            errorMessage = error.message;
        } finally {
            isLoading = false;
        }
    }

    function switchTab(tab: "login" | "register") {
        errorMessage = "";
        successMessage = "";
        activeTab = tab;
    }
</script>

<div
    class="min-h-screen w-full flex items-center justify-center p-4 bg-background-light dark:bg-background-dark font-display text-[#111418] dark:text-white relative z-10"
>
    <div class="w-full max-w-md">
        <!-- Logo & Branding -->
        <div class="text-center mb-8">
            <div class="flex items-center justify-center gap-3 mb-4">
                <div
                    class="flex items-center justify-center size-12 rounded-xl bg-primary text-white"
                >
                    <span class="material-symbols-outlined text-2xl"
                        >developer_board</span
                    >
                </div>
            </div>
            <h1
                class="text-2xl font-bold text-[#111418] dark:text-white tracking-tight mb-2"
            >
                Tulay Kanban
            </h1>
            <p class="text-sm text-[#5c6b7f] dark:text-gray-400">
                Real-time task management
            </p>
        </div>

        <!-- Card -->
        <div
            class="bg-white dark:bg-[#151e29] rounded-xl border border-[#e5e7eb] dark:border-[#1e2936] overflow-hidden"
        >
            <!-- Card Header SubNav -->
            <div class="flex border-b border-[#e5e7eb] dark:border-[#1e2936]">
                <button
                    on:click={() => switchTab("login")}
                    class="flex-1 py-4 text-sm transition-colors {activeTab ===
                    'login'
                        ? 'font-semibold text-primary border-b-2 border-primary'
                        : 'font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white border-b-2 border-transparent'}"
                >
                    Sign In
                </button>
                <button
                    on:click={() => switchTab("register")}
                    class="flex-1 py-4 text-sm transition-colors {activeTab ===
                    'register'
                        ? 'font-semibold text-primary border-b-2 border-primary'
                        : 'font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white border-b-2 border-transparent'}"
                >
                    Sign Up
                </button>
            </div>

            <!-- Login Form -->
            {#if activeTab === "login"}
                <form
                    on:submit|preventDefault={handleLogin}
                    class="p-8 space-y-5"
                >
                    <div>
                        <label
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >Email</label
                        >
                        <div class="relative">
                            <span
                                class="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a98a8]"
                            >
                                <span
                                    class="material-symbols-outlined text-[18px]"
                                    >mail</span
                                >
                            </span>
                            <input
                                type="email"
                                bind:value={loginEmail}
                                required
                                disabled={isLoading}
                                class="w-full pl-10 pr-4 py-3 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>
                    <div>
                        <label
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >Password</label
                        >
                        <div class="relative">
                            <span
                                class="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a98a8]"
                            >
                                <span
                                    class="material-symbols-outlined text-[18px]"
                                    >lock</span
                                >
                            </span>
                            <input
                                type="password"
                                bind:value={loginPassword}
                                required
                                disabled={isLoading}
                                class="w-full pl-10 pr-4 py-3 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        class="w-full py-3 px-4 bg-primary hover:bg-blue-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>{isLoading ? "Signing In..." : "Sign In"}</span>
                        {#if !isLoading}
                            <span
                                class="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform"
                                >arrow_forward</span
                            >
                        {:else}
                            <span
                                class="material-symbols-outlined text-[18px] animate-spin"
                                >progress_activity</span
                            >
                        {/if}
                    </button>
                </form>
            {/if}

            <!-- Sign Up Form -->
            {#if activeTab === "register"}
                <form
                    on:submit|preventDefault={handleRegister}
                    class="p-8 space-y-5"
                >
                    <div>
                        <label
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >Full Name</label
                        >
                        <div class="relative">
                            <span
                                class="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a98a8]"
                            >
                                <span
                                    class="material-symbols-outlined text-[18px]"
                                    >person</span
                                >
                            </span>
                            <input
                                type="text"
                                bind:value={registerName}
                                required
                                disabled={isLoading}
                                class="w-full pl-10 pr-4 py-3 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                                placeholder="John Doe"
                            />
                        </div>
                    </div>
                    <div>
                        <label
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >Email</label
                        >
                        <div class="relative">
                            <span
                                class="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a98a8]"
                            >
                                <span
                                    class="material-symbols-outlined text-[18px]"
                                    >mail</span
                                >
                            </span>
                            <input
                                type="email"
                                bind:value={registerEmail}
                                required
                                disabled={isLoading}
                                class="w-full pl-10 pr-4 py-3 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>
                    <div>
                        <label
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >Password</label
                        >
                        <div class="relative">
                            <span
                                class="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a98a8]"
                            >
                                <span
                                    class="material-symbols-outlined text-[18px]"
                                    >lock</span
                                >
                            </span>
                            <input
                                type="password"
                                bind:value={registerPassword}
                                required
                                disabled={isLoading}
                                class="w-full pl-10 pr-4 py-3 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-[#111418] dark:text-white placeholder-[#8a98a8] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        class="w-full py-3 px-4 bg-primary hover:bg-blue-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span
                            >{isLoading
                                ? "Creating Account..."
                                : "Create Account"}</span
                        >
                        {#if !isLoading}
                            <span
                                class="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform"
                                >arrow_forward</span
                            >
                        {:else}
                            <span
                                class="material-symbols-outlined text-[18px] animate-spin"
                                >progress_activity</span
                            >
                        {/if}
                    </button>
                </form>
            {/if}

            <!-- Error Message -->
            {#if errorMessage}
                <div
                    class="mx-8 mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center gap-2"
                >
                    <span
                        class="material-symbols-outlined text-[18px] flex-shrink-0"
                        >error</span
                    >
                    <span>{errorMessage}</span>
                </div>
            {/if}

            <!-- Success Message -->
            {#if successMessage}
                <div
                    class="mx-8 mb-6 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2"
                >
                    <span
                        class="material-symbols-outlined text-[18px] flex-shrink-0"
                        >check_circle</span
                    >
                    <span>{successMessage}</span>
                </div>
            {/if}

            <!-- Test Credentials -->
            {#if activeTab === "login"}
                <div class="px-8 pb-8">
                    <div
                        class="pt-6 border-t border-[#e5e7eb] dark:border-[#1e2936]"
                    >
                        <div class="flex items-center gap-2 mb-3">
                            <span
                                class="material-symbols-outlined text-[14px] text-[#8a98a8]"
                                >science</span
                            >
                            <p
                                class="text-xs font-semibold text-[#8a98a8] uppercase tracking-wider"
                            >
                                Test Credentials
                            </p>
                        </div>
                        <div
                            class="bg-[#fbfcfd] dark:bg-[#0d141c] rounded-lg px-4 py-3 border border-[#e5e7eb] dark:border-[#1e2936]"
                        >
                            <div
                                class="flex items-center justify-between text-sm mb-1"
                            >
                                <span class="text-[#5c6b7f] dark:text-gray-400"
                                    >Email:</span
                                >
                                <span
                                    class="text-primary font-medium select-all cursor-pointer hover:underline"
                                    on:click={() =>
                                        (loginEmail = "test@example.com")}
                                    >test@example.com</span
                                >
                            </div>
                            <div
                                class="flex items-center justify-between text-sm"
                            >
                                <span class="text-[#5c6b7f] dark:text-gray-400"
                                    >Password:</span
                                >
                                <span
                                    class="text-primary font-medium select-all cursor-pointer hover:underline"
                                    on:click={() =>
                                        (loginPassword = "password123")}
                                    >password123</span
                                >
                            </div>
                        </div>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Theme Toggle -->
        <div class="mt-6 flex justify-center">
            <button
                on:click={toggleTheme}
                class="flex items-center gap-2 px-4 py-2 rounded-lg text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white hover:bg-white/50 dark:hover:bg-[#151e29]/50 transition-all text-sm"
            >
                <span class="material-symbols-outlined text-[18px]"
                    >{$isDarkMode ? "light_mode" : "dark_mode"}</span
                >
                <span>{$isDarkMode ? "Light Mode" : "Dark Mode"}</span>
            </button>
        </div>
    </div>
</div>
