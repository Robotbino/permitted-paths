# Presentation

This folder holds the source of the slide deck "Permitted Paths — Graph Engineering for Agents". The deck teaches the course in 33 slides. It follows parts 0 to 8.

The site does not load these files. They are not part of the course page.

## Files

- `deck.json` is the index. `order` gives the sequence of the slides. `sections` gives the outline. `faces` gives the three typefaces (Google Fonts links).
- `slides/<id>.html` is one slide. Each file holds one `<section>` on a fixed canvas of 1920 × 1080 px. All styles are inline.
- The speaker notes of a slide are in the `<aside>` at the end of its `<section>`.

A slide file is a fragment. It has no `<html>` or `<head>`, and a browser does not show it correctly if you open it alone. The deck was made with the Slides type of Claude artifacts, which reads these files.

## Content

- The prose comes from `index.html`: the claim, the tables and the key ideas.
- The code on the slides is an example for teaching. It is not a library, and no test in this repository runs it.
- Slide 4 shows five example answers. They are examples, not a recording.
- The widths of the bars on slide 7 are a drawing of the idea, not measurements.

## To change a slide

Change the file in `slides/`. Keep the `id` of the `<section>` the same as the file name. If you add or remove a slide, change `order` in `deck.json` also.
