// The standard placeholder card for a screenshot that has not been taken yet.
// placeholder-card.ts compiles it with `--input data=card.json`; every field is a plain string
// and is shown literally, never parsed as markup.

#let card = json(sys.inputs.data)

// Typst only breaks a line at a space or a hyphen. A long path or URL would run off the card, so
// give any long unbroken run a zero-width break opportunity every 24 characters.
#let breakable(s) = s.replace(regex("\\S{24}"), m => m.text + "\u{200B}")

#let sentence(s) = if s.ends-with(regex("[.!?]")) { s } else { s + "." }

// A bold label, then the field's text as a plain string.
#let field(label, value) = [#text(weight: "bold", label + ": ")#text(value)]

#let red = rgb("#c62828")

// Red diagonal stripes round the card, so it can never pass for a real screenshot on the page.
#let stripes = tiling(size: (14pt, 14pt))[
  #place(line(start: (0pt, 14pt), end: (14pt, 0pt), stroke: 4pt + red))
  #place(line(start: (-7pt, 7pt), end: (7pt, -7pt), stroke: 4pt + red))
  #place(line(start: (7pt, 21pt), end: (21pt, 7pt), stroke: 4pt + red))
]

#set page(width: 600pt, height: auto, margin: 0pt, fill: white)
// DejaVu Sans Mono is embedded in Typst, so `--ignore-system-fonts` draws the same card everywhere.
#set text(font: "DejaVu Sans Mono", size: 12pt, fill: rgb("#222222"))
#set par(leading: 0.6em, spacing: 0.9em)

#block(width: 100%, fill: stripes, inset: 10pt)[
  #block(width: 100%, fill: rgb("#f2f2f2"), inset: 16pt)[
    #text(weight: "bold", size: 15pt, fill: red, "REPLACE ME: " + breakable(card.file))

    #field("Shows", breakable(card.shows))

    #field("How to get there", breakable(card.how))

    #field(
      "Capture it",
      breakable(sentence(card.capture))
        + " Save it as " + breakable(card.file)
        + " in docs/images and mark its row captured in docs/images/IMAGES.md.",
    )
  ]
]
