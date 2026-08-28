# Accessibility statement for The Slingshot

**Applies to:** The Slingshot simulation (the game itself, served at `/play`).
**Prepared:** 3 August 2026. **Last tested:** 3 August 2026.
**Prepared by:** Ammon Salter, Warwick Business School.
**Testing:** manual keyboard and screen-reader testing by the project team, supported by
automated engine scans.

---

## Our commitment

We want as many people as possible to be able to use The Slingshot. It is a teaching resource,
free and open-source, and it should be usable by students who navigate by keyboard, use a screen
reader, magnify the display, or prefer reduced motion.

## How accessible this game is

We believe The Slingshot is **partially conformant with WCAG 2.2 level AA**. Partially conformant
means most of the standard is met, with the exceptions listed below.

The game has been made operable by keyboard throughout: every screen, every control, the
drag-and-drop market board, and the timed mini-games. A player has completed a full game start to
finish using the keyboard alone.

## Who did the testing

The keyboard testing was done by a person, not a tool. A tester played The Slingshot from the
opening screen to the end of a full game using only the keyboard, said what did and did not work,
and repeated the exercise on the screens that were changed as a result. A second session went
through the game with a screen reader running. Between them, those sessions found faults that
three separate automated engines had been reporting as clean for a fortnight: two opening screens
that could not be operated by keyboard at all, a drag-and-drop board with no keyboard route,
controls that announced a decorative emoji instead of their label, and sliders that read a bare
number where the currency mattered. None of that was visible to any tool.

The transcript and visual description of the intro video were written by the author from the
source material.

Automated testing supported this work; it did not lead it.

## What we have tested, and how

**Automated engine testing.** axe-core in a real browser (headless Chromium) across seven display
conditions — desktop, dark mode, mobile 375px, reflow at 320px, reduced motion, 200% zoom and
400% zoom at 320px — over five screens, giving 35 scans. No violations originate in the game.
Full results: `Accessibility-Toolkit/audits-and-reports/BROWSER-SCAN-2026-08-03.md`.

**Keyboard testing by a person.** A tester played a complete game using only the keyboard, on
macOS with Safari. A second, shorter session checked the opening screens, the market board and a
mini-game.

**Regression testing.** Nine automated test files cover the accessibility behaviour itself —
focus management, naming, dialog descriptions, keyboard routes — and are run whenever the
accessibility layer changes.

## Known limitations

**The intro video is hosted by Google Drive.** Google's own player markup inside that iframe
produces accessibility faults we cannot correct (`aria-prohibited-attr`, and at 400% zoom
`aria-hidden-focus`). The video's full transcript and a description of its visual content are
provided on the page beneath it, so no information is lost.

**The conference mini-game requires clicking moving targets.** Delegates can be reached by
keyboard, but tabbing to a moving target under a 3–7 second timer has not been assessed for
usability. We may add a dedicated keyboard route or an option to skip this mini-game.

**Heading order and landmarks.** Some headings skip a level, and some content sits outside a
landmark region. These are best-practice warnings rather than level A or AA failures, and are
noted for a future tidy of the game's structure.

**Screen-reader usability.** The game's content is exposed correctly to assistive technology and
has been verified in a browser. What has not yet been carried out is a full session with a fluent
screen-reader user, to judge whether the announcements are useful, correctly timed, and not
excessive. Until that is done we claim only that the game is technically exposed to screen
readers, not that it has been proven usable with one.

**Automated coverage of in-play screens.** Automated browser testing covers the opening flow
(landing, How It Works, founder selection, tutorial, About). The main game board, the modals
reached during play and the mini-games have been tested by a human keyboard player, but not yet
by the browser engine scan.

## Feedback

If you find a problem, or need the game in a different format, please contact
Ammon Salter at Warwick Business School.

## Technical information

This statement applies to the simulation only. The Slingshot website and its video feed are
covered separately and have not been assessed to this standard.

**Preparation.** This statement was prepared on 3 August 2026 following testing carried out on
the same date against WCAG 2.2 level AA, using axe-core 4.12.1 in headless Chromium, manual
keyboard testing in Safari on macOS, and a bespoke regression suite.
