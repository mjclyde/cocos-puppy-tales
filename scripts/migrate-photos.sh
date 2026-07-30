#!/usr/bin/env bash
# One-shot migration into src/assets/photos/<shoot>/<subject>/<subject>-NN.jpg.
# macOS only — uses the built-in `sips` and `mdls`. Copies; deletes nothing.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=src/assets
DEST=src/assets/photos
COLLARS="blue black brown yellow orange pink purple red green"
MAX_EDGE=2048

# Copy one file to DEST/<shoot>/<subject>/<subject>-NN.jpg, downscaling only when
# it is oversized. `sips -Z` UPSCALES anything smaller than the target, which would
# blur the three sub-2048px Coco photos — hence the branch.
emit() {
  local src="$1" shoot="$2" subject="$3" n="$4" dir out long
  dir="$DEST/$shoot/$subject"
  mkdir -p "$dir"
  out="$(printf '%s/%s-%02d.jpg' "$dir" "$subject" "$n")"
  long="$(sips -g pixelWidth -g pixelHeight "$src" \
          | awk '/pixelWidth/{w=$2}/pixelHeight/{h=$2}END{print (w>h?w:h)}')"
  if [ "$long" -gt "$MAX_EDGE" ]; then
    sips -s format jpeg -s formatOptions 82 -Z "$MAX_EDGE" "$src" --out "$out" >/dev/null
  else
    sips -s format jpeg -s formatOptions 82 "$src" --out "$out" >/dev/null
  fi
}

# List a folder's photos in capture order. Spotlight knows the EXIF date for every
# file here; anything it cannot date sorts last, then by path.
by_capture() {
  find "$1" -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) -print0 \
  | while IFS= read -r -d '' f; do
      d="$(mdls -name kMDItemContentCreationDate -raw "$f" 2>/dev/null || true)"
      case "$d" in ''|'(null)') d='9999-99-99' ;; esac
      printf '%s\t%s\n' "$d" "$f"
    done | sort | cut -f2-
}

rm -rf "$DEST"

# --- 2026-07-23: outdoor headshots, 2 per puppy -----------------------------
for c in $COLLARS; do
  n=1
  by_capture "$SRC/2026-07-23/$c" | while read -r f; do
    emit "$f" 2026-07-23 "$c" "$n"; n=$((n + 1))
  done
done

# --- 2026-07-24: studio shots, group, and Coco ------------------------------
for c in $COLLARS; do
  n=1
  by_capture "$SRC/2026-07-24/$c" | while read -r f; do
    b="$(basename "$f")"
    # IMG_4109/IMG_4122 are byte-identical copies of two of Blue's shots that were
    # also filed under yellow. Their numbering sits inside Blue's run — keep Blue's.
    if [ "$c" = "yellow" ] && { [ "$b" = "IMG_4109.jpeg" ] || [ "$b" = "IMG_4122.jpeg" ]; }; then
      continue
    fi
    emit "$f" 2026-07-24 "$c" "$n"; n=$((n + 1))
  done
done

n=1
by_capture "$SRC/2026-07-24/group-photos" | while read -r f; do
  emit "$f" 2026-07-24 group "$n"; n=$((n + 1))
done

emit "$SRC/2026-07-24/coco.jpeg" 2026-07-24 coco 1

# --- 2026-07-07: one newborn portrait per puppy -----------------------------
for c in $COLLARS; do
  emit "$SRC/litter/collars/$c.jpg" 2026-07-07 "$c" 1
done

# --- 2026-06-26: first-days candids -----------------------------------------
n=1
for f in "$SRC"/litter/gallery/day-*.jpg; do
  emit "$f" 2026-06-26 first-days "$n"; n=$((n + 1))
done

# --- pre-litter: Coco before the puppies ------------------------------------
n=1
by_capture "$SRC/gallery" | while read -r f; do
  emit "$f" pre-litter coco "$n"; n=$((n + 1))
done

echo "done: $(find "$DEST" -type f | wc -l | tr -d ' ') photos"
