"use client";

import type { ReactNode } from "react";

export function DemoInstallBanner() {
  return (
    <div className="demo-install-banner">
      <span className="demo-install-text">
        🚀 This is a sandbox demo —{" "}
        <strong>install Oclushion Desktop</strong> for the full AI IDE experience with file access, agent pipelines, and unlimited prompts.
      </span>
      <a
        className="demo-install-button"
        href="/#download"
        target="_blank"
        rel="noopener noreferrer"
      >
        Download Free
      </a>
    </div>
  );
}

export function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="demo-app">
      <DemoInstallBanner />
      <div className="demo-body">
        {children}
      </div>
    </div>
  );
}
