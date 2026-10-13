# Game assets

Keep image and audio assets grouped by what they represent:

- `characters/` — player and NPC sprites, including cutouts.
- `trains/` — train carriages and train variants.
- `railways/` — tracks, rails, and railway cutouts.
- `backgrounds/` — location-specific sky, landscape, and scene layers.
- `stations/` — station buildings, platforms, signs, and station designs.
- `scenery/` — reusable trees, clouds, birds, mountains, and other props.

The app serves this directory at `/assets/`, so runtime paths include the category
folder (for example, `/assets/trains/train_cutout.png`). Keep filenames descriptive
and use a location or variant name when a category contains multiple designs.
