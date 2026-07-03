#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PNG 파일의 흰색 배경을 투명하게 변환하는 스크립트
White background to transparent converter for PNG files
"""

import os
import sys
from pathlib import Path

# Windows 콘솔 인코딩 설정
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

try:
    from PIL import Image
except ImportError:
    print("Pillow library required. Installing...")
    os.system(f"{sys.executable} -m pip install Pillow")
    from PIL import Image


def remove_white_background(image_path: Path, tolerance: int = 30) -> bool:
    """
    Remove white/bright background from image and make it transparent

    Args:
        image_path: Path to PNG file
        tolerance: Range for considering white (0-255, default 30)

    Returns:
        Success status
    """
    try:
        # Open image
        img = Image.open(image_path)

        # Convert to RGBA (add alpha channel)
        img = img.convert("RGBA")

        # Get pixel data
        data = img.getdata()

        new_data = []
        for pixel in data:
            r, g, b, a = pixel

            # Convert white or near-white pixels to transparent
            threshold = 255 - tolerance
            if r >= threshold and g >= threshold and b >= threshold:
                # Make fully transparent
                new_data.append((r, g, b, 0))
            else:
                # Keep original
                new_data.append(pixel)

        # Apply new data
        img.putdata(new_data)

        # Save (overwrite original)
        img.save(image_path, "PNG")

        return True

    except Exception as e:
        print(f"  Error: {e}")
        return False


def process_directory(directory: Path, tolerance: int = 30) -> tuple:
    """
    Process all PNG files in directory

    Args:
        directory: Directory to process
        tolerance: White tolerance range

    Returns:
        (success_count, fail_count)
    """
    success_count = 0
    fail_count = 0

    # Find PNG files
    png_files = list(directory.rglob("*.png"))

    if not png_files:
        print(f"No PNG files found in '{directory}'")
        return 0, 0

    print(f"\nProcessing {len(png_files)} PNG files...\n")

    for png_file in png_files:
        relative_path = png_file.relative_to(directory)
        print(f"Processing: {relative_path}", end=" ... ")

        if remove_white_background(png_file, tolerance):
            print("[OK]")
            success_count += 1
        else:
            print("[FAIL]")
            fail_count += 1

    return success_count, fail_count


def main():
    print("=" * 60)
    print("  PNG White Background Remover")
    print("=" * 60)

    # Project assets path
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    assets_dir = project_root / "public" / "assets"

    if not assets_dir.exists():
        print(f"\nAssets directory not found: {assets_dir}")
        sys.exit(1)

    print(f"\nAssets directory: {assets_dir}")

    # Subdirectories to process
    subdirs = ["character", "monster", "weapon", "gem"]

    total_success = 0
    total_fail = 0

    for subdir in subdirs:
        subdir_path = assets_dir / subdir
        if subdir_path.exists():
            print(f"\n{'='*40}")
            print(f"[FOLDER] {subdir}")
            print(f"{'='*40}")
            success, fail = process_directory(subdir_path, tolerance=30)
            total_success += success
            total_fail += fail
        else:
            print(f"\n[WARNING] '{subdir}' folder not found. Skipping.")

    # Print results
    print(f"\n{'='*60}")
    print("  Processing Complete!")
    print(f"  Success: {total_success}")
    print(f"  Failed: {total_fail}")
    print(f"{'='*60}")

    if total_fail > 0:
        print("\n[!] Some files failed. Please check manually.")
    else:
        print("\n[OK] All files processed successfully!")
        print("     Refresh the game to see changes.")


if __name__ == "__main__":
    main()
