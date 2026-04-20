# Check Button Effect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hint message and weighted-random explosion effects to the check button on the display page.

**Architecture:** Extract effect logic into a standalone `src/lib/check-effects.ts` utility (pure DOM/Canvas, no React dependency) so the display page stays focused. The `CheckButton` component in `src/app/display/page.tsx` gains a hint label, cooldown lock state, and calls the effect utility on click.

**Tech Stack:** Web Animations API, Canvas 2D, React (existing), framer-motion (existing for button spring only)

---

### Task 1: Create the check effects utility

**Files:**
- Create: `src/lib/check-effects.ts`

This file contains all effect logic: random scale picker, cooldown calculator, tiny effect, big effect (flash, shake, bounce rings, confetti, sparkles, confetti rain). No React — pure DOM manipulation.

- [ ] **Step 1: Create `src/lib/check-effects.ts` with constants, types, and randomScale**

```ts
// src/lib/check-effects.ts

const COLORS = [
  "#22d3ee", "#a78bfa", "#60a5fa", "#f472b6", "#34d399",
  "#fbbf24", "#fb923c", "#f43f5e", "#818cf8", "#2dd4bf",
];

export interface EffectResult {
  scale: number;
  cooldownMs: number;
}

/**
 * Weighted random scale.
 * 85% tiny (0.04–0.12), 15% split evenly among medium/large/xl/nuke.
 */
export function randomScale(): number {
  const r = Math.random();
  if (r < 0.85) return 0.04 + Math.random() * 0.08;
  if (r < 0.8875) return 0.35 + Math.random() * 0.25;
  if (r < 0.925) return 0.65 + Math.random() * 0.35;
  if (r < 0.9625) return 1.05 + Math.random() * 0.35;
  return 1.40 + Math.random() * 0.30;
}

export function getCooldownMs(scale: number): number {
  if (scale < 0.12) return 0;
  if (scale < 0.60) return 1200;
  if (scale < 1.00) return 2000;
  if (scale < 1.40) return 3000;
  return 4000;
}
```

- [ ] **Step 2: Add DOM helper functions (mkLayer, flash, shake)**

Append to `src/lib/check-effects.ts`:

```ts
function mkLayer(): HTMLDivElement {
  const l = document.createElement("div");
  Object.assign(l.style, {
    position: "fixed", top: "0", left: "0",
    width: "100vw", height: "100vh",
    pointerEvents: "none", zIndex: "9999", overflow: "hidden",
  });
  document.body.appendChild(l);
  return l;
}

function flash(color: string, dur: number, opacity: number) {
  const f = document.createElement("div");
  Object.assign(f.style, {
    position: "fixed", top: "0", left: "0",
    width: "100vw", height: "100vh",
    pointerEvents: "none", zIndex: "9998",
  });
  document.body.appendChild(f);
  f.animate(
    [{ background: color, opacity }, { background: color, opacity: 0 }],
    { duration: dur, easing: "ease-out", fill: "forwards" },
  );
  setTimeout(() => f.remove(), dur + 50);
}

function shake(intensity: number, dur: number) {
  document.body.animate(
    [
      { transform: "translate(0,0)" },
      { transform: `translate(${intensity}px,-${intensity}px)` },
      { transform: `translate(-${intensity}px,${intensity}px)` },
      { transform: `translate(${intensity * 0.7}px,${intensity * 0.5}px)` },
      { transform: `translate(-${intensity * 0.5}px,-${intensity * 0.7}px)` },
      { transform: "translate(0,0)" },
    ],
    { duration: dur, easing: "ease-out" },
  );
}
```

- [ ] **Step 3: Add fireTiny function**

Append to `src/lib/check-effects.ts`:

