from pricing_engine import estimate


def test_sections_and_prices() -> None:
    assert estimate("Whole Milk")["section"] == "Drinks"
    assert estimate("Genoa Salami")["section"] == "Deli & Meat"
    assert estimate("Fresh Strawberries")["section"] == "Produce"
    assert estimate("Unknown Item")["price"] == 3.99


if __name__ == "__main__":
    test_sections_and_prices()
    print("Pricing checks passed")
