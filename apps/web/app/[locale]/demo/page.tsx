import { setRequestLocale } from "next-intl/server";

import { DemoLayout } from "@/components/demo/demo-layout";
import { DemoChat } from "@/components/demo/demo-chat";
import { DemoEditor } from "@/components/demo/demo-editor";
import { DemoTerminal } from "@/components/demo/demo-terminal";
import type { AppLocale } from "../../../i18n/routing";
import { locales } from "../../../i18n/routing";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function DemoPage({
  params,
}: Readonly<{
  params: Promise<{ locale: AppLocale }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <DemoLayout>
      <div className="demo-workspace">
        <aside className="demo-sidebar">
          <div className="demo-sidebar-header">Oclushion Demo</div>
          <nav className="demo-sidebar-nav">
            <a className="demo-sidebar-item active" href="#editor">
              Editor
            </a>
            <a className="demo-sidebar-item" href="#chat">
              Chat
            </a>
            <a className="demo-sidebar-item" href="#terminal">
              Terminal
            </a>
            <a className="demo-sidebar-item" href="#agents">
              Agents
            </a>
            <a className="demo-sidebar-item" href="#settings">
              Settings
            </a>
          </nav>
          <div className="demo-sidebar-footer">
            <a href="/" className="demo-sidebar-back">
              &larr; Back to site
            </a>
          </div>
        </aside>
        <main className="demo-main">
          <div className="demo-editor-panel">
            <DemoEditor />
          </div>
          <div className="demo-terminal-panel">
            <DemoTerminal />
          </div>
        </main>
        <aside className="demo-chat-panel">
          <DemoChat />
        </aside>
      </div>
    </DemoLayout>
  );
}