```ts
function fireTiny(ox: number, oy: number, scale: number) {
  const layer = mkLayer();
  const radius = 15 + scale * 180;
  const count = 4 + Math.round(scale * 25);

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist = radius * (0.5 + Math.random() * 0.5);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    const size = 2 + Math.random() * 3;
    const color = COLORS[~~(Math.random() * COLORS.length)];
    Object.assign(p.style, {
      position: "absolute", left: `${ox}px`, top: `${oy}px`,
      width: `${size}px`, height: `${size}px`, borderRadius: "50%",
      background: color, boxShadow: `0 0 ${size + 2}px ${color}`,
    });
    p.animate(
      [
        { transform: "translate(-50%,-50%) scale(1)", opacity: "0.9" },
        { transform: `translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0)`, opacity: "0" },
      ],
      { duration: 180 + Math.random() * 150, easing: "ease-out", fill: "forwards" as FillMode, delay: Math.random() * 30 },
    );
    layer.appendChild(p);
  }

  const glow = document.createElement("div");
  Object.assign(glow.style, {
    position: "absolute", left: `${ox}px`, top: `${oy}px`,
    width: "24px", height: "24px", borderRadius: "50%",
    background: "radial-gradient(circle, rgba(34,211,238,0.5), transparent)",
    filter: "blur(4px)",
  });
  glow.animate(
    [
      { transform: "translate(-50%,-50%) scale(0.5)", opacity: "0.7" },
      { transform: "translate(-50%,-50%) scale(1.8)", opacity: "0" },
    ],
    { duration: 250, easing: "ease-out", fill: "forwards" as FillMode },
  );
  layer.appendChild(glow);
  setTimeout(() => layer.remove(), 500);
}
```

- [ ] **Step 4: Add spawnBounceRings function**

Append to `src/lib/check-effects.ts`:

```ts
function spawnBounceRings(ox: number, oy: number, scale: number) {
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    position: "fixed", top: "0", left: "0",
    width: "100vw", height: "100vh",
    pointerEvents: "none", zIndex: "9997",
  });
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const M = Math.max(innerWidth, innerHeight);

  const ringConfigs = [
    { color: "rgba(34,211,238,", lineWidth: 2 + scale * 2 },
    { color: "rgba(167,139,250,", lineWidth: 1.5 + scale * 1.5 },
    { color: "rgba(96,165,250,", lineWidth: 1 + scale * 1 },
  ];

  const rings = ringConfigs.map((cfg, i) => ({
    r: 0,
    speed: (8 + scale * 8) * (1 - i * 0.2),
    color: cfg.color,
    lineWidth: cfg.lineWidth,
    opacity: 0.7 + scale * 0.2,
    bounced: false,
    bounceR: 0,
    bounceOpacity: 0,
    delay: i * (3 + Math.round(scale * 3)),
  }));

  const minWall = Math.min(oy, innerHeight - oy, ox, innerWidth - ox);
  let frame = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let allDone = true;

    rings.forEach((ring) => {
      if (ring.delay > frame) { allDone = false; return; }

      if (ring.opacity > 0) {
        ring.r += ring.speed;
        if (!ring.bounced && ring.r >= minWall && scale > 0.4) {
          ring.bounced = true;
          ring.bounceR = ring.r;
          ring.bounceOpacity = ring.opacity * 0.5;
          if (scale > 0.7) shake(scale * 2, 200);
        }
        ring.opacity = Math.max(0, ring.opacity - (0.006 + (1 - scale) * 0.005));
        ctx.beginPath();
        ctx.arc(ox, oy, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color + ring.opacity + ")";
        ctx.lineWidth = ring.lineWidth;
        ctx.shadowColor = ring.color + ring.opacity * 0.5 + ")";
        ctx.shadowBlur = 20 * scale;
        ctx.stroke();
        ctx.shadowBlur = 0;
        allDone = false;
      }

      if (ring.bounced && ring.bounceOpacity > 0) {
        ring.bounceR -= ring.speed * 0.5;
        ring.bounceOpacity = Math.max(0, ring.bounceOpacity - 0.01);
        if (ring.bounceR > 10) {
          ctx.beginPath();
          ctx.arc(ox, oy, ring.bounceR, 0, Math.PI * 2);
          ctx.strokeStyle = ring.color + ring.bounceOpacity + ")";
          ctx.lineWidth = ring.lineWidth * 0.6;
          ctx.shadowColor = ring.color + ring.bounceOpacity * 0.3 + ")";
          ctx.shadowBlur = 15;
          ctx.stroke();
          ctx.shadowBlur = 0;
          allDone = false;
        }
        if (ring.bounceOpacity > 0.08 && scale > 0.5) {
          const eg = ring.bounceOpacity * 0.25;
          const edges: [number, number, number, number, string][] = [
            [0, 0, canvas.width, 50, "top"],
            [0, canvas.height - 50, canvas.width, 50, "bottom"],
            [0, 0, 50, canvas.height, "left"],
            [canvas.width - 50, 0, 50, canvas.height, "right"],
          ];
          edges.forEach(([x, y, w, h, side]) => {
            const grd =
              side === "top" || side === "bottom"
                ? ctx.createLinearGradient(0, side === "top" ? 0 : canvas.height, 0, side === "top" ? 50 : canvas.height - 50)
                : ctx.createLinearGradient(side === "left" ? 0 : canvas.width, 0, side === "left" ? 50 : canvas.width - 50, 0);
            grd.addColorStop(0, ring.color + eg + ")");
            grd.addColorStop(1, "transparent");
            ctx.fillStyle = grd;
            ctx.fillRect(x, y, w, h);
          });
          allDone = false;
        }
      }
    });

    frame++;
    if (allDone) canvas.remove();
    else requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}
```

