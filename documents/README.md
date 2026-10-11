# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

**Live site:** <https://zandilemkontwana.github.io/olympiad-portal/>

## Installation

```bash
npm install
```

**Note**: feel free to use the package manager of your choice.

## Local Development

```bash
npm run start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Docs deploy automatically to Netlify: every push to `main` runs [`../.gitea/workflows/deploy-docs.yml`](../.gitea/workflows/deploy-docs.yml), which builds this folder and publishes the `build/` directory. There is nothing to run manually — merge or push to `main` and the site updates a few minutes later.

Manual fallback (needs the Netlify CLI linked to the site in `documents/.netlify/state.json`):

```bash
npm run build
npx netlify deploy --prod --dir=build
```
