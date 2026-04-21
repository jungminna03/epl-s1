const EMOJIS = ["💯", "👍", "👏", "🎉", "⭐", "✨", "🏆", "💪", "🥇", "✅", "❤️", "🔥"];

export interface EffectResult {
  scale: number;
  cooldownMs: number;
}

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
  if (scale < 0.60) return 400;
  if (scale < 1.00) return 800;
  if (scale < 1.40) return 1200;
  return 1800;
}

function fireConfettiCannon(scale: number) {
  const layer = document.createElement("div");
  Object.assign(layer.style, {
    position: "fixed", top: "0", left: "0",
    width: "100vw", height: "100vh",
    pointerEvents: "none", zIndex: "9999", overflow: "hidden",
  });
  document.body.appendChild(layer);

  const count = Math.min(5 + Math.round(scale * 15), 20);
  const sides: Array<{ x: number; dirX: number }> = [
    { x: 40, dirX: 1 },
    { x: innerWidth - 40, dirX: -1 },
  ];

  for (const side of sides) {
    for (let i = 0; i < count; i++) {
      const emoji = document.createElement("div");
      const em = EMOJIS[~~(Math.random() * EMOJIS.length)];
      const size = 20 + Math.random() * 14 + scale * 10;

      // Explosive burst — upward, decelerating, no gravity drop
      const angle = -30 - Math.random() * 80; // -30° ~ -110° (upward fan)
      const angleRad = (angle * Math.PI) / 180;
      const power = 250 + Math.random() * 300 + scale * 200;
      const dx = side.dirX * Math.abs(Math.cos(angleRad)) * power;
      const dy = Math.sin(angleRad) * power;
      const rot = (Math.random() - 0.5) * 360;

      Object.assign(emoji.style, {
        position: "absolute",
        left: `${side.x}px`,
        bottom: "20px",
        fontSize: `${size}px`,
        lineHeight: "1",
        willChange: "transform, opacity",
      });
      emoji.textContent = em;

      // 10fps 기준으로도 보이게: 긴 duration + ease-out으로 점점 느려지며 페이드
      emoji.animate(
        [
          {
            transform: "translateX(0) translateY(0) scale(0.3) rotate(0deg)",
            opacity: "1",
          },
          {
            transform: `translateX(${dx * 0.3}px) translateY(${dy * 0.3}px) scale(1.3) rotate(${rot * 0.2}deg)`,
            opacity: "1",
            offset: 0.15,
          },
          {
            transform: `translateX(${dx * 0.7}px) translateY(${dy * 0.7}px) scale(1) rotate(${rot * 0.6}deg)`,
            opacity: "0.8",
            offset: 0.5,
          },
          {
            transform: `translateX(${dx}px) translateY(${dy}px) scale(0.8) rotate(${rot}deg)`,
            opacity: "0",
          },
        ],
        {
          duration: 1800 + Math.random() * 800 + scale * 500,
          easing: "ease-out",
          fill: "forwards" as FillMode,
          delay: Math.random() * 60,
        },
      );
      layer.appendChild(emoji);
    }
  }

  setTimeout(() => layer.remove(), 3500 + scale * 500);
}

export function fireCheckEffect(ox: number, oy: number): EffectResult {
  const scale = randomScale();
  const cooldownMs = getCooldownMs(scale);

  fireConfettiCannon(scale);

  return { scale, cooldownMs };
}
