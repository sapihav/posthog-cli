import { Command } from "commander";
import { createInterface } from "node:readline";
import { execFile } from "node:child_process";
import { saveGlobalConfig, GLOBAL_CONFIG_PATH } from "../config.js";
import { outputJson, outputError } from "../output.js";

export const HOSTS: Record<string, string> = {
  "1": "https://us.posthog.com",
  "2": "https://eu.posthog.com",
};

// -- Prompt helpers (all I/O on stderr to keep stdout for JSON) --

export function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function promptSecret(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return prompt(question);
  }

  return new Promise((resolve) => {
    process.stderr.write(question);

    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();

    let input = "";
    const handler = (chunk: Buffer): void => {
      const char = chunk.toString();

      if (char === "\r" || char === "\n") {
        process.stdin.removeListener("data", handler);
        process.stdin.setRawMode(wasRaw ?? false);
        process.stdin.pause();
        process.stderr.write("\n");
        resolve(input);
      } else if (char === "\u007F" || char === "\b") {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stderr.write("\b \b");
        }
      } else if (char === "\u0003") {
        process.stderr.write("\n");
        process.exit(1);
      } else {
        input += char;
        process.stderr.write("*");
      }
    };

    process.stdin.on("data", handler);
  });
}

export function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  execFile(cmd, [url]);
}

function log(msg: string): void {
  process.stderr.write(msg + "\n");
}

// -- Fetch projects using the API key --

export interface Project {
  id: number;
  name: string;
}

interface Organization {
  id: string;
  name: string;
}

export async function fetchProjects(
  host: string,
  apiKey: string
): Promise<Project[]> {
  const headers = { Authorization: `Bearer ${apiKey}` };

  // Try org-level endpoint first (works with "All access" / "Organizations" keys)
  const orgsRes = await fetch(`${host}/api/organizations/`, { headers });

  if (orgsRes.ok) {
    const orgsData = (await orgsRes.json()) as { results: Organization[] };
    const projects: Project[] = [];

    for (const org of orgsData.results) {
      const projRes = await fetch(
        `${host}/api/organizations/${org.id}/projects/`,
        { headers }
      );
      if (!projRes.ok) {
        const text = await projRes.text().catch(() => "");
        throw new Error(
          `Failed to fetch projects for org "${org.name}" (${projRes.status}): ${text}`
        );
      }
      const projData = (await projRes.json()) as { results: Project[] };
      projects.push(...projData.results);
    }

    return projects;
  }

  // Fall back to project-scoped endpoint (works with project-scoped keys)
  const projRes = await fetch(`${host}/api/projects/`, { headers });
  if (!projRes.ok) {
    const text = await projRes.text().catch(() => "");
    throw new Error(
      `Failed to fetch projects (${projRes.status}): ${text}`
    );
  }

  const projData = (await projRes.json()) as { results: Project[] };
  return projData.results;
}

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Interactive setup — authenticate and select a project")
    .action(async () => {
      try {
        // 1. Region
        log("");
        log("  Region:");
        log("    [1] US (us.posthog.com)");
        log("    [2] EU (eu.posthog.com)");
        const region = await prompt("  Select (1/2): ");
        const host = HOSTS[region];
        if (!host) outputError("Invalid selection. Choose 1 or 2.");

        // 2. Open browser to API key page
        const keyUrl = `${host}/settings/user-api-keys`;
        log("");
        log(`  Opening browser to create an API key...`);
        log(`  ${keyUrl}`);
        openBrowser(keyUrl);

        // 3. API key (masked input)
        log("");
        const apiKey = await promptSecret("  Paste your API key: ");
        if (!apiKey || !apiKey.startsWith("phx_")) {
          outputError("Invalid API key. Must start with phx_");
        }

        // 4. Fetch and select project
        log("");
        log("  Fetching your projects...");
        const projects = await fetchProjects(host, apiKey);

        if (projects.length === 0) {
          outputError("No projects found for this API key.");
        }

        let projectId: string;
        if (projects.length === 1) {
          log(`  Using project: ${projects[0].name} (${projects[0].id})`);
          projectId = String(projects[0].id);
        } else {
          for (let i = 0; i < projects.length; i++) {
            log(
              `    [${i + 1}] ${projects[i].name} (id: ${projects[i].id})`
            );
          }
          const choice = await prompt("  Select project: ");
          const idx = parseInt(choice, 10) - 1;
          if (isNaN(idx) || idx < 0 || idx >= projects.length) {
            outputError("Invalid selection.");
          }
          projectId = String(projects[idx].id);
        }

        // 5. Save
        const saved = saveGlobalConfig({ apiKey, projectId, host });
        log("");
        log(`  Config saved to ${GLOBAL_CONFIG_PATH}`);
        log("");
        outputJson(
          {
            host: saved.host,
            projectId: saved.projectId,
            apiKey:
              saved.apiKey.slice(0, 7) + "..." + saved.apiKey.slice(-4),
          },
          program.opts().pretty
        );
      } catch (e) {
        outputError((e as Error).message);
      }
    });
}
