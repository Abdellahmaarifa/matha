"""One-off tool: builds the small, gender-sorted photo pool that ships with the
repo (`seed/photos/male`, `seed/photos/female`) from a local CelebA-HQ dataset
checkout.

Not run automatically. The pool it produces is already committed, so this
only needs to be re-run if someone wants to regenerate/resize that pool from
scratch. It never ships the source dataset itself (too large for git) - only
the POOL_SIZE-per-gender resized copies it selects.

Usage:
    python seed/prepare_seed_photos.py /path/to/CelebAMask-HQ
"""
import os
import random
import sys

from PIL import Image

POOL_SIZE_PER_GENDER = 300
OUTPUT_SIZE = (480, 480)
JPEG_QUALITY = 85
SEED = 42

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "photos")


def load_gender_labels(dataset_dir: str) -> dict[str, bool]:
    """Returns {filename: is_male} parsed from the CelebAMask-HQ attribute file."""
    attr_path = os.path.join(dataset_dir, "CelebAMask-HQ-attribute-anno.txt")
    labels = {}
    with open(attr_path) as f:
        f.readline()  # total count
        header = f.readline().split()
        male_idx = header.index("Male")
        for line in f:
            parts = line.split()
            filename = parts[0]
            is_male = parts[1 + male_idx] == "1"
            labels[filename] = is_male
    return labels


def resize_and_save(src_path: str, dst_path: str) -> None:
    with Image.open(src_path) as img:
        img = img.convert("RGB")
        img.thumbnail(OUTPUT_SIZE, Image.LANCZOS)
        img.save(dst_path, "JPEG", quality=JPEG_QUALITY, optimize=True)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    dataset_dir = sys.argv[1]
    img_dir = os.path.join(dataset_dir, "CelebA-HQ-img")
    if not os.path.isdir(img_dir):
        print(f"Not found: {img_dir}")
        sys.exit(1)

    labels = load_gender_labels(dataset_dir)
    male_files = sorted(f for f, is_male in labels.items() if is_male)
    female_files = sorted(f for f, is_male in labels.items() if not is_male)

    rng = random.Random(SEED)
    rng.shuffle(male_files)
    rng.shuffle(female_files)

    male_dir = os.path.join(OUTPUT_DIR, "male")
    female_dir = os.path.join(OUTPUT_DIR, "female")
    os.makedirs(male_dir, exist_ok=True)
    os.makedirs(female_dir, exist_ok=True)

    for filename in male_files[:POOL_SIZE_PER_GENDER]:
        resize_and_save(os.path.join(img_dir, filename), os.path.join(male_dir, filename))
    for filename in female_files[:POOL_SIZE_PER_GENDER]:
        resize_and_save(os.path.join(img_dir, filename), os.path.join(female_dir, filename))

    print(f"Wrote {POOL_SIZE_PER_GENDER} male photos to {male_dir}")
    print(f"Wrote {POOL_SIZE_PER_GENDER} female photos to {female_dir}")


if __name__ == "__main__":
    main()
