# Security Policy

## Reporting a vulnerability

Do not disclose a security or privacy vulnerability in a public issue. Use GitHub's private vulnerability reporting feature for this repository, or contact the repository owner privately through GitHub.

Include the affected behavior, reproduction steps, likely impact, and any suggested mitigation. Please allow reasonable time for review before public disclosure.

## Supported version

The latest version on the default branch is supported.

## Security model

Neuro Fridge is intentionally a public shared prototype. It does not promise private, user-isolated inventories. Server-side boundaries restrict writes to one shared fridge, validate and cap all accepted values, reject cross-site mutations, and rate-limit write operations using short-lived hashed network identifiers.

Automated checks cover committed-secret patterns, vulnerable production dependencies, required API guards, and static analysis. Do not add credentials to repository files; use the hosting platform's secret storage for future integrations.
