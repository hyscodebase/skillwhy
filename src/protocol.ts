import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { VERSION } from "./version.js";

export class CaptureFailure extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "CaptureFailure";
  }
}

export interface ProcessOptions {
  executable: string;
  cwd: string;
  timeoutMs: number;
}

const MAX_PROTOCOL_BYTES = 16 * 1024 * 1024;
const MAX_VERSION_BYTES = 64 * 1024;
const HARD_SHUTDOWN_MS = 1_000;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Never invokes a shell and never forwards native stderr to a report. */
export function probeVersion(options: ProcessOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.executable, ["--version"], {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let bytes = 0;
    let output = "";
    let failure: CaptureFailure | undefined;
    let settled = false;
    let exited = false;
    let killTimer: NodeJS.Timeout | undefined;
    let hardTimer: NodeJS.Timeout | undefined;
    const finish = (code: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (hardTimer) clearTimeout(hardTimer);
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      if (failure) reject(failure);
      else if (code !== 0) reject(new CaptureFailure("VERSION_PROBE_FAILED"));
      else {
        const match = /^codex-cli (\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?)\s*$/.exec(output.trim());
        if (!match?.[1] || match[1].length > 128) reject(new CaptureFailure("UNRECOGNIZED_HOST_VERSION"));
        else resolve(match[1]);
      }
    };
    const fail = (code: string): void => {
      if (settled) return;
      failure ??= new CaptureFailure(code);
      if (!exited) child.kill("SIGTERM");
      killTimer ??= setTimeout(() => {
        if (!exited) child.kill("SIGKILL");
      }, 300);
      // A descendant may inherit a pipe after the owned child exits. Its close
      // event is not a deadline, and we must not kill unrelated descendants.
      hardTimer ??= setTimeout(() => {
        if (!exited) child.kill("SIGKILL");
        finish(null);
      }, HARD_SHUTDOWN_MS);
    };
    const timer = setTimeout(() => fail("VERSION_TIMEOUT"), options.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_VERSION_BYTES) fail("VERSION_OUTPUT_TOO_LARGE");
      else output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_VERSION_BYTES) fail("VERSION_OUTPUT_TOO_LARGE");
    });
    child.on("error", () => fail("HOST_START_FAILED"));
    child.on("exit", () => { exited = true; });
    child.on("close", finish);
  });
}

export interface NativeObservation {
  payload: unknown;
  shutdownForced: boolean;
}

/**
 * The only native RPCs this client can send are the fixed handshake and one
 * skills/list request. It never starts a thread, turn, login or repair action.
 */
export function querySkills(options: ProcessOptions): Promise<NativeObservation> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.executable, ["app-server"], {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    const decoder = new StringDecoder("utf8");
    let buffer = "";
    let bytes = 0;
    let phase: "initialize" | "list" | "done" = "initialize";
    let payload: unknown;
    let failure: CaptureFailure | undefined;
    let settled = false;
    let exited = false;
    let stopping = false;
    let shutdownForced = false;
    let terminateTimer: NodeJS.Timeout | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    let hardTimer: NodeJS.Timeout | undefined;

    const finish = (code: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (terminateTimer) clearTimeout(terminateTimer);
      if (killTimer) clearTimeout(killTimer);
      if (hardTimer) clearTimeout(hardTimer);
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      if (failure) reject(failure);
      else if (phase !== "done") reject(new CaptureFailure(buffer.trim() ? "PROTOCOL_TRUNCATED_JSON" : "PROTOCOL_CLOSED_EARLY"));
      else if (code !== 0 && !shutdownForced) reject(new CaptureFailure("HOST_EXIT_FAILED"));
      else resolve({ payload, shutdownForced });
    };

    const stop = (): void => {
      if (stopping) return;
      stopping = true;
      child.stdin.end();
      terminateTimer = setTimeout(() => {
        if (settled) return;
        shutdownForced = true;
        if (!exited) child.kill("SIGTERM");
        killTimer = setTimeout(() => {
          if (!exited) child.kill("SIGKILL");
        }, 300);
      }, 500);
      hardTimer = setTimeout(() => {
        shutdownForced = true;
        if (!exited) child.kill("SIGKILL");
        finish(child.exitCode);
      }, HARD_SHUTDOWN_MS);
    };
    const fail = (code: string): void => {
      if (settled) return;
      failure ??= new CaptureFailure(code);
      stop();
    };
    const timer = setTimeout(() => fail("HOST_TIMEOUT"), options.timeoutMs);
    const send = (message: Record<string, unknown>): void => {
      if (stopping) return;
      child.stdin.write(JSON.stringify(message) + "\n", (error) => {
        if (error && phase !== "done") fail("PROTOCOL_WRITE_FAILED");
      });
    };

    const acceptLine = (line: string): void => {
      if (failure || phase === "done") return;
      if (!line.trim()) return;
      let message: unknown;
      try { message = JSON.parse(line); }
      catch { fail("PROTOCOL_INVALID_JSON"); return; }
      if (!isRecord(message)) { fail("PROTOCOL_INVALID_MESSAGE"); return; }
      if ("method" in message) {
        if (typeof message.method !== "string") fail("PROTOCOL_INVALID_MESSAGE");
        else if ("id" in message) fail("UNEXPECTED_SERVER_REQUEST");
        // Notifications require no reply; their content is not persisted.
        return;
      }
      const expectedId = phase === "initialize" ? 1 : 2;
      if (message.id !== expectedId) { fail("PROTOCOL_UNEXPECTED_RESPONSE"); return; }
      if ("error" in message) { fail(phase === "initialize" ? "INITIALIZE_REJECTED" : "SKILLS_LIST_REJECTED"); return; }
      if (!("result" in message) || !isRecord(message.result)) { fail("PROTOCOL_INVALID_RESULT"); return; }
      if (phase === "initialize") {
        phase = "list";
        send({ method: "initialized", params: {} });
        send({ id: 2, method: "skills/list", params: { cwds: [options.cwd], forceReload: true } });
      } else {
        phase = "done";
        payload = message.result;
        clearTimeout(timer);
        stop();
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_PROTOCOL_BYTES) { fail("PROTOCOL_OUTPUT_TOO_LARGE"); return; }
      if (failure || phase === "done") return;
      buffer += decoder.write(chunk);
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        acceptLine(line);
        if (stopping) { buffer = ""; break; }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_PROTOCOL_BYTES) fail("PROTOCOL_OUTPUT_TOO_LARGE");
    });
    child.stdin.on("error", () => {
      if (!stopping) fail("PROTOCOL_WRITE_FAILED");
    });
    child.on("error", () => fail("HOST_START_FAILED"));
    child.on("exit", () => { exited = true; });
    child.on("close", finish);
    send({ id: 1, method: "initialize", params: {
      clientInfo: { name: "skillwhy", title: "SkillWhy", version: VERSION },
    } });
  });
}