- [ ] **Step 5: Add fireBig function and the main exported fireCheckEffect**

Append to `src/lib/check-effects.ts`:

```ts
function fireBig(ox: number, oy: number, scale: number) {
  const M = Math.max(innerWidth, innerHeight);

  // Flash
  if (scale > 0.3)
    flash("rgba(255,255,255,0.5)", 150 + scale * 100, Math.min(0.2 + scale * 0.3, 0.7));
  if (scale > 0.5)
    setTimeout(() => flash("rgba(34,211,238,0.2)", 300 + scale * 100, 0.3), 80);

  // Shake
  shake(Math.max(1, scale * 8), 200 + scale * 200);

  // Bounce rings
  spawnBounceRings(ox, oy, scale);

  const layer = mkLayer();

  // Center glow
  const glow = document.createElement("div");
  const gs = 40 + scale * 150;
  Object.assign(glow.style, {
    position: "absolute", left: `${ox}px`, top: `${oy}px`,
    width: `${gs}px`, height: `${gs}px`, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(34,211,238,0.8), rgba(167,139,250,0.4), transparent)",
    filter: `blur(${6 + scale * 15}px)`,
  });
  glow.animate(
    [
      { transform: "translate(-50%,-50%) scale(0)", opacity: "1" },
      { transform: `translate(-50%,-50%) scale(${1.5 + scale * 2})`, opacity: "0" },
    ],
    { duration: 400 + scale * 300, easing: "ease-out", fill: "forwards" as FillMode },
  );
  layer.appendChild(glow);

  // Confetti burst
  const cc = Math.round(6 + scale * 50);
  for (let i = 0; i < cc; i++) {
    const c = document.createElement("div");
    const angle = (Math.PI * 2 * i) / cc + (Math.random() - 0.5) * 0.4;
    const dist = M * scale * (0.2 + Math.random() * 0.7);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist * 0.5 + dist * 0.12;
    const rot = Math.random() * 1440 - 720;
    const color = COLORS[~~(Math.random() * COLORS.length)];
    const w = 3 + Math.random() * 6 + scale * 4;
    const h = 2 + Math.random() * 3 + scale * 2;
    Object.assign(c.style, {
      position: "absolute", left: `${ox}px`, top: `${oy}px`,
      width: `${w}px`, height: `${h}px`, borderRadius: "1px",
      background: color, boxShadow: `0 0 ${w + 2}px ${color}50`,
    });
    c.animate(
      [
        { transform: "translate(-50%,-50%) rotate(0deg) scale(1.2)", opacity: "1" },
        { transform: `translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) rotate(${rot}deg) scale(0)`, opacity: "0" },
      ],
      { duration: 500 + scale * 700 + Math.random() * 400, easing: "cubic-bezier(0.22,0.61,0.36,1)", fill: "forwards" as FillMode, delay: Math.random() * 80 },
    );
    layer.appendChild(c);
  }

  // Sparkles (scale > 0.5)
  if (scale > 0.5) {
    setTimeout(() => {
      const sc = Math.round(5 + scale * 20);
      for (let i = 0; i < sc; i++) {
        const s = document.createElement("div");
        const angle = Math.random() * Math.PI * 2;
        const dist = M * scale * (0.05 + Math.random() * 0.4);
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist * 0.6;
        const color = COLORS[~~(Math.random() * COLORS.length)];
        Object.assign(s.style, {
          position: "absolute", left: `${ox}px`, top: `${oy}px`,
          fontSize: `${6 + Math.random() * 8 + scale * 6}px`,
          color, textShadow: `0 0 ${8 + scale * 8}px ${color}`,
        });
        s.textContent = Math.random() > 0.5 ? "✦" : "✧";
        s.animate(
          [
            { transform: "translate(-50%,-50%) scale(0)", opacity: "0" },
            { transform: `translate(calc(-50% + ${tx * 0.5}px),calc(-50% + ${ty * 0.5}px)) scale(1.5)`, opacity: "1", offset: 0.35 },
            { transform: `translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0)`, opacity: "0" },
          ],
          { duration: 500 + Math.random() * 500, fill: "forwards" as FillMode, delay: 150 + Math.random() * 250 },
        );
        layer.appendChild(s);
      }
    }, 100);
  }

  // Confetti rain (scale > 0.9)
  if (scale > 0.9) {
    setTimeout(() => {
      const layer2 = mkLayer();
      const rc = Math.round(scale * 30);
      for (let i = 0; i < rc; i++) {
        const c = document.createElement("div");
        const sx = Math.random() * innerWidth;
        const color = COLORS[~~(Math.random() * COLORS.length)];
        const w = 4 + Math.random() * 7;
        const h = 3 + Math.random() * 4;
        const swayX = (Math.random() - 0.5) * 200;
        const rot = Math.random() * 1080;
        Object.assign(c.style, {
          position: "absolute", left: `${sx}px`, top: "-20px",
          width: `${w}px`, height: `${h}px`, borderRadius: "1px",
          background: color, boxShadow: `0 0 6px ${color}40`,
        });
        c.animate(
          [
            { transform: "translateX(0) translateY(0) rotate(0deg)", opacity: "0.8" },
            { transform: `translateX(${swayX}px) translateY(${innerHeight + 60}px) rotate(${rot}deg)`, opacity: "0" },
          ],
          { duration: 1800 + Math.random() * 2000, easing: "ease-in", fill: "forwards" as FillMode, delay: i * 35 },
        );
        layer2.appendChild(c);
      }
      setTimeout(() => layer2.remove(), 5000);
    }, 300);
  }

  setTimeout(() => layer.remove(), 2500 + scale * 1000);
}

/**
 * Main entry point. Call from CheckButton's onClick handler.
 * Pass the button element's center coordinates (getBoundingClientRect).
 * Returns { scale, cooldownMs } so the caller can lock the button.
 */
export function fireCheckEffect(ox: number, oy: number): EffectResult {
  const scale = randomScale();
  const cooldownMs = getCooldownMs(scale);

  if (scale < 0.12) {
    fireTiny(ox, oy, scale);
  } else {
    fireBig(ox, oy, scale);
  }

  return { scale, cooldownMs };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/check-effects.ts
git commit -m "feat: add check effect utility with weighted random explosions"
```

