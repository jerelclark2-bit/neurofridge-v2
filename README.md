# Neuro Fridge

Neuro Fridge is an interactive shared-fridge prototype. Scan any barcode, identify known products through Open Food Facts, place groceries into visual fridge sections, and keep a replacement-cost estimate in one place.

## What it does

- Scans barcodes with a phone or laptop camera
- Accepts any barcode through manual entry
- Looks up known products in the free Open Food Facts catalog
- Lets people add products that are not yet in the catalog
- Organizes food into drinks, dairy, deli, produce, condiments, and other sections
- Tracks quantities and items currently outside the fridge
- Estimates the value inside the fridge and the cost to replace missing items
- Saves fridge finish and custom image-link stickers
- Shares one cloud-backed inventory across devices

## Run locally

Requirements: Node.js 22.13 or newer, pnpm, and Python 3.

```bash
pnpm install
pnpm pricing:generate
pnpm dev
```

Open the local address shown in the terminal.

## Verify

```bash
pnpm pricing:test
pnpm build
```

## Data and privacy

Camera video is processed on the visitor's device and is not recorded. Barcode numbers are sent to Open Food Facts for product identification. The hosted prototype is a public shared fridge, so visitors should not add sensitive personal information.

Product information is provided by [Open Food Facts](https://world.openfoodfacts.org/) and may be incomplete. Prices are editable estimates, not live store quotes.

## Security

Public mutations are restricted to the single shared fridge, checked for same-origin requests, validated and size-limited on the server, and protected by durable per-source rate limits. Destructive anonymous deletion is not exposed. Browser responses include CSP, framing, transport, referrer, content-type, and device-permission protections.

The repository runs secret-history scanning, dependency auditing, CodeQL, and weekly dependency update checks. See [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Released under the [MIT License](LICENSE).
