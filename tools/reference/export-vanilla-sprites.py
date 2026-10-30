"""Export audited local Vanilla sprite frames to a private directory. Never downloads assets."""
import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client", action="append", required=True, metavar="VERSION=JAR")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if output == REPO or REPO in output.parents:
        parser.error("Original resources must stay outside the repository")
    if output.exists():
        parser.error("Choose a new private output directory; existing files are never overwritten")
    evidence = json.loads((REPO / "tests/fixtures/client/vanilla-sprite-catalog.json").read_text())
    clients = {}
    for value in args.client:
        version, separator, path = value.partition("=")
        if not separator or version not in evidence["clients"] or version in clients:
            parser.error("Each --client must name one unique audited VERSION=JAR")
        source = Path(path).resolve()
        if hashlib.sha1(source.read_bytes()).hexdigest() != evidence["clients"][version]["clientSha1"]:
            parser.error("Client archive does not match the audited official version hash")
        clients[version] = source
    output.mkdir(parents=True)
    (output / ".gitignore").write_text("*\n")
    for version, source in clients.items():
        manifest = {"schemaVersion": 1, "clientVersion": version, "sprites": {}}
        with zipfile.ZipFile(source) as archive:
            for sprite, entry in evidence["clients"][version]["sprites"].items():
                pixels = archive.read(entry["resource"])
                if hashlib.sha256(pixels).hexdigest() != entry["sha256"]:
                    raise ValueError("Resource hash mismatch")
                image = Image.open(io.BytesIO(pixels)).convert("RGBA")
                width, height = entry["frameSize"]
                columns = image.width // width
                frames = []
                for order, frame in enumerate(entry["frames"]):
                    name = sprite.removeprefix("minecraft:") + f"-{order}.png"
                    target = output / version / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    x = frame["index"] % columns * width
                    y = frame["index"] // columns * height
                    image.crop((x, y, x + width, y + height)).save(target)
                    frames.append({"url": f"/_motd/vanilla-sprites/{version}/{name}", "ticks": frame["ticks"]})
                manifest["sprites"][sprite] = {"frames": frames}
        (output / version / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"{version}: exported {len(manifest['sprites'])} audited sprites to private output")


if __name__ == "__main__":
    main()
