# ARTEM OS

Artem Kotliar’s developer portfolio presents projects, experience, technical skills, and education in a workstation-inspired interface. The standalone [digital contact card](card/index.html) is designed for the URL stored on Artem’s rewritable NFC tag.

## Local development

Use Node.js 22.13 or later with npm and run `npm ci`. The shipped pages use plain HTML, CSS, and browser JavaScript. Development dependencies are used for validation only.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build and serve the site at `http://127.0.0.1:4173`. Open `/` for the portfolio and `/card/` for the contact card. Rerun after edits. |
| `npm run lint` | Check the source code. |
| `npm run typecheck` | Check JavaScript and DOM types. |
| `npm run build` | Export the static files to `dist/`. |
| `npm run preview` | Serve the last static export locally. |
| `npm test` | Exercise navigation, layout, contact actions, and the exported routes in a browser. Run `npm run build` first. |

Set `PORT` to choose a different local port. The browser suite uses Chromium by default and looks for `/usr/bin/chromium`. If Chromium is installed elsewhere, set `BROWSER_PATH` to its executable. Or install the Playwright-managed copy with `npx playwright-core install chromium`. Set `BROWSER=firefox` or `BROWSER=webkit` to run a different installed Playwright engine. Set `ARTEM_SCREENSHOTS` to a directory to save screenshots at the tested widths.

## Design and structure

The shared design system in [`assets/system.css`](assets/system.css) defines a charcoal and navy palette, cyan and violet accents, locally hosted Space Grotesk display typography, a system font for body copy, and monospaced interface labels. Shared tokens control spacing, borders, button states, and motion. The styles respect `prefers-reduced-motion` and preserve visible keyboard focus.

| File | Responsibility |
| --- | --- |
| [`index.html`](index.html) | Portfolio content, conventional section links, project and skill categories, and accessible dialog markup. |
| [`assets/portfolio.css`](assets/portfolio.css) | Portfolio layouts, application windows, and original project illustrations. |
| [`assets/portfolio.js`](assets/portfolio.js) | Project and skill filters, project windows, command palette, and interactive navigation. |
| [`card/index.html`](card/index.html) and [`assets/card.css`](assets/card.css) | Independent, mobile-first contact page and its layout. |
| [`assets/contact.js`](assets/contact.js) | Copy actions, native profile sharing, and fallback feedback. |
| [`artem-kotliar.vcf`](artem-kotliar.vcf) and [`assets/resume.pdf`](assets/resume.pdf) | Public contact and résumé downloads. |

### Portfolio interactions

Use the navigation to reach any section, or open the searchable command palette with **Ctrl+K** on Windows and Linux or **⌘+K** on macOS. **Esc** closes an open window or palette. Projects and technical skills can be filtered by category. The project window provides an expanded view, and experience and skill details open in place. Portfolio sections, contact links, and inline details remain available with JavaScript disabled.

### Contact card

The card resolves directly at `/card/` and loads independently from the portfolio. **Save Contact** downloads a vCard 3.0 file with Artem’s name, professional title, public work email, and portfolio URL. On iOS, open the downloaded card and choose the option to create or add a contact. On Android, select the file from Downloads or import it through the Contacts app. **Share Profile** opens the device share sheet when available, falls back to copying the card URL, and offers a selectable URL if clipboard access is unavailable. The card uses an initials emblem pending an approved professional photograph.

## Static export and GitHub Pages

`npm run build` produces a static `dist/index.html` and `dist/card/index.html` with the assets and contact file they reference. A static host that serves directory indexes can open `/card/` directly. The slashless `/card` can redirect to the directory URL. The relative asset and page links also work when `dist/` is mounted at a GitHub Pages project path such as `/repository-name/`, with the card at `/repository-name/card/`.

The current GitHub Pages source is the repository root on `main`. `CNAME` declares the custom domain `artem-kotliar.me`. The source tree itself is static, and the export includes the files needed to serve it from an artifact. The build and local preview have no deployment step. If the public host changes, update `CNAME` as appropriate, the canonical and social URLs in both HTML documents, and the public website URL in the vCard.

## Program the NFC tag

1. After the card is released, open `https://artem-kotliar.me/card/` directly on mobile data. Check the contact buttons, résumé download, vCard import, and sharing.
2. In an NFC-writing app on an NFC-capable phone, add a single **URL** record using the standard NDEF URI format. Enter `https://artem-kotliar.me/card/` exactly as written, including `https://` and the trailing slash.
3. Select **Write** and hold the phone near the rewritable tag until the app confirms the write. Keep the tag writable if the URL may need to change.
4. Scan the tag from an iPhone and an Android phone when possible. Unlock the phone, hold its NFC antenna near the tag, and open the system’s URL notification. Confirm the card opens directly and the four primary actions are visible. Visitors can open the URL in their normal browser and can also use the URL directly.

## Maintenance

- Update [`index.html`](index.html) and [`card/index.html`](card/index.html) together when public profile details change. Update contact link targets, copy values, and [`artem-kotliar.vcf`](artem-kotliar.vcf) when an approved address or URL changes.
- Keep the vCard to details approved for public sharing. Preserve its vCard format and CRLF line endings when editing. Open the resulting file in a contacts app to verify the name, title, email, and website after an update.
- Replace [`assets/resume.pdf`](assets/resume.pdf) with the current public PDF from the [résumé repository](https://github.com/NotRyuzaki01/resume). Review the exported PDF before adding it to the site since it can contain more information than the contact card.
- Review availability, ongoing roles, education dates, and published metrics before release. The source portfolio has no verified course list, public demos for featured projects, or approved portrait and project screenshots. Add these when source materials are provided. The project graphics are original illustrations.
- Keep canonical and Open Graph metadata accurate. The branded preview image is [`assets/social-card.png`](assets/social-card.png). Use an absolute HTTPS URL for the image, and verify the card link’s preview after release.
- After edits, build and run the checks. Before reprogramming a tag, verify the public card URL on an actual phone and test a clean contact import.
