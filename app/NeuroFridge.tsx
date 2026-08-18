"use client";

import {
  ArrowUpRight,
  Barcode,
  Camera,
  Check,
  ChevronRight,
  CircleGauge,
  Copy,
  Leaf,
  Minus,
  PackagePlus,
  Plus,
  Search,
  Share2,
  Snowflake,
  Sparkles,
  Thermometer,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Item = {
  id: number;
  barcode: string;
  name: string;
  brand: string;
  imageUrl: string;
  category: string;
  quantity: number;
  updatedAt: string;
};

const seedItems: Item[] = [
  { id: 1, barcode: "082657700025", name: "100% Natural Spring Water", brand: "Deer Park", imageUrl: "", category: "Drinks", quantity: 8, updatedAt: new Date().toISOString() },
  { id: 2, barcode: "039400016120", name: "Original Baked Beans", brand: "Bush’s Best", imageUrl: "", category: "Pantry", quantity: 3, updatedAt: new Date().toISOString() },
  { id: 3, barcode: "070847811169", name: "Club Soda", brand: "Canada Dry", imageUrl: "", category: "Drinks", quantity: 5, updatedAt: new Date().toISOString() },
  { id: 4, barcode: "041303009064", name: "Large Brown Eggs", brand: "Nature’s Promise", imageUrl: "", category: "Dairy", quantity: 12, updatedAt: new Date().toISOString() },
];

const FRIDGE_ID = "neuro-home";

export default function NeuroFridge() {
  const [items, setItems] = useState<Item[]>(seedItems);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All items");
  const [toast, setToast] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [pendingBarcode, setPendingBarcode] = useState("");
  const [customName, setCustomName] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [doorOpen, setDoorOpen] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [fridgeTemp, setFridgeTemp] = useState(37);
  const [freezerTemp, setFreezerTemp] = useState(0);
  const [clock, setClock] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    fetch(`/api/inventory?fridge=${FRIDGE_ID}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => data.items?.length && setItems(data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()));
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!motionEnabled) {
      document.documentElement.style.setProperty("--fridge-rx", "0deg");
      document.documentElement.style.setProperty("--fridge-ry", "0deg");
      return;
    }
    const move = (event: PointerEvent) => {
      document.documentElement.style.setProperty("--mx", `${event.clientX}px`);
      document.documentElement.style.setProperty("--my", `${event.clientY}px`);
      document.documentElement.style.setProperty("--rx", `${(event.clientY / innerHeight - .5) * -3}deg`);
      document.documentElement.style.setProperty("--ry", `${(event.clientX / innerWidth - .5) * 4}deg`);
      document.documentElement.style.setProperty("--fridge-rx", `${(event.clientY / innerHeight - .5) * -1.8}deg`);
      document.documentElement.style.setProperty("--fridge-ry", `${(event.clientX / innerWidth - .5) * 2.4}deg`);
    };
    const tilt = (event: DeviceOrientationEvent) => {
      if (event.gamma != null) {
        document.documentElement.style.setProperty("--ry", `${Math.max(-4, Math.min(4, event.gamma / 10))}deg`);
        document.documentElement.style.setProperty("--fridge-ry", `${Math.max(-2.5, Math.min(2.5, event.gamma / 14))}deg`);
      }
      if (event.beta != null) {
        document.documentElement.style.setProperty("--rx", `${Math.max(-3, Math.min(3, (event.beta - 45) / 15))}deg`);
        document.documentElement.style.setProperty("--fridge-rx", `${Math.max(-2, Math.min(2, (event.beta - 45) / 20))}deg`);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("deviceorientation", tilt);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("deviceorientation", tilt); };
  }, [motionEnabled]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const closeScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
    setScannerOpen(false);
    setLoadingText("");
    setPendingBarcode("");
    setCustomName("");
    setCustomBrand("");
  }, []);

  const addProduct = useCallback(async (product: Item) => {
    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fridgeId: FRIDGE_ID, ...product, quantity: 1 }),
    });
    if (!response.ok) throw new Error("save-failed");
    const saved = (await response.json()).item as Item;
    setItems((current) => {
      const found = current.some((item) => item.barcode === product.barcode);
      return found ? current.map((item) => item.barcode === product.barcode ? saved : item) : [saved, ...current];
    });
    closeScanner();
    notify(`${saved.brand} ${saved.name} · +1 added`);
  }, [closeScanner]);

  const scanBarcode = useCallback(async (barcode: string) => {
    const clean = barcode.trim();
    if (!clean || loadingText) return;
    setLoadingText("Identifying product…");
    controlsRef.current?.stop();
    try {
      const existing = items.find((item) => item.barcode === clean);
      if (existing) {
        await addProduct(existing);
        return;
      }
      const lookup = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json?fields=code,product_name,brands,image_front_small_url,categories_tags_en`);
      const data = await lookup.json();
      if (data.status !== 1 || !data.product?.product_name) throw new Error("not-found");
      await addProduct({
        id: 0,
        barcode: clean,
        name: data.product.product_name,
        brand: data.product.brands?.split(",")[0] || "Unknown brand",
        imageUrl: data.product.image_front_small_url || "",
        category: data.product.categories_tags_en?.[0] || "Groceries",
        quantity: 0,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      setLoadingText("");
      controlsRef.current?.stop();
      controlsRef.current = null;
      setScanning(false);
      if (error instanceof Error && error.message === "save-failed") {
        notify("Couldn’t save that item. Please try again.");
        return;
      }
      setPendingBarcode(clean);
      setManualCode(clean);
    }
  }, [addProduct, items, loadingText]);

  const addCustomBarcode = async () => {
    if (!customName.trim()) return;
    setLoadingText("Adding your item…");
    try {
      await addProduct({
        id: 0,
        barcode: pendingBarcode,
        name: customName.trim(),
        brand: customBrand.trim() || "Custom item",
        imageUrl: "",
        category: "Groceries",
        quantity: 0,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      setLoadingText("");
      notify("Couldn’t save that item. Please try again.");
    }
  };

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setScanning(true);
    setLoadingText("Starting camera…");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false },
        videoRef.current,
        (result) => { if (result) scanBarcode(result.getText()); },
      );
      controlsRef.current = controls;
      setLoadingText("");
    } catch {
      setScanning(false);
      setLoadingText("");
      notify("Camera access was blocked. Enter the barcode below.");
    }
  }, [scanBarcode]);

  useEffect(() => () => controlsRef.current?.stop(), []);

  const changeQuantity = async (item: Item, delta: number) => {
    const next = Math.max(0, item.quantity + delta);
    setItems((current) => next === 0 ? current.filter((x) => x.id !== item.id) : current.map((x) => x.id === item.id ? { ...x, quantity: next } : x));
    try {
      await fetch(`/api/inventory?id=${item.id}`, {
        method: next === 0 ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: next }),
      });
    } catch {}
  };

  const categories = ["All items", "Drinks", "Dairy", "Pantry"];
  const filtered = useMemo(() => items.filter((item) => {
    const matches = `${item.name} ${item.brand} ${item.barcode}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter === "All items" || item.category.toLowerCase().includes(filter.toLowerCase()));
  }), [filter, items, query]);
  const total = items.reduce((sum, item) => sum + item.quantity, 0);

  const adjustTemperature = (zone: "fridge" | "freezer", delta: number) => {
    if (zone === "fridge") {
      const next = Math.max(33, Math.min(42, fridgeTemp + delta));
      setFridgeTemp(next);
      notify(`Fridge temperature set to ${next}°F`);
    } else {
      const next = Math.max(-6, Math.min(5, freezerTemp + delta));
      setFreezerTemp(next);
      notify(`Freezer temperature set to ${next}°F`);
    }
  };

  return (
    <main className={`app-shell ${doorOpen ? "door-open" : ""} ${motionEnabled ? "motion-on" : "motion-off"}`}>
      <section className="fridge-interior" aria-hidden={!doorOpen}>
        <div className="interior-head"><div><Snowflake size={20} /><span>NEURO FRESH ZONE</span></div><button onClick={() => setDoorOpen(false)}>Close door</button></div>
        <div className="cold-air"><i /><i /><i /><span>37°F</span></div>
        <div className="glass-shelf shelf-top">{items.slice(0, 3).map((item) => <button key={item.barcode} onClick={() => { setDoorOpen(false); notify(`${item.name} · ${item.quantity} in stock`); }}><b>{item.brand.slice(0, 2).toUpperCase()}</b><span>{item.name}</span><em>×{item.quantity}</em></button>)}</div>
        <div className="glass-shelf shelf-bottom">{items.slice(3, 6).map((item) => <button key={item.barcode} onClick={() => { setDoorOpen(false); notify(`${item.name} · ${item.quantity} in stock`); }}><b>{item.brand.slice(0, 2).toUpperCase()}</b><span>{item.name}</span><em>×{item.quantity}</em></button>)}</div>
        <div className="crisper-drawer"><span>FRESH DRAWER</span><strong>Humidity / 72%</strong></div>
      </section>
      <div className="fridge-door-face">
      <div className="ambient ambient-a" /><div className="ambient ambient-b" /><div className="cursor-glow" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Neuro Fridge home"><span className="brand-mark"><span /></span><b>NEURO</b><span>/ FRIDGE</span></a>
        <button className="top-status" onClick={() => { setMotionEnabled((value) => !value); notify(`Motion ${motionEnabled ? "paused" : "enabled"}`); }} title="Toggle motion effects"><span className="live-dot" /> MOTION {motionEnabled ? "ON" : "OFF"} <span className="divider" /> {clock}</button>
        <button className="share-btn" onClick={() => setShareOpen(true)}><Share2 size={16} /> Share fridge</button>
      </header>
      <aside className="fridge-readout" aria-label="Temperature controls">
        <Snowflake size={15} />
        <div className="temp-zone"><button aria-label="Lower fridge temperature" onClick={() => adjustTemperature("fridge", -1)}><Minus size={9} /></button><strong>{fridgeTemp}°</strong><button aria-label="Raise fridge temperature" onClick={() => adjustTemperature("fridge", 1)}><Plus size={9} /></button><small>FRIDGE</small></div>
        <span />
        <div className="temp-zone"><button aria-label="Lower freezer temperature" onClick={() => adjustTemperature("freezer", -1)}><Minus size={9} /></button><strong>{freezerTemp}°</strong><button aria-label="Raise freezer temperature" onClick={() => adjustTemperature("freezer", 1)}><Plus size={9} /></button><small>FREEZER</small></div>
      </aside>
      <button className="fridge-handle" aria-label={doorOpen ? "Close fridge door" : "Open fridge door"} onClick={() => setDoorOpen((value) => !value)}><span /><small>{doorOpen ? "CLOSE" : "PULL"}</small></button>

      <section className="hero" id="top">
        <div className="display-status"><span><Wifi size={13} /> HOME FRIDGE</span><span><Thermometer size={13} /> 37°F</span></div>
        <div className="eyebrow"><Sparkles size={14} /> YOUR KITCHEN, IN SYNC</div>
        <h1>KNOW WHAT’S<br /><em>INSIDE.</em></h1>
        <p>Point. Scan. Done. Neuro keeps a live count of every item in your fridge, wherever you are.</p>
        <div className="hero-actions">
          <button className="scan-primary" onClick={() => setScannerOpen(true)}><span><Camera size={22} /></span> Scan an item <ArrowUpRight size={18} /></button>
          <span className="scan-hint"><Barcode size={18} /> Each scan adds <b>+1</b></span>
        </div>
        <div className="hero-orbit"><div className="orbit-ring" /><button className="orbit-core" onClick={() => setScannerOpen(true)} aria-label="Open barcode scanner"><Barcode size={48} /><small>TAP TO SCAN</small></button><button className="orbit-tag tag-one" onClick={() => document.querySelector(".inventory-section")?.scrollIntoView({ behavior: "smooth" })}>LIVE INVENTORY</button><button className="orbit-tag tag-two" onClick={() => document.querySelector(".inventory-section")?.scrollIntoView({ behavior: "smooth" })}>{total} UNITS</button></div>
      </section>

      <section className="inventory-section">
        <div className="stats-row">
          <div className="stat-card featured"><div><small>TOTAL STOCK</small><strong>{String(total).padStart(2, "0")}</strong><span>units tracked</span></div><CircleGauge size={36} /></div>
          <div className="stat-card"><div><small>UNIQUE ITEMS</small><strong>{String(items.length).padStart(2, "0")}</strong><span>products</span></div><PackagePlus size={34} /></div>
          <div className="stat-card"><div><small>SYNC STATUS</small><strong className="word-stat">LIVE</strong><span>shared fridge</span></div><Zap size={32} /></div>
          <div className="stat-card health"><div><small>FRESHNESS</small><strong>94<span>%</span></strong><span>looking good</span></div><Leaf size={31} /></div>
        </div>

        <div className="inventory-head">
          <div><div className="section-kicker">01 / INVENTORY</div><h2>What’s in your fridge</h2></div>
          <div className="search-wrap"><Search size={17} /><input aria-label="Search inventory" placeholder="Search your fridge" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        </div>
        <div className="filters">{categories.map((category) => <button key={category} onClick={() => setFilter(category)} className={filter === category ? "active" : ""}>{category}</button>)}</div>
        <div className="inventory-grid">
          {filtered.map((item, index) => (
            <article className="item-card" key={item.barcode} style={{ "--delay": `${index * 55}ms` } as React.CSSProperties}>
              <div className="product-visual">
                <span className="category-label">{item.category.split(",")[0]}</span>
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="product-fallback"><span>{item.brand.slice(0, 2).toUpperCase()}</span><Barcode size={44} /></div>}
                <span className="quantity-bubble">×{item.quantity}</span>
              </div>
              <div className="item-copy"><small>{item.brand}</small><h3>{item.name}</h3><code>{item.barcode}</code></div>
              <div className="quantity-control"><button aria-label={`Remove one ${item.name}`} onClick={() => changeQuantity(item, -1)}><Minus size={16} /></button><strong>{item.quantity}</strong><button aria-label={`Add one ${item.name}`} onClick={() => changeQuantity(item, 1)}><Plus size={16} /></button></div>
            </article>
          ))}
          <button className="add-card" onClick={() => setScannerOpen(true)}><span><Plus size={24} /></span><b>Scan another item</b><small>Camera opens instantly</small></button>
        </div>
      </section>

      <footer><div className="brand"><span className="brand-mark"><span /></span><b>NEURO</b><span>/ FRIDGE</span></div><p>One shared fridge. Always up to date.</p><span>PROTOTYPE / 2026</span></footer>
      </div>

      {scannerOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Barcode scanner">
        <div className="scanner-modal">
          <div className="modal-head"><div><span>{pendingBarcode ? "NEW BARCODE" : "SCAN MODE"}</span><h2>{pendingBarcode ? "Tell us what it is." : "Show me the barcode."}</h2></div><button aria-label="Close scanner" onClick={closeScanner}><X /></button></div>
          {!pendingBarcode ? <><div className={`camera-stage ${scanning ? "is-live" : ""}`}>
            <video ref={videoRef} muted playsInline />
            <div className="scan-frame"><i /><i /><i /><i /><div className="laser" /></div>
            {!scanning && <div className="camera-empty"><div className="camera-icon"><Camera size={32} /></div><p>Your camera is only used while scanning.</p><button onClick={startCamera}><Camera size={18} /> Turn on camera</button></div>}
            {loadingText && <div className="loading-chip"><span />{loadingText}</div>}
          </div>
          <div className="manual-entry"><span>OR ENTER ANY BARCODE</span><div><Barcode size={19} /><input inputMode="text" autoComplete="off" placeholder="e.g. 082657700025" value={manualCode} onChange={(e) => setManualCode(e.target.value.slice(0, 64))} onKeyDown={(e) => e.key === "Enter" && scanBarcode(manualCode)} /><button onClick={() => scanBarcode(manualCode)} disabled={!manualCode.trim()}><ChevronRight /></button></div></div>
          <p className="scanner-note"><Check size={14} /> Known products autofill. Every other barcode can be added manually.</p></> :
          <div className="custom-product-form">
            <div className="barcode-confirmed"><span><Check size={16} /></span><div><small>BARCODE CAPTURED</small><code>{pendingBarcode}</code></div></div>
            <label><span>ITEM NAME *</span><input autoFocus value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomBarcode()} placeholder="What is this item?" /></label>
            <label><span>BRAND <em>OPTIONAL</em></span><input value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomBarcode()} placeholder="Brand or maker" /></label>
            <div className="custom-actions"><button className="back-to-scan" onClick={() => { setPendingBarcode(""); setLoadingText(""); }}>Scan again</button><button className="add-custom" onClick={addCustomBarcode} disabled={!customName.trim() || !!loadingText}><Plus size={17} />{loadingText || "Add to fridge"}</button></div>
          </div>}
        </div>
      </div>}

      {shareOpen && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="share-modal"><button className="close-mini" onClick={() => setShareOpen(false)}><X size={18} /></button><div className="share-icon"><Share2 /></div><span>PRIVATE FRIDGE LINK</span><h2>Everyone stays in sync.</h2><p>Anyone with this link can view and update this shared fridge—no account needed.</p><div className="share-link"><code>{typeof window !== "undefined" ? `${window.location.origin}/?fridge=${FRIDGE_ID}` : "neurofridge.app/fridge/neuro-home"}</code><button onClick={() => { navigator.clipboard?.writeText(window.location.href); notify("Private link copied"); setShareOpen(false); }}><Copy size={16} /> Copy</button></div></div></div>}
      {toast && <div className="toast"><span><Check size={16} /></span>{toast}</div>}
    </main>
  );
}
