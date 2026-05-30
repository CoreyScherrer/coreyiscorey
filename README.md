# coreyiscorey.com

A playground for self-contained experiments. Lives at https://coreyiscorey.com.

## What this repo is

The **homepage** for the coreyiscorey.com domain — the static landing page that lists projects living under sub-paths (e.g. `/visualizer/`). Each project is a separate repo and deploys independently.

## What this repo is NOT

- Not the projects themselves. Visualizer lives at [CoreyScherrer/visualizer](https://github.com/CoreyScherrer/visualizer).
- Not a build pipeline. Pure static HTML/CSS, no bundler, no framework.

## Layout

```
coreyiscorey/
├── public/
│   ├── index.html      ← the playground homepage
│   ├── tokens.css      ← design tokens inherited from coreyscherrer.com
│   └── styles.css      ← homepage-specific styles
└── README.md
```

## Style system

Inherits the design tokens from coreyscherrer.com (colors, fonts, radius, shadow) via `public/tokens.css`. To resync after the upstream tokens change:

```bash
cp /path/to/coreyscherrer.com/dev/www-app/static/design/tokens.css public/tokens.css
```

Layout/component styles in `styles.css` use the `--color-cs-dark-*` and `--font-family-public-*` namespaces so the theme stays cohesive without inheriting upstream layout.

## Deploy

Deploys to `/var/www/coreyiscorey/www/` on the iMac via:

```bash
sudo /Users/admin/Sites/scripts/deploy/deploy-coreyiscorey-www.sh --yes
```

nginx serves `public/` directly. No backend, no LaunchDaemon.

## Adding a project

1. Create a new repo (e.g. `CoreyScherrer/new-thing`).
2. Add a deploy script in `coreyscherrer.com/scripts/deploy/` modeled on `deploy-visualizer.sh`. Webroot: `/var/www/coreyiscorey/new-thing/`.
3. Add an nginx `location /new-thing/` block to `coreyscherrer.com/scripts/nginx/coreyiscorey.com.conf`.
4. Add a `<li class="project-card">` in this repo's `index.html`.
