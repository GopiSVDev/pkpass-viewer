# PKPASS Viewer

A small web app to open and preview Apple Wallet (.pkpass) files directly in the browser.

It reads the pass locally, displays its fields in an Apple Wallet–style layout, and allows exporting the preview as an image.

## What it does

- Open `.pkpass` files
- Parse and display `pass.json`
- Preview boarding passes, event tickets, coupons, and generic passes
- Render barcodes / QR codes
- Download the rendered pass as an image

All processing happens client-side. Files are never uploaded.

## Tech

- React
- TypeScript
- Vite
- Tailwind CSS
- JSZip

## Development

```bash
npm install
npm run dev
```

## Build for production:

```bash
npm run build
```

## Notes

This project is for preview and inspection only.
It does not verify Apple Wallet pass signatures.
