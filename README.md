# Bull Run Escape

An incremental browser game starring the Daily Bull Run mascot. A bull grazes,
gets put to work by the Man, fights for a bigger share of his pay, then finds a
newspaper that shows him a way out.

This build covers grazing, ploughing and the newspaper. Investing comes next.

## Files

- `index.html`: the page
- `style.css`: the look
- `engine.js`: rules and numbers, with no page code
- `game.js`: drawing, tapping, story and saving
- `assets/`: sprites cut from the character sheet
- `tools/`: scripts for cutting sprites, checking pacing and testing

## Run it

It is a static site with no build step. Serve the folder with any web server:

    python3 -m http.server 8000

Then open http://localhost:8000. To host it, upload these files to any static
host, or turn on GitHub Pages for this repo.

Check the pacing with `node tools/simulate.js 4`, where 4 is taps per second.
