import { useEffect, useRef } from 'react';

type Point = [number, number];

interface LaunchPlanItem {
  at: number;
  xRatio: number;
  power: number;
}

interface Rocket {
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  angle: number;
  speed: number;
  acceleration: number;
  distanceTotal: number;
  trail: Point[];
  hue: number;
  brightness: number;
  lineWidth: number;
}

interface Spark {
  x: number;
  y: number;
  angle: number;
  speed: number;
  friction: number;
  gravity: number;
  alpha: number;
  decay: number;
  hue: number;
  brightness: number;
  trail: Point[];
  lineWidth: number;
  flicker: boolean;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  growth: number;
  hue: number;
}

const FIREWORK_COLORS = [8, 24, 42, 56, 128, 186, 204, 284, 324, 350];
const ROCKET_TRAIL_LENGTH = 8;
const MAX_SPARKS = 420;
const EFFECT_DURATION_MS = 5000;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const distance = (x1: number, y1: number, x2: number, y2: number): number =>
  Math.hypot(x2 - x1, y2 - y1);

const randomRange = (min: number, max: number): number => min + Math.random() * (max - min);

const randomInt = (min: number, max: number): number =>
  Math.floor(randomRange(min, max + 1));

const createLaunchPlan = (): LaunchPlanItem[] => {
  const launchCount = 4;
  const baseGap = 780;
  const plan: LaunchPlanItem[] = [];

  for (let i = 0; i < launchCount; i += 1) {
    const progress = launchCount <= 1 ? 0.5 : i / (launchCount - 1);
    plan.push({
      at: Math.max(0, i * baseGap + randomRange(-80, 80)),
      xRatio: clamp(0.08 + progress * 0.84 + randomRange(-0.05, 0.05), 0.06, 0.94),
      power: randomRange(0.92, 1.08),
    });
  }

  return plan.sort((a, b) => a.at - b.at);
};

