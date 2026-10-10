# FELTrace public reading preview

A static snapshot of the existing FELTrace public reading pages. Papers, facilities, selected research and report editions keep their public source attribution and dates. Search, filters, bookmarks and themes run in the browser. No backend credentials or database are shipped.

This repository contains public generated output under `site/`; initial snapshot history may remain in Git and deployments after later corrections. It is separate from the private collector workspace and the complete AIHOT reference archive.

## Refresh locally

Run the existing FELTrace service on localhost:3000. Install the pinned Cheerio dependency with `npm ci` in this directory, then run `npm run export` and `npm test`. In the original workspace the exporter can reuse the existing app's installed Cheerio package.

`npm run preview` serves http://127.0.0.1:4174/feltrace/. Commit only the reviewed public directory and push to this repository's `main` branch to run the Pages workflow. The export itself never pushes or starts collection/model work. No scheduled push is installed in this initial preview.

First publication requires review of the public use/privacy copy. GitHub Pages uses a public repository and must be configured with the GitHub Actions build type. Public URL: https://powell-wu.github.io/feltrace/ . This is the intended address, not evidence of an existing deployment.

## Attribution

The page rendering and styling derive from AIHOT, MIT licensed, with FELTrace customization. AIHOT brand assets are not used. See LICENSE. Third-party papers, abstracts and licensed figures retain their own rights and attributions; the code license does not relicense their content.
