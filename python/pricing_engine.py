#!/usr/bin/env python3
"""Free, deterministic fridge section and replacement-cost estimator."""

from __future__ import annotations

import json
from pathlib import Path

RULES = [
    {"section": "Drinks", "keywords": ["water", "soda", "juice", "milk", "tea", "coffee", "drink", "beverage"], "price": 4.49},
    {"section": "Dairy & Eggs", "keywords": ["cheese", "yogurt", "egg", "butter", "cream", "dairy"], "price": 4.99},
    {"section": "Deli & Meat", "keywords": ["salami", "ham", "turkey", "chicken", "beef", "pork", "sausage", "meat", "deli"], "price": 7.49},
    {"section": "Produce", "keywords": ["apple", "banana", "lettuce", "tomato", "fruit", "vegetable", "produce", "berry", "berries", "strawberry", "strawberries"], "price": 3.29},
    {"section": "Condiments", "keywords": ["sauce", "ketchup", "mustard", "mayo", "dressing", "jam"], "price": 3.99},
    {"section": "Other", "keywords": [], "price": 3.99},
]


def estimate(name: str, category: str = "") -> dict[str, object]:
    haystack = f"{name} {category}".lower()
    for rule in RULES:
        if any(word in haystack for word in rule["keywords"]):
            return {"section": rule["section"], "price": rule["price"]}
    return {"section": "Other", "price": 3.99}


def main() -> None:
    output = Path(__file__).parents[1] / "public" / "pricing-rules.json"
    output.write_text(json.dumps({"currency": "USD", "rules": RULES}, indent=2) + "\n")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
