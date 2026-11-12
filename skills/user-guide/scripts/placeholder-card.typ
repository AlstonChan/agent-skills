// The standard placeholder card for a screenshot that has not been taken yet.
// placeholder-card.ts compiles it with `--input data=card.json`; every field is a plain string
// and is shown literally, never parsed as markup.

#let card = json(sys.inputs.data)

// Typst only breaks a line at a space or a hyphen. A long path or URL would run off the card, so
// give any long unbroken run a zero-width break opportunity every 24 characters.
#let breakable(s) = s.replace(regex("\\S{24}"), m => m.text + "\u{200B}")

#let sentence(s) = if s.ends-with(regex("[.!?]")) { s } else { s + "." }

#set page(width: 600pt, height: auto, margin: 16pt, fill: rgb("#ececec"))
#set text(font: "Libertinus Serif", size: 14pt, fill: rgb("#333333"))
#set par(leading: 0.65em, spacing: 1em)

#block(width: 100%, stroke: 2pt + rgb("#9a9a9a"), inset: 14pt)[
  #text(weight: "bold", size: 18pt, "REPLACE ME: " + breakable(card.file))

  #text("Shows: " + breakable(card.shows))

  #text("How to get there: " + breakable(card.how))

  #text(
    "Capture it: " + breakable(sentence(card.capture))
      + " Save it as " + breakable(card.file)
      + " in docs/images and mark its row captured in docs/images/IMAGES.md.",
  )
]
