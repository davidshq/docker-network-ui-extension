import { createDockerDesktopClient } from "@docker/extension-api-client";

let ddClient: ReturnType<typeof createDockerDesktopClient> | null = null;

/**
 * Gets the Docker Desktop client, initializing it only if running inside Docker Desktop.
 * Returns null if running in a regular browser (dev mode).
 */
export function getDockerClient() {
  if (ddClient) return ddClient;

  try {
    // Try to create the client - it will throw if not in Docker Desktop
    ddClient = createDockerDesktopClient();
    console.log('Docker Desktop client initialized successfully');
    return ddClient;
  } catch (error) {
    // Not running in Docker Desktop (browser/dev mode)
    console.warn('Docker Desktop client not available:', error);
    return null;
  }
}

export type ExecResult = { stdout?: string; stderr?: string; code?: number };

export async function dockerExec(cmd: string, args: string[]): Promise<ExecResult> {
  const client = getDockerClient();
  if (!client) {
    throw new Error('Docker Desktop client is not available. Please run this extension inside Docker Desktop.');
  }
  // The Extensions SDK exposes docker CLI as exec("ps", ["--all"]) etc.
  // We return stdout/stderr for error display and parsing.
  const res = await client.docker.cli.exec(cmd, args);
  return res as ExecResult;
}

export function parseJsonLines<T = any>(stdout?: string): T[] {
  if (!stdout) return [];
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

/**
 * Parses Docker CLI error messages and returns user-friendly error messages.
 */
export function parseDockerError(error: any): string {
  const message = error?.message || error?.stderr || String(error);
  const msgLower = message.toLowerCase();

  // Network has active endpoints (containers attached)
  if (msgLower.includes("has active endpoints") || msgLower.includes("has active containers")) {
    return "Cannot remove network: it has containers attached. Disconnect all containers first, then try again.";
  }

  // Network name already exists
  if (msgLower.includes("already exists") || msgLower.includes("network with name")) {
    return "A network with this name already exists. Please choose a different name.";
  }

  // Invalid CIDR/subnet
  if (msgLower.includes("invalid cidr") || msgLower.includes("invalid subnet")) {
    return "Invalid subnet format. Use CIDR notation (e.g., 172.28.0.0/16).";
  }

  // Network not found
  if (msgLower.includes("not found") || msgLower.includes("no such network")) {
    return "Network not found. It may have been removed.";
  }

  // Container not found
  if (msgLower.includes("no such container")) {
    return "Container not found. Check the container name or ID.";
  }

  // Permission denied
  if (msgLower.includes("permission denied") || msgLower.includes("access denied")) {
    return "Permission denied. Ensure Docker Desktop has the necessary permissions.";
  }

  // Return original message if no pattern matches
  return message;
}
