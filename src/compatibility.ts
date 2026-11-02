export const SUPPORTED_CODEX_VERSION = "0.166.0";

export interface NativeHost {
  version: string;
  platform: NodeJS.Platform;
  arch: string;
}

// Add a combination only after reviewing live native conformance evidence.
// Candidate experiments alter a temporary build, never this production manifest.
export const SUPPORTED_NATIVE_HOSTS: readonly Readonly<NativeHost>[] = Object.freeze([
  Object.freeze({ version: SUPPORTED_CODEX_VERSION, platform: "darwin" as const, arch: "arm64" }),
]);

export function isSupportedNativeHost(
  version: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): boolean {
  return SUPPORTED_NATIVE_HOSTS.some(host => host.version === version && host.platform === platform && host.arch === arch);
}

export function supportedNativeHostLabel(): string {
  return SUPPORTED_NATIVE_HOSTS.map(host =>
    `Codex CLI ${host.version} on ${host.platform === "darwin" ? "macOS" : host.platform === "linux" ? "Linux" : host.platform} ${host.arch}`,
  ).join("; ");
}
