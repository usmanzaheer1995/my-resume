# Resume

A print-ready A4 resume rendered in the browser from a single JSON file.

All content lives in `resume.json`. `resume.js` reads it and builds the page;
`resume.html` is just a shell.

## Files

| File | Purpose |
| --- | --- |
| `resume.json` | All content - header, contact, jobs, education, skills, projects, certificates |
| `resume.js` | Renders the JSON into the page and handles pagination |
| `styles.css` | Colours, fonts, sizes, layout. Theme variables at the top |
| `resume.html` | Page shell plus the SVG icon sprite |
| `photo.jpg` | Offline fallback for the Gravatar portrait |

## Editing

Edit `resume.json`. Nothing else needs to change for ordinary updates but adding a
job, a skill, a bullet, or a certificate.

## Preview

The page fetches `resume.json`, and browsers block `fetch()` on `file://` URLs,
so **opening `resume.html` by double-clicking it will not work**. Serve the
folder instead:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/resume.html>. If you open it the wrong way the
page tells you so rather than sitting blank.

## Making a PDF

With the page open over HTTP: `Cmd+P | Control+P` → Destination **Save as PDF**, Paper
**A4**, Margins **None**, and tick **Background graphics**.

Let the page finish loading first. The layout is measured after the Lato webfont
arrives, and the portrait is fetched from Gravatar, so printing the instant the
page opens can catch it mid-load.

## Multiple pages

Page 1 is a fixed A4 sheet: header, work experience on the left, grey sidebar on
the right. When content no longer fits, `resume.js` measures the overflow and
moves it onto continuation pages with full width, no sidebar, with a slim name and
page-number bar at the top. Page 1 is left untouched whenever everything fits.

Nothing is silently dropped; add as many jobs as you like.

## The photo

You can either have a file called `photo.jpg` locally, or an uploaded photo (or both!).

`--photo` in `styles.css` stacks two layers: the Gravatar URL on top, `photo.jpg`
underneath. If the network is unavailable the top layer fails to paint and the
local file shows through, so the resume never renders faceless.

Change the picture at [gravatar.com](https://gravatar.com) and it updates here,
no edit needed. Refresh `photo.jpg` too if you want the offline fallback to match.

## Adding a new kind of section

`resume.json` sections are rendered by name. A new one needs three things:

1. A key under `sections` in `resume.json`, with `heading`, `icon`, and `column`
   (`"left"` or `"right"`).
2. A matching entry in the `RENDERERS` map in `resume.js`, returning the nodes
   to place under the heading.
3. A `<symbol id="icon-NAME">` in the sprite at the top of `resume.html`.

An unrecognised section key is skipped with a console warning.

## Hosting

Any static host works. On GitHub Pages the files are served over HTTP, so the
page loads normally and no local server is needed.
