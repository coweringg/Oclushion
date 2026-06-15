import { logger } from "../utils/logger";
import type { ScaffoldConfig, ScaffoldFeature, ScaffoldResult, StackTemplate } from "./ship-pipeline.types";

type FileEntry = { path: string; content: string };

const BASE_FILES: Record<StackTemplate, FileEntry[]> = {
  "nextjs-tailwind-prisma": [
    { path: "package.json", content: packageJson("nextjs-tailwind-prisma", ["next", "react", "react-dom", "prisma", "@prisma/client", "tailwindcss", "postcss", "autoprefixer"]) },
    { path: "tsconfig.json", content: tsConfig() },
    { path: "tailwind.config.ts", content: tailwindConfig() },
    { path: "postcss.config.mjs", content: postcssConfig() },
    { path: "next.config.ts", content: nextConfig() },
    { path: "prisma/schema.prisma", content: prismaSchema("postgresql") },
    { path: "src/app/layout.tsx", content: nextLayout() },
    { path: "src/app/page.tsx", content: nextPage() },
    { path: "src/app/globals.css", content: globalsCss() },
    { path: "src/lib/db.ts", content: prismaClient() },
    { path: ".env.example", content: envExample(["DATABASE_URL=postgresql://user:pass@localhost:5432/mydb"]) },
    { path: ".gitignore", content: gitignore() },
  ],
  "nextjs-tailwind-supabase": [
    { path: "package.json", content: packageJson("nextjs-tailwind-supabase", ["next", "react", "react-dom", "@supabase/supabase-js", "@supabase/ssr", "tailwindcss", "postcss", "autoprefixer"]) },
    { path: "tsconfig.json", content: tsConfig() },
    { path: "tailwind.config.ts", content: tailwindConfig() },
    { path: "postcss.config.mjs", content: postcssConfig() },
    { path: "next.config.ts", content: nextConfig() },
    { path: "src/app/layout.tsx", content: nextLayout() },
    { path: "src/app/page.tsx", content: nextPage() },
    { path: "src/app/globals.css", content: globalsCss() },
    { path: "src/lib/supabase/client.ts", content: supabaseClient("client") },
    { path: "src/lib/supabase/server.ts", content: supabaseClient("server") },
    { path: ".env.example", content: envExample(["NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co", "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"]) },
    { path: ".gitignore", content: gitignore() },
  ],
  "vite-react-tailwind": [
    { path: "package.json", content: packageJson("vite-react-tailwind", ["react", "react-dom", "tailwindcss", "postcss", "autoprefixer"], ["vite", "@vitejs/plugin-react"]) },
    { path: "tsconfig.json", content: tsConfig() },
    { path: "tailwind.config.ts", content: tailwindConfig() },
    { path: "postcss.config.mjs", content: postcssConfig() },
    { path: "vite.config.ts", content: viteConfig() },
    { path: "index.html", content: viteHtml() },
    { path: "src/App.tsx", content: viteApp() },
    { path: "src/main.tsx", content: viteMain() },
    { path: "src/index.css", content: globalsCss() },
    { path: ".gitignore", content: gitignore() },
  ],
  "astro-tailwind": [
    { path: "package.json", content: packageJson("astro-tailwind", ["astro", "@astrojs/tailwind", "tailwindcss"]) },
    { path: "tsconfig.json", content: tsConfig() },
    { path: "tailwind.config.ts", content: tailwindConfig() },
    { path: "astro.config.mjs", content: astroConfig() },
    { path: "src/pages/index.astro", content: astroPage() },
    { path: "src/layouts/Layout.astro", content: astroLayout() },
    { path: ".gitignore", content: gitignore() },
  ],
  custom: [],
};

