// Install-time disclaimer banner for posthog-cli.
// Runs via `npm install` / `npx` postinstall hook. Pure stderr output; no fs/network.
// Silently skipped in the package's own repo (when __dirname is not under node_modules)
// and wrapped in try/catch so it can never break an install.

try {
  const path = require("node:path");
  const segments = __dirname.split(path.sep);
  // Skip repo-local dev installs (when the script runs outside a node_modules tree).
  if (!segments.includes("node_modules")) process.exit(0);
  if (process.env.POSTHOG_CLI_NO_BANNER) process.exit(0);
  process.stderr.write(
    "\n" +
      "  posthog-cli — community-built, unofficial.\n" +
      "  Not affiliated with or endorsed by PostHog Inc.\n" +
      "  Docs: https://github.com/sapihav/posthog-cli\n" +
      "  Get started: posthog login\n" +
      "\n"
  );
} catch {
  // Never fail the install.
}
