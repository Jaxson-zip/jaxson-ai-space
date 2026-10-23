"""Regenerate optimized copies; originals remain unchanged. Requires Pillow."""
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import json
from PIL import Image

public = Path(__file__).resolve().parents[1] / "public"
output = public / "optimized"
output.mkdir(exist_ok=True)
assets = {}
for stem, widths in {
    "jaxson_character_navy_v1": [512, 1024],
    "todo-memo-cover": [900],
    "jaxson-ai-space-home-20261022": [900, 1440],
}.items():
    with Image.open(public / f"{stem}.png") as original:
        variants = []
        for width in widths:
            height = round(original.height * width / original.width)
            resized = original.resize((width, height), Image.Resampling.LANCZOS)
            buffer = BytesIO()
            resized.save(buffer, "WEBP", quality=86, method=6)
            body = buffer.getvalue()
            name = f"{stem}-{width}.{sha256(body).hexdigest()[:12]}.webp"
            (output / name).write_bytes(body)
            variants.append({"src": f"./optimized/{name}", "width": width, "height": height, "bytes": len(body)})
        assets[stem] = variants
(output / "images.json").write_text(json.dumps(assets, indent=2) + "\n", encoding="utf-8")
print(json.dumps(assets, indent=2))
