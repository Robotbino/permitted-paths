# Presentation

This folder contains the source of the slide deck "Permitted Paths — Graph Engineering for Agents". The deck teaches the course in 33 slides. It follows parts 0 to 8.

The site does not load these files. They are not part of the course page.

## Files

- `deck.json` is the index. `order` gives the sequence of the slides. `sections` gives the outline. `faces` gives the three typefaces (Google Fonts links).
- `slides/<id>.html` is one slide. Each file holds one `<section>` on a fixed canvas of 1920 × 1080 px. All styles are inline.
- The speaker notes of a slide are in the `<aside>` at the end of its `<section>`.

A slide file is a fragment. It has no `<html>` or `<head>`, and a browser does not show it correctly if you open it alone. The Slides type of Claude artifacts made the deck. It reads these files.

## Exported copies

Four files are exports of the deck from the deck page, made on 2026-11-12 after the appearance pass. They are copies. If you change a slide, they do not change; export the deck again.

- `Permitted Paths — Graph Engineering for Agents.html`: the deck as one web page.
- `slides/Permitted Paths — Graph Engineering for Agents.pdf`: the deck as a PDF.
- `slides/Permitted Paths — Graph Engineering for Agents.pptx`: the deck for PowerPoint.
- `slides/Permitted Paths — Graph Engineering for Agents(Editable).pptx`: the deck for PowerPoint, as an editable version.

## Content

- The text comes from `index.html`: the claim, the tables and the key ideas.
- The code on the slides is an example for teaching. It is not a library, and no test in this repository runs it.
- Slide 4 shows five example answers. They are examples, not a recording.
- The widths of the bars on slide 7 are a drawing of the idea, not measurements.

## To change a slide

Change the file in `slides/`. Keep the `id` of the `<section>` the same as the file name. If you add or remove a slide, change `order` in `deck.json` also.