---

### Task 2: Update CheckButton component

**Files:**
- Modify: `src/app/display/page.tsx:620-671`

Replace the existing `CheckButton` component with the new version that includes the hint message, cooldown lock, and effect trigger.

- [ ] **Step 1: Replace the CheckButton component**

In `src/app/display/page.tsx`, replace lines 620–671 (the entire `/* ─── Check Button ─── */` section) with:

```tsx
/* ─── Check Button ─── */

function CheckButton({
  notice,
  onInteraction,
}: {
  notice: Notice;
  onInteraction: () => void;
}) {
  const [localAdded, setLocalAdded] = useState(0);
  const [locked, setLocked] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dbCount = (notice as Notice & { checkCount?: number }).checkCount ?? 0;
  const prevDbCount = useRef(dbCount);

  if (dbCount !== prevDbCount.current) {
    prevDbCount.current = dbCount;
    setLocalAdded(0);
  }

  const count = dbCount + localAdded;

  function handleCheck() {
    if (locked) return;
    onInteraction();
    setLocalAdded((a) => a + 1);
    db.transact(
      db.tx.notices[notice.id].update({ checkCount: dbCount + localAdded + 1 }),
    );

    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const { fireCheckEffect } = require("@/lib/check-effects");
      const result = fireCheckEffect(r.left + r.width / 2, r.top + r.height / 2);
      if (result.cooldownMs > 0) {
        setLocked(true);
        setTimeout(() => setLocked(false), result.cooldownMs);
      }
    }
  }

  return (
    <div className="flex items-center" style={{ gap: "0.6vw" }}>
      <button
        ref={btnRef}
        onClick={handleCheck}
        className="flex items-center rounded-full border border-slate-700/60 bg-[#1e293b] transition-all hover:border-cyan-400/30 hover:bg-[#243044] active:scale-95"
        style={{
          padding: "0.4vh 1vw",
          gap: "0.5vw",
          opacity: locked ? 0.5 : 1,
          pointerEvents: locked ? "none" : "auto",
        }}
      >
        <span style={{ fontSize: "1vw" }}>✓</span>
        <span className="font-semibold text-slate-300" style={{ fontSize: "0.85vw" }}>
          {count}
        </span>
      </button>
      <span style={{ fontSize: "0.75vw", color: "#94a3b8" }}>
        <span style={{ color: "#a78bfa" }}>👀</span>
        {" "}읽어보셨다면… 체크 한번 해보실래요?
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Add the import for fireCheckEffect at the top of the file**

After the existing imports (line 13), add:

```tsx
import { fireCheckEffect } from "@/lib/check-effects";
```

And update `handleCheck` to use the direct import instead of `require`:

In the `handleCheck` function, replace:
```tsx
      const { fireCheckEffect } = require("@/lib/check-effects");
      const result = fireCheckEffect(r.left + r.width / 2, r.top + r.height / 2);
```
with:
```tsx
      const result = fireCheckEffect(r.left + r.width / 2, r.top + r.height / 2);
```

- [ ] **Step 3: Remove unused imports**

The `motion` import from `framer-motion` was used in `CheckButton` for the animated ✓ span and is still used in `DetailPanel` and `NoticeItem`, so keep it. The `AnimatePresence` import is also still used. No imports need to be removed.

However, the `animKey` state and the `motion.span` with `key={animKey}` in the old CheckButton are gone — verify no other component references them (they don't).

- [ ] **Step 4: Run the dev server and verify**

```bash
npm run dev
```

Open the display page. Click the check button:
- Hint text "👀 읽어보셨다면… 체크 한번 해보실래요?" should appear next to the button.
- Most clicks should produce tiny sparkles around the button (85%).
- Occasionally (~15%), a bigger effect fires and the button locks during the animation.
- Count increments on each (non-locked) click.

- [ ] **Step 5: Commit**

```bash
git add src/app/display/page.tsx
git commit -m "feat: add hint text and explosion effects to check button"
```