const FEATURE_FILES: Record<ScaffoldFeature, (config: ScaffoldConfig) => FileEntry[]> = {
  auth: (config) => {
    if (config.auth === "next-auth") {
      return [
        { path: "src/app/api/auth/[...nextauth]/route.ts", content: nextAuthRoute() },
        { path: "src/lib/auth.ts", content: nextAuthConfig() },
      ];
    }
    if (config.auth === "supabase-auth") {
      return [
        { path: "src/app/(auth)/login/page.tsx", content: supabaseLoginPage() },
        { path: "src/middleware.ts", content: supabaseMiddleware() },
      ];
    }
    return [];
  },
  database: () => [],
  "api-routes": () => [
    { path: "src/app/api/health/route.ts", content: healthRoute() },
  ],
  "landing-page": () => [
    { path: "src/components/Hero.tsx", content: heroComponent() },
    { path: "src/components/Features.tsx", content: featuresComponent() },
    { path: "src/components/Footer.tsx", content: footerComponent() },
  ],
  dashboard: () => [
    { path: "src/app/dashboard/page.tsx", content: dashboardPage() },
    { path: "src/app/dashboard/layout.tsx", content: dashboardLayout() },
    { path: "src/components/Sidebar.tsx", content: sidebarComponent() },
  ],
  "dark-mode": () => [
    { path: "src/components/ThemeToggle.tsx", content: themeToggle() },
    { path: "src/hooks/useTheme.ts", content: useThemeHook() },
  ],
  i18n: () => [
    { path: "src/i18n/config.ts", content: i18nConfig() },
    { path: "src/i18n/en.json", content: JSON.stringify({ welcome: "Welcome", description: "Built with Oclushion Ship" }, null, 2) },
    { path: "src/i18n/es.json", content: JSON.stringify({ welcome: "Bienvenido", description: "Construido con Oclushion Ship" }, null, 2) },
  ],
  seo: () => [
    { path: "src/lib/seo.ts", content: seoConfig() },
  ],
  pwa: () => [
    { path: "public/manifest.json", content: pwaManifest() },
    { path: "public/sw.js", content: serviceWorker() },
  ],
  analytics: () => [
    { path: "src/lib/analytics.ts", content: analyticsClient() },
  ],
};

export class ScaffoldService {
  public async scaffold(
    config: ScaffoldConfig,
    writeFile: (path: string, content: string) => Promise<void>,
  ): Promise<ScaffoldResult> {
    const start = performance.now();
    const filesCreated: string[] = [];

    try {
      const baseFiles = BASE_FILES[config.template] ?? [];
      for (const file of baseFiles) {
        const fullPath = `${config.projectName}/${file.path}`;
        await writeFile(fullPath, file.content);
        filesCreated.push(fullPath);
      }

      for (const feature of config.features) {
        const generator = FEATURE_FILES[feature];
        if (generator) {
          const featureFiles = generator(config);
          for (const file of featureFiles) {
            const fullPath = `${config.projectName}/${file.path}`;
            await writeFile(fullPath, file.content);
            filesCreated.push(fullPath);
          }
        }
      }

      const readmePath = `${config.projectName}/README.md`;
      await writeFile(readmePath, generateReadme(config));
      filesCreated.push(readmePath);

      logger.info("ScaffoldService", `Scaffolded ${filesCreated.length} files for ${config.template}`);

      return {
        template: config.template,
        filesCreated,
        dependenciesInstalled: false,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      logger.error("ScaffoldService", "Scaffold failed", err);
      throw err;
    }
  }
}

function packageJson(name: string, deps: string[], devDeps: string[] = []): string {
  const depsObj: Record<string, string> = {};
  for (const d of deps) depsObj[d] = "latest";
  const devDepsObj: Record<string, string> = { typescript: "~5.9.0", "@types/react": "latest", "@types/node": "latest" };
  for (const d of devDeps) devDepsObj[d] = "latest";
  return JSON.stringify({
    name,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: name.includes("vite") ? "vite" : name.includes("astro") ? "astro dev" : "next dev",
      build: name.includes("vite") ? "tsc && vite build" : name.includes("astro") ? "astro build" : "next build",
      start: name.includes("astro") ? "astro preview" : "next start",
      lint: "eslint .",
    },
    dependencies: depsObj,
    devDependencies: devDepsObj,
  }, null, 2);
}

function tsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022", lib: ["dom", "dom.iterable", "esnext"], allowJs: true, skipLibCheck: true,
      strict: true, noEmit: true, esModuleInterop: true, module: "esnext",
      moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "preserve",
      incremental: true, paths: { "@
*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  }, null, 2);
}

function tailwindConfig(): string {
  return `import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src*.{ts,tsx,astro,html}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};

export default config;
`;
}

function postcssConfig(): string {
  return `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`;
}

function nextConfig(): string {
  return `import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
};

export default config;
`;
}

function nextLayout(): string {
  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Built with Oclushion Ship",
  description: "From idea to production in under 1 hour.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
`;
}

function nextPage(): string {
  return `export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
        Shipped with Oclushion 🚀
      </h1>
      <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400 max-w-md text-center">
        From idea to production in under 1 hour. This is the future of software development.
      </p>
    </main>
  );
}
`;
}

function globalsCss(): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground: #171717;
  --background: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground: #ededed;
    --background: #0a0a0a;
  }
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: "Inter", system-ui, sans-serif;
}
`;
}

function prismaSchema(db: string): string {
  return `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${db}"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;
}

function prismaClient(): string {
  return `import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
`;
}

function supabaseClient(type: "client" | "server"): string {
  if (type === "client") {
    return `import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
`;
  }
  return `import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}
`;
}

function envExample(lines: string[]): string {
  return `# Environment Variables — DO NOT commit .env to git\n${lines.join("\n")}\n`;
}

function gitignore(): string {
  return `node_modules/
.next/
dist/
.env
.env.local
*.tsbuildinfo
.vercel
.turbo
`;
}

function viteConfig(): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
`;
}

function viteHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Oclushion Ship</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
`;
}

function viteApp(): string {
  return `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <h1 className="text-5xl font-bold">Shipped with Oclushion 🚀</h1>
    </div>
  );
}
`;
}

function viteMain(): string {
  return `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
`;
}

function astroConfig(): string {
  return `import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({ integrations: [tailwind()] });
`;
}

function astroPage(): string {
  return `---
import Layout from "../layouts/Layout.astro";
---
<Layout title="Oclushion Ship">
  <main class="flex min-h-screen items-center justify-center">
    <h1 class="text-5xl font-bold">Shipped with Oclushion 🚀</h1>
  </main>
</Layout>
`;
}

function astroLayout(): string {
  return `---
interface Props { title: string; }
const { title } = Astro.props;
---
<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>{title}</title></head>
  <body class="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"><slot /></body>
</html>
`;
}

function nextAuthRoute(): string {
  return `import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
`;
}

function nextAuthConfig(): string {
  return `import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
};
`;
}

function supabaseLoginPage(): string {
  return `"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const supabase = createClient();

  async function handleLogin() {
    await supabase.auth.signInWithOtp({ email });
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Sign In</h1>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border p-2" placeholder="your@email.com" />
        <button onClick={handleLogin} className="w-full rounded bg-blue-600 p-2 text-white font-medium">
          Send Magic Link
        </button>
      </div>
    </div>
  );
}
`;
}

function supabaseMiddleware(): string {
  return `import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: (c) => { for (const { name, value, options } of c) response.cookies.set(name, value, options); } } },
  );
  await supabase.auth.getUser();
  return response;
}

export const config = { matcher: ["/dashboard/:path*"] };
`;
}

function healthRoute(): string {
  return `import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
`;
}

function heroComponent(): string {
  return `export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
          Ship faster than ever
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-500 dark:text-zinc-400">
          Built with Oclushion Ship — from idea to production in under 1 hour.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-4">
          <a href="#features" className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors">
            Get Started
          </a>
          <a href="#" className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-blue-600 transition-colors">
            Learn more →
          </a>
        </div>
      </div>
    </section>
  );
}
`;
}

