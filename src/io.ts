import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Snapshot } from "./types.js";
import { parseSnapshot } from "./validate.js";

export const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;

function noFollowFlag(): number {
  if (typeof constants.O_NOFOLLOW !== "number") {
    throw new Error("This platform does not support safe no-follow snapshot file access.");
  }
  return constants.O_NOFOLLOW;
}

/** Reject known symlink ancestors. Concurrent ancestor replacement is not a sandbox. */
async function checkParentDirectories(path: string): Promise<void> {
  let current = dirname(path);
  while (true) {
    const info = await lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error("Snapshot parent directories must exist and must not be symbolic links.");
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

export async function readSnapshot(path: string): Promise<Snapshot> {
  const absolutePath = resolve(path);
  await checkParentDirectories(absolutePath);
  const pathInfo = await lstat(absolutePath);
  if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) throw new Error("A snapshot must be a regular file.");
  // O_NONBLOCK also prevents a swapped-in FIFO from hanging before fstat runs.
  const handle = await open(absolutePath, constants.O_RDONLY | constants.O_NONBLOCK | noFollowFlag());
  try {
    const initial = await handle.stat();
    if (!initial.isFile()) throw new Error("A snapshot must be a regular file.");
    if (initial.size > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot exceeds the 8 MiB size limit.");
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, MAX_SNAPSHOT_BYTES + 1 - total));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot exceeds the 8 MiB size limit.");
      chunks.push(chunk.subarray(0, bytesRead));
    }
    const final = await handle.stat();
    if (initial.size !== final.size || initial.mtimeMs !== final.mtimeMs || initial.ctimeMs !== final.ctimeMs) {
      throw new Error("Snapshot changed while it was being read.");
    }
    let data: unknown;
    try {
      data = JSON.parse(Buffer.concat(chunks, total).toString("utf8"));
    } catch {
      throw new Error("Snapshot must contain valid JSON.");
    }
    return parseSnapshot(data);
  } finally {
    await handle.close();
  }
}

export async function writeSnapshot(path: string, snapshot: Snapshot): Promise<void> {
  const validated = parseSnapshot(snapshot);
  const bytes = Buffer.from(`${JSON.stringify(validated, null, 2)}\n`, "utf8");
  if (bytes.length > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot exceeds the 8 MiB size limit.");
  const absolutePath = resolve(path);
  await checkParentDirectories(absolutePath);
  const handle = await open(absolutePath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollowFlag(), 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } catch {
    // Leave cleanup to the user: the pathname may now refer to a replacement.
    throw new Error("Output could not be completed; a partial private file may remain.");
  } finally {
    await handle.close();
  }
}
