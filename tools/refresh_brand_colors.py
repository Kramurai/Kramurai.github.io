"""Apply the approved green petrol palette to native SVG brand assets."""
import argparse
import re
from pathlib import Path

# Header colors are the exact approved B comparison. Additional shades retain
# the existing detailed K's separate light, middle and shadow facets.
PALETTE = {
    '#0F4C5C': '#18554D', '#1B626F': '#23695F',
    '#2A7F8F': '#2F8073', '#73BCC6': '#78BEAB',
    '#08313E': '#0C3933', '#A2C8CE': '#A4C9BC',
    '#B9D6DB': '#BDD9CC', '#D2E4E7': '#D6E8DF',
    '#638F9A': '#659687',
}
COLOR = re.compile(r'#[0-9a-fA-F]{6}')


def recolor(text):
    result = COLOR.sub(lambda m: PALETTE.get(m[0].upper(), m[0]), text)
    assert COLOR.sub('#COLOR', text) == COLOR.sub('#COLOR', result)
    return result


def refresh(directory):
    changed = 0
    for path in Path(directory).rglob('*.svg'):
        old = path.read_text(encoding='utf-8')
        new = recolor(old)
        if old != new:
            path.write_text(new, encoding='utf-8')
            changed += 1
    return changed


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    print(f'Updated {refresh(args.directory)} SVGs; geometry preserved.')
