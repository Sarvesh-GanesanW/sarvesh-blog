# Notes by Sarvesh Ganesan

Engineering notes on agentic AI, retrieval, LLM cost and Kubernetes, live at
https://sarvesh-ganesanw.github.io/sarvesh-blog/.

The site is drawn as a set of engineering drawings:

- **The register** (`index.html`) lists every note on a cyanotype sheet, with
  a title block on the right. Recent notes get a small key-plan schematic and
  an excerpt; earlier notes are listed by title and date. Readers can search
  and pick a topic.
- **The reading sheet** (`post.html?slug=<slug>`) renders one note on white
  paper, with a mini title block (note number, issue date, reading time,
  topics), a key plan of the sections in the margin, and links to the newer
  and older note. With a dark system preference the sheet turns into a
  cyanotype: white type on the blue ground.

Plain HTML, CSS and JavaScript; no build step. Posts are Markdown, rendered in
the browser with [marked](https://marked.js.org/) and highlighted with
[Prism](https://prismjs.com/) (both pinned on jsDelivr). The typeface is
Archivo from Google Fonts; code uses the system monospace font.

## Files

```
sarvesh-blog/
├── index.html                 # The register
├── post.html                  # The reading sheet for any post
├── script.js                  # NOTES (the list of posts), register and sheet logic
├── style.css                  # All styles: tokens, register, sheet, figures
├── figures/
│   └── headroom-demand.js     # Interactive figure for the headroom-scaler post
├── posts/                     # One Markdown file per post
└── .nojekyll                  # Serve posts/*.md as-is on GitHub Pages
```

## Add a post

1. Write `posts/<slug>.md`. The front matter is optional and ignored by the
   site; a leading `# Title` line is dropped because the sheet header shows
   the title.

   ```markdown
   ---
   title: "Your post title"
   date: "2026-12-01"
   ---

   # Your post title

   Opening paragraph...

   ## First section
   ```

2. Add the post to `NOTES` at the top of `script.js`. That list is the only
   place the site learns about a post:

   ```javascript
   {
       slug: 'your-post-slug',            // the file name without .md
       title: 'Your post title',          // sentence case
       date: '2026-12-01',
       excerpt: 'One sentence that says what the reader will learn.',
       tags: ['AI', 'Python'],            // become the topic filters
       keyPlan: 'hybrid-retrieval'        // optional, a key of KEY_PLANS
   },
   ```

   Note numbers (N1, N2, ...) follow the dates, and reading time is counted
   from the text, so neither is written by hand. A post without `keyPlan`
   gets a generic sheet schematic. Mark a post `earlier: true` to list it
   under "Earlier notes" with title and date only. Set `hasFigure: true` if
   it contains an interactive figure.

3. To draw a key plan of its own, add an entry to `KEY_PLANS` in
   `script.js`: SVG shapes in a 200 × 110 box using the classes `ln`
   (line), `thin`, `dash`, `hatch` and `solid`.

4. Commit and push to `main`; GitHub Pages publishes it.

## Add an interactive figure

1. Write `figures/<name>.js` exporting `mountFigure(figureElement)`. It
   receives the empty `<figure>` and fills it with controls, an SVG and a
   caption. Reuse the figure classes in `style.css` (`fig-controls`,
   `fig-draw`, `fig-read`, `fig-legend`, `paper-btn`) so it matches the sheet
   in both light and dark.
2. Register it in `FIGURES` in `script.js`:
   `'<name>': './figures/<name>.js'`.
3. Place it in the post where it belongs, as a raw HTML line with blank
   lines around it:

   ```html
   <figure class="js-figure" data-figure="<name>"></figure>
   ```

The module is loaded only on pages that use it. If it fails to load, the
figure says so and the text around it still reads on its own.

## Run locally

`post.html` fetches the Markdown, so serve the folder rather than opening
the files directly:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Design rules

The look is held by a small system in `style.css`; keep to it when adding
anything:

- Spacing on a 4 px scale (4, 8, 12, 16, 24, 32, 48, 64, 96).
- One border width (1 px) for all UI; the 2 px focus ring is the only other.
  Lineweights inside SVG drawings may vary, since they carry meaning.
- Square corners, no shadows.
- Signal yellow only for the current item, keyboard focus and the one
  primary action of a view; blue and white carry everything else.
- Hierarchy through weight, width and colour in Archivo; monospace only for
  code.
- Motion under 300 ms with an ease-out curve, on transform and opacity only,
  and none when the reader prefers reduced motion.
- Every control at least 44 px tall to tap.

## Contact

- LinkedIn: [sarvesh-ganesan09](https://linkedin.com/in/sarvesh-ganesan09)
- GitHub: [Sarvesh-GanesanW](https://github.com/Sarvesh-GanesanW)
- Email: sarveshganesan2002@gmail.com