function featuresComponent(): string {
  return `const features = [
  { title: "Lightning Fast", description: "Optimized for speed from the ground up.", icon: "⚡" },
  { title: "Type Safe", description: "Full TypeScript with strict mode enabled.", icon: "🛡️" },
  { title: "Beautiful UI", description: "Modern design with dark mode support.", icon: "🎨" },
];

export function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-bold text-center mb-16">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 hover:shadow-lg transition-shadow">
              <span className="text-4xl">{f.icon}</span>
              <h3 className="mt-4 text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`;
}

function footerComponent(): string {
  return `export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 px-6 text-center text-sm text-zinc-500">
      <p>Built with Oclushion Ship — © {new Date().getFullYear()}</p>
    </footer>
  );
}
`;
}

function dashboardPage(): string {
  return `export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[{ label: "Users", value: "1,234" }, { label: "Revenue", value: "$12.4k" }, { label: "Growth", value: "+23%" }].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm text-zinc-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
`;
}

function dashboardLayout(): string {
  return `import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
`;
}

function sidebarComponent(): string {
  return `const links = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙️" },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
      <h2 className="text-lg font-bold mb-6 px-2">Menu</h2>
      {links.map((link) => (
        <a key={link.href} href={link.href}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
          <span>{link.icon}</span>
          {link.label}
        </a>
      ))}
    </aside>
  );
}
`;
}

function themeToggle(): string {
  return `"use client";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      aria-label="Toggle theme">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
`;
}

function useThemeHook(): string {
  return `"use client";
import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initial = stored ?? preferred;
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return { theme, toggle };
}
`;
}

function i18nConfig(): string {
  return `export const defaultLocale = "en";
export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];

export async function getTranslations(locale: Locale) {
  return (await import(\`./$\{locale}.json\`)).default;
}
`;
}

function seoConfig(): string {
  return `import type { Metadata } from "next";

export function generateSEO(overrides: Partial<Metadata> = {}): Metadata {
  return {
    title: overrides.title ?? "My App — Built with Oclushion Ship",
    description: overrides.description ?? "From idea to production in under 1 hour.",
    openGraph: {
      type: "website",
      title: (overrides.title as string) ?? "My App",
      description: (overrides.description as string) ?? "From idea to production in under 1 hour.",
    },
    robots: { index: true, follow: true },
    ...overrides,
  };
}
`;
}

function pwaManifest(): string {
  return JSON.stringify({
    name: "My App",
    short_name: "App",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#2563eb",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  }, null, 2);
}

function serviceWorker(): string {
  return `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
`;
}

function analyticsClient(): string {
  return `type AnalyticsEvent = { name: string; properties?: Record<string, string | number | boolean> };

const queue: AnalyticsEvent[] = [];

export function track(name: string, properties?: Record<string, string | number | boolean>) {
  queue.push({ name, properties });
  if (typeof window !== "undefined") {
    console.debug("[Analytics]", name, properties);
  }
}

export function flush() {
  const events = queue.splice(0, queue.length);
  if (events.length > 0) {
    console.debug("[Analytics] Flushed", events.length, "events");
  }
}
`;
}

function generateReadme(config: ScaffoldConfig): string {
  return `# ${config.projectName}

> 🚀 Scaffolded by **Oclushion Ship** — from idea to production in < 1 hour.

## Stack

- **Template:** ${config.template}
- **Features:** ${config.features.join(", ") || "none"}
- **Database:** ${config.database ?? "none"}
- **Auth:** ${config.auth ?? "none"}

## Getting Started

\`\`\`bash
cd ${config.projectName}
npm install
npm run dev
\`\`\`

## Deploy

This project is ready to deploy on Vercel, Netlify, or any Node.js-compatible platform.
`;
}
