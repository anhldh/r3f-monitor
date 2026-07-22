import { useState } from "react";

type PackageManager = {
  name: string;
  command: string;
  icon: React.ReactNode;
};

const managers: PackageManager[] = [
  {
    name: "npm",
    command: "npm install r3f-monitor",
    icon: (
      <svg viewBox="0 0 32 32" role="img" aria-label="npm">
        <rect x="2" y="7" width="28" height="18" rx="2" fill="#cb3837" />
        <path d="M7 11h18v10h-5v-7h-3v7H7V11Zm3 3v4h3v-4h-3Z" fill="#fff" />
      </svg>
    ),
  },
  {
    name: "pnpm",
    command: "pnpm add r3f-monitor",
    icon: (
      <svg viewBox="0 0 32 32" role="img" aria-label="pnpm">
        <g fill="#f9ad00">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="12.5" y="3" width="7" height="7" />
          <rect x="22" y="3" width="7" height="7" />
          <rect x="3" y="12.5" width="7" height="7" />
          <rect x="12.5" y="12.5" width="7" height="7" />
          <rect x="3" y="22" width="7" height="7" />
        </g>
        <g fill="#4d4d4d">
          <rect x="22" y="12.5" width="7" height="7" />
          <rect x="12.5" y="22" width="7" height="7" />
          <rect x="22" y="22" width="7" height="7" />
        </g>
      </svg>
    ),
  },
  {
    name: "Yarn",
    command: "yarn add r3f-monitor",
    icon: (
      <svg viewBox="0 0 32 32" role="img" aria-label="Yarn">
        <circle cx="16" cy="16" r="14" fill="#2c8ebb" />
        <path
          d="M9.3 8.5c1.5 2.1 3.2 4 5.1 5.7-.7 2.2-1.1 5-1.1 8.3h5.2c0-3.2-.4-6-1.1-8.3 2-1.7 3.7-3.6 5.2-5.7l-2.4-1.4c-1.1 1.7-2.5 3.2-4.3 4.6-1.7-1.4-3.1-2.9-4.2-4.6L9.3 8.5Z"
          fill="#fff"
        />
      </svg>
    ),
  },
  {
    name: "Bun",
    command: "bun add r3f-monitor",
    icon: (
      <svg viewBox="0 0 32 32" role="img" aria-label="Bun">
        <ellipse cx="16" cy="17" rx="13" ry="10" fill="#fbf0df" stroke="#b99a77" />
        <path d="M8 14c2.3-4.7 13.8-6.8 17.3-.5" fill="none" stroke="#b99a77" strokeWidth="1.5" />
        <circle cx="12" cy="17" r="1.2" fill="#3f342b" />
        <circle cx="20" cy="17" r="1.2" fill="#3f342b" />
        <path d="M13 21c1.8 1.2 4.2 1.2 6 0" fill="none" stroke="#3f342b" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function InstallGuide() {
  const [copiedManager, setCopiedManager] = useState<string | null>(null);

  const copyCommand = async (manager: PackageManager) => {
    const fallbackCopy = () => {
      const textarea = document.createElement("textarea");
      textarea.value = manager.command;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    };

    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(manager.command);
    } catch {
      fallbackCopy();
    }

    setCopiedManager(manager.name);
    window.setTimeout(
      () => setCopiedManager((current) => (current === manager.name ? null : current)),
      1600,
    );
  };

  return (
    <section className="install-guide" aria-labelledby="install-heading">
      <div className="install-heading-row">
        <div>
          <span className="install-eyebrow">Package</span>
          <h2 id="install-heading">Install at a glance</h2>
        </div>
        <a
          className="npm-version-link"
          href="https://www.npmjs.com/package/r3f-monitor"
          target="_blank"
          rel="noreferrer"
          aria-label="View r3f-monitor on npm"
        >
          <img
            src="https://img.shields.io/npm/v/r3f-monitor?style=flat-square&logo=npm&label=npm"
            alt="Current r3f-monitor npm version"
          />
        </a>
      </div>

      <div className="install-grid">
        {managers.map((manager) => (
          <div className="install-card" key={manager.name}>
            <div className="manager-label">
              <span className="manager-icon">{manager.icon}</span>
              <strong>{manager.name}</strong>
            </div>
            <div className="install-command">
              <code>{manager.command}</code>
              <button
                type="button"
                className="copy-command"
                onClick={() => void copyCommand(manager)}
                aria-label={`Copy ${manager.name} install command`}
              >
                {copiedManager === manager.name ? (
                  <>
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="m4.5 10.2 3.2 3.2 7.8-7.8" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <rect x="7" y="6" width="8" height="9" rx="1.5" />
                      <path d="M12 6V5a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 0 4 5v7a1.5 1.5 0 0 0 1.5 1.5H7" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="dev-install-note">
        <span aria-hidden="true">i</span>
        <p>
          <strong>Using it only for performance debugging?</strong> Install it as a development
          dependency: <code>npm install -D r3f-monitor</code>,{" "}
          <code>pnpm add -D r3f-monitor</code>, <code>yarn add -D r3f-monitor</code>, or{" "}
          <code>bun add -d r3f-monitor</code>.
        </p>
      </div>
    </section>
  );
}