export function UnlockFireworksOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rockets: Rocket[] = [];
    const sparks: Spark[] = [];
    const shockwaves: Shockwave[] = [];
    const launchPlan = createLaunchPlan();
    let nextLaunchIndex = 0;
    let rafId = 0;

    const applySize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.25));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnRocket = (xRatio?: number, power = 1) => {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      const startX = clamp(
        (xRatio ?? randomRange(0.1, 0.9)) * width + randomRange(-30, 30),
        24,
        Math.max(24, width - 24),
      );
      const startY = height + randomRange(20, 95);
      const targetX = clamp(
        startX + randomRange(-120, 120) * power,
        36,
        Math.max(36, width - 36),
      );
      const targetY = randomRange(height * 0.14, height * 0.44);
      const hue = FIREWORK_COLORS[randomInt(0, FIREWORK_COLORS.length - 1)] ?? 32;
      const trail: Point[] = [];
      for (let i = 0; i < ROCKET_TRAIL_LENGTH; i += 1) {
        trail.push([startX, startY]);
      }
      rockets.push({
        x: startX,
        y: startY,
        startX,
        startY,
        targetX,
        targetY,
        angle: Math.atan2(targetY - startY, targetX - startX),
        speed: randomRange(5.1, 6.6),
        acceleration: randomRange(1.02, 1.04),
        distanceTotal: distance(startX, startY, targetX, targetY),
        trail,
        hue,
        brightness: randomRange(58, 72),
        lineWidth: randomRange(1.6, 2.2),
      });
    };

    const spawnExplosion = (x: number, y: number, baseHue: number, power: number) => {
      const amount = Math.floor(randomRange(36, 54) * power);
      for (let i = 0; i < amount; i += 1) {
        if (sparks.length >= MAX_SPARKS) break;
        const trailLength = randomInt(3, 5);
        const trail: Point[] = [];
        for (let j = 0; j < trailLength; j += 1) {
          trail.push([x, y]);
        }
        sparks.push({
          x,
          y,
          angle: randomRange(0, Math.PI * 2),
          speed: randomRange(1.8, 7.2) * power,
          friction: randomRange(0.915, 0.97),
          gravity: randomRange(0.045, 0.105),
          alpha: 1,
          decay: randomRange(0.01, 0.019),
          hue: baseHue + randomRange(-28, 28),
          brightness: randomRange(58, 84),
          trail,
          lineWidth: randomRange(0.9, 1.9),
          flicker: Math.random() < 0.18,
        });
      }

      shockwaves.push({
        x,
        y,
        radius: 8,
        alpha: randomRange(0.22, 0.36),
        growth: randomRange(3.2, 4.6),
        hue: baseHue,
      });
    };

    applySize();
    window.addEventListener('resize', applySize);
    const startTime = performance.now();

    const drawFrame = (time: number) => {
      const elapsed = time - startTime;
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      while (
        nextLaunchIndex < launchPlan.length &&
        elapsed >= (launchPlan[nextLaunchIndex]?.at ?? Number.POSITIVE_INFINITY)
      ) {
        const launch = launchPlan[nextLaunchIndex];
        if (launch) {
          spawnRocket(launch.xRatio, launch.power);
        }
        nextLaunchIndex += 1;
      }

      for (let i = rockets.length - 1; i >= 0; i -= 1) {
        const rocket = rockets[i];
        if (!rocket) continue;
        rocket.trail.pop();
        rocket.trail.unshift([rocket.x, rocket.y]);
        rocket.speed *= rocket.acceleration;
        rocket.x += Math.cos(rocket.angle) * rocket.speed;
        rocket.y += Math.sin(rocket.angle) * rocket.speed;

        const tail = rocket.trail[rocket.trail.length - 1] ?? [rocket.x, rocket.y];
        ctx.beginPath();
        ctx.moveTo(tail[0], tail[1]);
        ctx.lineTo(rocket.x, rocket.y);
        ctx.lineWidth = rocket.lineWidth;
        ctx.strokeStyle = `hsla(${rocket.hue}, 100%, ${rocket.brightness}%, 0.88)`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `hsla(${rocket.hue}, 100%, 70%, 0.62)`;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rocket.x, rocket.y, rocket.lineWidth * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${rocket.hue}, 100%, 92%, 0.94)`;
        ctx.fill();

        if (distance(rocket.startX, rocket.startY, rocket.x, rocket.y) >= rocket.distanceTotal) {
          spawnExplosion(rocket.targetX, rocket.targetY, rocket.hue, randomRange(0.96, 1.26));
          rockets.splice(i, 1);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i];
        if (!spark) continue;

        spark.trail.pop();
        spark.trail.unshift([spark.x, spark.y]);
        spark.speed *= spark.friction;
        spark.x += Math.cos(spark.angle) * spark.speed;
        spark.y += Math.sin(spark.angle) * spark.speed + spark.gravity;
        spark.alpha -= spark.decay;

        if (spark.alpha <= spark.decay) {
          sparks.splice(i, 1);
          continue;
        }

        const tail = spark.trail[spark.trail.length - 1] ?? [spark.x, spark.y];
        const alpha = clamp(spark.alpha, 0, 1);
        ctx.beginPath();
        ctx.moveTo(tail[0], tail[1]);
        ctx.lineTo(spark.x, spark.y);
        ctx.lineWidth = spark.lineWidth;
        ctx.strokeStyle = `hsla(${spark.hue}, 100%, ${spark.brightness}%, ${alpha})`;
        ctx.shadowBlur = 0;
        ctx.stroke();

        if (spark.flicker && Math.random() < 0.24) {
          const glowRadius = randomRange(0.55, 1.4) * (spark.lineWidth + 0.45);
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${spark.hue}, 100%, ${Math.min(96, spark.brightness + 15)}%, ${alpha * randomRange(0.34, 0.9)})`;
          ctx.fill();
        }
      }

      for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
        const wave = shockwaves[i];
        if (!wave) continue;
        wave.radius += wave.growth;
        wave.alpha -= 0.021;
        if (wave.alpha <= 0.01) {
          shockwaves.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.lineWidth = 1.15;
        ctx.strokeStyle = `hsla(${wave.hue}, 100%, 84%, ${wave.alpha})`;
        ctx.shadowBlur = 3;
        ctx.shadowColor = `hsla(${wave.hue}, 100%, 76%, ${Math.min(0.38, wave.alpha)})`;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      const hasActiveElements = rockets.length > 0 || sparks.length > 0 || shockwaves.length > 0;
      if (elapsed < EFFECT_DURATION_MS || hasActiveElements) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    rafId = window.requestAnimationFrame(drawFrame);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', applySize);
    };
  }, []);

  return (
    <div className="unlock-fireworks-overlay" aria-hidden="true">
      <canvas ref={canvasRef} className="unlock-fireworks-canvas" />
    </div>
  );
}
