#!/usr/bin/env python3
"""Fail CI when tracked files, history, or API guards show common security regressions."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).parents[1]
SKIP_CONTENT = {"pnpm-lock.yaml", "python/security_scan.py"}
SECRET_PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "AWS access key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "GitHub token": re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}"),
    "Stripe live key": re.compile(r"sk_live_[A-Za-z0-9]{20,}"),
    "OpenAI-style key": re.compile(r"sk-(?:proj-)?[A-Za-z0-9_-]{20,}"),
    "long JWT": re.compile(r"eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}"),
}


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout


def tracked_files() -> list[str]:
    return [path for path in git("ls-files").splitlines() if path]


def scan_tracked_paths(paths: list[str]) -> list[str]:
    findings: list[str] = []
    for path in paths:
        name = Path(path).name
        if name == ".env" or name.startswith(".env.") and name != ".env.example":
            findings.append(f"tracked environment file: {path}")
        if Path(path).suffix.lower() in {".pem", ".key", ".p12", ".pfx"}:
            findings.append(f"tracked credential file: {path}")
    return findings


def scan_current_files(paths: list[str]) -> list[str]:
    findings: list[str] = []
    for path in paths:
        if path in SKIP_CONTENT:
            continue
        target = ROOT / path
        try:
            if target.stat().st_size > 1_000_000:
                continue
            content = target.read_text(errors="ignore")
        except (OSError, UnicodeError):
            continue
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(content):
                findings.append(f"{label} pattern in {path}")
    return findings


def scan_history() -> list[str]:
    history = git(
        "log",
        "-p",
        "--all",
        "--",
        ".",
        ":(exclude)pnpm-lock.yaml",
        ":(exclude)python/security_scan.py",
    )
    return [
        f"{label} pattern in Git history"
        for label, pattern in SECRET_PATTERNS.items()
        if pattern.search(history)
    ]


def scan_security_guards() -> list[str]:
    findings: list[str] = []
    inventory = (ROOT / "app/api/inventory/route.ts").read_text()
    settings = (ROOT / "app/api/settings/route.ts").read_text()
    worker = (ROOT / "worker/index.ts").read_text()

    for route_name, source in {"inventory": inventory, "settings": settings}.items():
        for guard in ("assertSameOrigin", "enforceRateLimit", "errorResponse"):
            if guard not in source:
                findings.append(f"{route_name} route is missing {guard}")
        if "PUBLIC_FRIDGE_ID" not in source:
            findings.append(f"{route_name} route does not enforce the public fridge boundary")
    if "export async function DELETE" in inventory:
        findings.append("inventory route exposes destructive anonymous deletion")
    for header in (
        "Content-Security-Policy",
        "Permissions-Policy",
        "Referrer-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
    ):
        if header not in worker:
            findings.append(f"worker is missing {header}")
    return findings


def main() -> None:
    paths = tracked_files()
    findings = [
        *scan_tracked_paths(paths),
        *scan_current_files(paths),
        *scan_history(),
        *scan_security_guards(),
    ]
    if findings:
        print("Security scan failed:")
        for finding in sorted(set(findings)):
            print(f"- {finding}")
        raise SystemExit(1)
    print(f"Security scan passed: {len(paths)} tracked files checked; required API guards present")


if __name__ == "__main__":
    main()
