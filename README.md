# Image CDN

A small GitHub Pages image pipeline. Commit original images to `images/`; GitHub Actions converts them to optimized WebP variants and publishes the generated files with GitHub Pages.

> **Intended use:** prototypes, documentation, small static sites, and low-volume assets. GitHub Pages is not a general-purpose image-hosting service or a guaranteed commercial CDN. Check GitHub's current Pages limits and acceptable-use policy before using it for production SaaS traffic.

## Features

- WebP output using [Sharp](https://sharp.pixelplumbing.com/).
- EXIF orientation correction.
- Responsive widths: 320, 640, 960, 1280, plus a default rendition capped at 1600px.
- Preserves source folder structure.
- Generates `manifest.json` describing every image and its variants.
- Automatic build and deploy on pushes to `main`.

## Repository layout

```text
images/                 # Commit original JPEG, PNG, WebP or TIFF files here
  hotels/
  rooms/
  amenities/
  avatars/
scripts/
  optimize-images.mjs
.github/workflows/
  deploy.yml
dist/                   # Generated output; not committed
```

## 1. Create the repository

Create a new GitHub repository named `image-cdn`. For the simplest Pages URL, the repository can be public and named `image-cdn`.

Do not initialize it with a README if you plan to push this project as the first commit.

## 2. Push this project

```bash
unzip image-cdn.zip
cd image-cdn

npm install
npm run build

git init
git add .
git commit -m "Initial image CDN pipeline"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/image-cdn.git
git push -u origin main
```

The workflow installs the pinned major-compatible dependency range with `npm install`. For stricter reproducibility, run `npm install` locally and commit the generated `package-lock.json`; you can then switch the workflow to `npm ci`.

## 3. Enable GitHub Pages

In the repository:

1. Open **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions** and watch **Optimize images and deploy GitHub Pages**.
4. Wait for both `build` and `deploy` jobs to finish successfully.

The first deployment runs after the push to `main`. You can also run it manually from **Actions → Optimize images and deploy GitHub Pages → Run workflow**.

## 4. Add images

Copy originals into the appropriate folder, for example:

```text
images/hotels/hotel-01.jpg
images/rooms/deluxe-room.png
```

Then commit and push:

```bash
git add images/
git commit -m "Add hotel images"
git push
```

The workflow publishes optimized files while keeping the folder hierarchy:

```text
dist/
  hotels/
    hotel-01.webp
    hotel-01-320.webp
    hotel-01-640.webp
    hotel-01-960.webp
    hotel-01-1280.webp
  rooms/
    deluxe-room.webp
    deluxe-room-320.webp
    ...
  manifest.json
```

A variant is only created when its requested width is smaller than the default rendition. Images smaller than a requested width are never enlarged.

## 5. Public URLs

For a project repository, the default URL is:

```text
https://YOUR_GITHUB_USERNAME.github.io/image-cdn/hotels/hotel-01.webp
```

Example HTML:

```html
<img
  src="https://YOUR_GITHUB_USERNAME.github.io/image-cdn/hotels/hotel-01.webp"
  srcset="
    https://YOUR_GITHUB_USERNAME.github.io/image-cdn/hotels/hotel-01-320.webp 320w,
    https://YOUR_GITHUB_USERNAME.github.io/image-cdn/hotels/hotel-01-640.webp 640w,
    https://YOUR_GITHUB_USERNAME.github.io/image-cdn/hotels/hotel-01-960.webp 960w,
    https://YOUR_GITHUB_USERNAME.github.io/image-cdn/hotels/hotel-01-1280.webp 1280w
  "
  sizes="(max-width: 640px) 100vw, 640px"
  alt="Hotel"
  loading="lazy"
  decoding="async"
/>
```

Use only variants that exist in `manifest.json`. For an image whose source is narrower than a listed width, that larger variant is intentionally omitted.

## Configuration

The workflow currently sets:

- `IMAGE_WIDTHS=320,640,960,1280`
- `IMAGE_MAX_WIDTH=1600`
- `WEBP_QUALITY=82`

You can change these in `.github/workflows/deploy.yml`.

Supported input formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.tif`, `.tiff`. Output is always WebP. Animated images are not a target of this pipeline; use a dedicated video/GIF workflow for animation.

## Local development

```bash
npm install
npm run build
```

To remove previous output before rebuilding:

```bash
npm run build:clean
```

The output is written to `dist/`. Do not commit `dist/`; GitHub Actions builds and deploys it.

## Custom domain

If you later configure a custom domain in **Settings → Pages**, add a `CNAME` file containing only the hostname to the published `dist/` output before deployment. For a custom workflow, the simplest approach is to add a `CNAME` file at the project root and copy it into `dist/` in the build script/workflow. Configure the matching DNS records at your DNS provider and enable HTTPS in Pages once DNS is verified.

## Operational notes

- Keep source images reasonably sized before committing; Git repositories are not object storage.
- GitHub Pages has repository/site size and bandwidth guidance/limits. It does not provide on-demand resizing, automatic AVIF negotiation, or image transformation URLs.
- Deleting an image from `images/` removes its generated files on the next clean build.
- Public repository files are publicly accessible. Never commit private, customer, or confidential images.
