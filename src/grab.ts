/**
 * grab — download YouTube audio via yt-dlp on a remote host.
 *
 * Uses `uvx yt-dlp` so we always get the latest version without managing a
 * Python environment. ffmpeg must be available on PATH for audio conversion.
 * Default: Opus 128 kbps (equivalent to ~256 kbps MP3, half the file size).
 */

const DEFAULT_OUTPUT_DIR = "~/Music/grabs";
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export type AudioFormat = "opus" | "mp3";

export interface GrabOptions {
  url: string;
  host: string;
  outputDir?: string;
  format?: AudioFormat;
  bitrate?: string;
  timeoutMs?: number;
}

export interface GrabResult {
  ok: boolean;
  host: string;
  url: string;
  outputDir: string;
  exitCode: number;
}

/** Ensure uv/uvx and ffmpeg are findable even in non-login SSH shells. */
const PATH_PREFIX = "export PATH=$HOME/.local/bin:$PATH";

function buildYtDlpCommand(url: string, outputDir: string, format: AudioFormat, bitrate: string): string {
  const outputTemplate = `${outputDir}/%(title)s.%(ext)s`;
  const parts = [
    "uvx yt-dlp",
    "--extract-audio",
    `--audio-format ${format}`,
    "--postprocessor-args", `"ffmpeg:-b:a ${bitrate}"`,
    "--embed-metadata",
    "--no-playlist",
    "--restrict-filenames",
    "-o", `'${outputTemplate}'`,
    `'${url}'`,
  ];
  // --embed-thumbnail only works reliably with mp3 (ID3 tags)
  if (format === "mp3") {
    parts.splice(4, 0, "--embed-thumbnail");
  }
  return parts.join(" ");
}

export async function grabAudio(options: GrabOptions): Promise<GrabResult> {
  const outputDir = options.outputDir ?? DEFAULT_OUTPUT_DIR;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const format = options.format ?? "opus";
  const bitrate = options.bitrate ?? (format === "opus" ? "128k" : "320k");

  const mkdirCmd = `mkdir -p ${outputDir}`;
  const dlCmd = buildYtDlpCommand(options.url, outputDir, format, bitrate);
  const remoteCommand = `${PATH_PREFIX} && ${mkdirCmd} && ${dlCmd}`;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const proc = Bun.spawn(
      [
        "ssh",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=10",
        "-t", "-t", // force pseudo-terminal for progress output
        options.host,
        remoteCommand,
      ],
      {
        stdout: "inherit",
        stderr: "inherit",
        signal: controller.signal,
      }
    );

    const exitCode = await proc.exited;

    return {
      ok: exitCode === 0,
      host: options.host,
      url: options.url,
      outputDir,
      exitCode,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`grab failed: ${message}`);
    return {
      ok: false,
      host: options.host,
      url: options.url,
      outputDir,
      exitCode: 255,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function grabCheck(host: string): Promise<{ uvx: boolean; ffmpeg: boolean }> {
  const proc = Bun.spawn(
    [
      "ssh",
      "-o", "BatchMode=yes",
      "-o", "ConnectTimeout=5",
      host,
      `${PATH_PREFIX} && uvx --version && which ffmpeg`,
    ],
    { stdout: "pipe", stderr: "pipe" }
  );

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  return {
    uvx: stdout.includes("uv"),
    ffmpeg: exitCode === 0 && stdout.includes("ffmpeg"),
  };
}
