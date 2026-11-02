#!/usr/bin/env python3
"""Render actual synthetic CLI output as a 42-second GIF and MP4.

Optional maintainer tools: Python Pillow, ffmpeg, and a local monospace font.
Run `npm run build` first. No native Codex process or user inventory is read.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import argparse
import json
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[1]
CLI = REPO / "dist/src/cli.js"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", default="/System/Library/Fonts/Menlo.ttc")
    args = parser.parse_args()
    font = ImageFont.truetype(args.font, 18)
    small = ImageFont.truetype(args.font, 14)
    title = ImageFont.truetype(args.font, 28)
    logo = ImageFont.truetype(args.font, 36)
    output = REPO / "assets"
    output.mkdir(exist_ok=True)
    transcript = ["SkillWhy synthetic demonstration", "",
                  "Captured from the compiled CLI using node dist/src/cli.js.",
                  "Commands below use the equivalent installed alias skillwhy.",
                  "Output excerpts appear in the animation; this transcript retains full stdout.",
                  "No native scan, user inventory, model turn, or skill execution is involved.", ""]
    with TemporaryDirectory(prefix="skillwhy-demo-") as temporary:
        cwd = Path(temporary)
        program = f"""
          import {{ demoSnapshots }} from {json.dumps((REPO / 'dist/src/demo.js').as_uri())};
          import {{ writeFileSync }} from 'node:fs';
          const [left,right]=demoSnapshots();
          writeFileSync('maintainer.snapshot.json',JSON.stringify(left));
          writeFileSync('local.snapshot.json',JSON.stringify(right));
        """
        subprocess.run(["node", "--input-type=module", "-e", program], cwd=cwd,
                       check=True, capture_output=True, text=True, timeout=15)

        def run(arguments):
            completed = subprocess.run(["node", str(CLI), *arguments], cwd=cwd,
                                       check=True, capture_output=True, text=True, timeout=15)
            command = "$ skillwhy " + " ".join(arguments)
            transcript.extend([command, completed.stdout.rstrip(), ""])
            return command, completed.stdout.rstrip().splitlines()

        demo_command, demo = run(["demo"])
        inspect_command, inspection = run(["inspect", "local.snapshot.json", "--skill", "release-review"])
        share_command, share = run(["share", "--snapshot", "local.snapshot.json", "--entry", "demo-entry",
                                    "--alias", "review", "--preview"])
        for source, target in [("maintainer.snapshot.json", "maintainer.share.json"),
                               ("local.snapshot.json", "local.share.json")]:
            run(["share", "--snapshot", source, "--entry", "demo-entry", "--alias", "review", "--out", target])
        diff_command, compared = run(["diff", "maintainer.share.json", "local.share.json", "--detail"])
        share_excerpt = [line for line in share if any(f'"{key}"' in line for key in
            ["artifactKind", "includedEntries", "entryId", "name", "comparisonKey", "locationAlias", "digest"])]
        scenes = [
            ("1 / 4  Find the observed difference", demo_command, demo[:3], 6000),
            ("1 / 4  Find the observed difference", demo_command, demo[:9] + [""] + demo[-2:], 8000),
            ("2 / 4  Choose one returned entry", inspect_command, inspection[:10], 8000),
            ("3 / 4  Preview the selected support file", share_command, share_excerpt, 10000),
            ("4 / 4  Compare the selected observations", diff_command, compared[:10] + [""] + compared[-2:], 10000),
        ]
        frames, durations = [], []
        for heading, command, lines, duration in scenes:
            frame = Image.new("RGB", (1280, 760), "#0b1120")
            draw = ImageDraw.Draw(frame)
            draw.rounded_rectangle((22, 20, 1258, 740), radius=18, fill="#101b2c", outline="#2b3d54", width=2)
            for x, color in [(48, "#fb7185"), (70, "#fbbf24"), (92, "#34d399")]:
                draw.ellipse((x, 43, x + 10, 53), fill=color)
            draw.text((44, 75), "SkillWhy", font=logo, fill="#f8fafc")
            draw.text((290, 88), "SYNTHETIC DEMO / NO LIVE SCAN", font=small, fill="#fbbf24")
            draw.text((44, 138), heading, font=title, fill="#93c5fd")
            y = 196
            for line in textwrap.wrap(command, width=103, subsequent_indent="  "):
                draw.text((44, y), line, font=font, fill="#6ee7b7")
                y += 27
            y += 14
            for line in lines:
                for part in textwrap.wrap(line, width=106, replace_whitespace=False) or [""]:
                    if y > 670:
                        raise RuntimeError("Demo text overflow; shorten the explicitly marked excerpt.")
                    color = "#fbbf24" if "enabled-changed" in part or "true → false" in part else "#d7e1ef"
                    draw.text((44, y), part, font=font, fill=color)
                    y += 26
            draw.text((44, 706), "Actual CLI stdout excerpts · Model execution and Desktop state are not observed", font=small, fill="#9aacbf")
            frames.append(frame.quantize(colors=64))
            durations.append(duration)
        frames[0].save(output / "demo.gif", save_all=True, append_images=frames[1:],
                       duration=durations, loop=0, optimize=True, disposal=2)
        frames[-1].convert("RGB").save(output / "demo-poster.png")
        (output / "demo-transcript.txt").write_text("\n".join(transcript) + "\n")
        subprocess.run(["ffmpeg", "-y", "-i", str(output / "demo.gif"), "-t", "42", "-r", "10",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                        str(output / "demo.mp4")], check=True, capture_output=True, text=True, timeout=90)
    print(json.dumps({"seconds": sum(durations) / 1000, "synthetic": True,
                      "outputs": {path.name: path.stat().st_size for path in sorted(output.glob("demo*"))}}))


if __name__ == "__main__":
    main()
