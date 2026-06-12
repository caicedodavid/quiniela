"""
crop_photos.py — Smart 1:1 face-aware crop for participant photos.

For each image in data/photos/:
  1. Detect faces with OpenCV Haar cascade
  2. Center the square crop around the detected face (with headroom above)
  3. Fall back to center crop if no face found
  4. Overwrite the file in place

Run once: python3 crop_photos.py
"""
import pathlib, sys
import cv2
import numpy as np
from PIL import Image

PHOTOS_DIR = pathlib.Path(__file__).parent / "data" / "photos"
EXTS       = {".jpg", ".jpeg", ".png", ".webp"}

# Extra headroom above the face box (fraction of face height)
HEAD_ROOM  = 0.9


def find_face_center(img_path):
    """Return (cx, cy) of best face in image, or None."""
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(cascade_path)

    img_bgr = cv2.imread(str(img_path))
    if img_bgr is None:
        return None

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Try progressively more permissive detection
    for scale in [1.1, 1.2, 1.3]:
        faces = cascade.detectMultiScale(
            gray, scaleFactor=scale, minNeighbors=4,
            minSize=(max(30, w // 10), max(30, h // 10)),
        )
        if len(faces):
            # Pick largest face
            fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
            cx = fx + fw // 2
            cy = fy + fh // 2 - int(fh * HEAD_ROOM * 0.3)  # shift up a little
            return cx, cy

    return None  # no face found


def square_crop(img: Image.Image, cx: int, cy: int) -> Image.Image:
    """Crop img to a square centered as close to (cx, cy) as possible."""
    w, h   = img.size
    side   = min(w, h)
    left   = max(0, min(cx - side // 2, w - side))
    top    = max(0, min(cy - side // 2, h - side))
    return img.crop((left, top, left + side, top + side))


def center_crop(img: Image.Image) -> Image.Image:
    w, h = img.size
    side = min(w, h)
    return square_crop(img, w // 2, h // 2)


def process(path: pathlib.Path):
    img = Image.open(path).convert("RGB")
    w, h = img.size

    center = find_face_center(path)
    if center:
        cx, cy = center
        cropped = square_crop(img, cx, cy)
        method  = f"face @ ({cx},{cy})"
    else:
        cropped = center_crop(img)
        method  = "center fallback"

    # Save back in original format (keep filename/ext)
    fmt = "JPEG" if path.suffix.lower() in {".jpg", ".jpeg"} else path.suffix[1:].upper()
    cropped.save(path, fmt, quality=92)
    print(f"  {path.name}: {w}x{h} -> {cropped.size[0]}x{cropped.size[1]}  [{method}]")


def main():
    photos = [p for p in PHOTOS_DIR.iterdir() if p.suffix.lower() in EXTS]
    if not photos:
        sys.exit("No photos found in data/photos/")

    print(f"Cropping {len(photos)} photo(s) to 1:1...\n")
    for p in sorted(photos):
        try:
            process(p)
        except Exception as e:
            print(f"  {p.name}: ERROR — {e}")

    print("\nDone. Commit with --no-verify when happy.")


if __name__ == "__main__":
    main()
