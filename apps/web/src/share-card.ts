import * as THREE from "three";
import { BeybladePreviewWorld } from "@game-pool/beyblade-visuals";
import {
  SHARE_CARD,
  type BeybladeType,
  type ShareCardData,
} from "@game-pool/beyblade-core";

declare global {
  interface CanvasRenderingContext2D {
    letterSpacing: string;
  }
}

const FONT_STACK =
  'Inter, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif';

/**
 * Renders the winning blade alone on a transparent canvas using a throwaway
 * WebGL context. The battle canvas cannot be captured (no
 * preserveDrawingBuffer + postprocessing), so the card gets its own render.
 * The drawImage copy must stay in the same synchronous task as render().
 */
function renderBladeSprite(type: BeybladeType, size = 1024): HTMLCanvasElement {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(size, size, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 7, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0x009bd6, 1.5, 8);
  rim.position.set(-3, 2, 2);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100);
  camera.position.set(0, 2.1, 3.5);
  camera.lookAt(0, 0.25, 0);

  const world = new BeybladePreviewWorld(type);
  world.update(0.55);
  scene.add(world.root);

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  try {
    renderer.render(scene, camera);
    out.getContext("2d")?.drawImage(renderer.domElement, 0, 0);
  } finally {
    scene.remove(world.root);
    world.dispose();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return out;
}

export async function composeShareCard(data: ShareCardData): Promise<Blob> {
  const { width, height, colors, finishColors } = SHARE_CARD;
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立分享卡畫布");

  // 1. Outer Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, colors.bgGradientStart);
  bgGrad.addColorStop(1, colors.bgGradientEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Hard offset shadow for main card frame
  ctx.fillStyle = colors.ink;
  ctx.fillRect(38, 38, width - 62, height - 62);

  // Main Card Body
  const cardMargin = 24;
  const cardW = width - cardMargin * 2 - 14;
  const cardH = height - cardMargin * 2 - 14;
  ctx.fillStyle = colors.card;
  ctx.fillRect(cardMargin, cardMargin, cardW, cardH);

  // Inner metallic tech border
  ctx.lineWidth = 4;
  ctx.strokeStyle = colors.cardBorder;
  ctx.strokeRect(cardMargin + 8, cardMargin + 8, cardW - 16, cardH - 16);

  // Outer border stroke
  ctx.lineWidth = 12;
  ctx.strokeStyle = colors.ink;
  ctx.strokeRect(32, 32, width - 78, height - 78);

  // Diagonal Cyber Corner Accents
  ctx.save();
  ctx.beginPath();
  ctx.rect(40, 40, width - 94, height - 94);
  ctx.clip();

  // Top-left cyber glow triangle
  ctx.fillStyle = colors.accent;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.moveTo(40, 40);
  ctx.lineTo(380, 40);
  ctx.lineTo(40, 320);
  ctx.closePath();
  ctx.fill();

  // Bottom-right cyber slash
  ctx.fillStyle = colors.accent;
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.moveTo(width - 54, height - 54);
  ctx.lineTo(width - 400, height - 54);
  ctx.lineTo(width - 54, height - 320);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 2. Top Header - Game Title
  ctx.fillStyle = colors.accent;
  ctx.font = `900 32px ${FONT_STACK}`;
  ctx.save();
  ctx.letterSpacing = "10px";
  ctx.fillText(data.title, width / 2, 110);
  ctx.restore();

  // 3. Victory Headline (Skewed Cyber Stencil / Neon Gold Glow)
  ctx.save();
  ctx.transform(1, 0, -Math.tan((6 * Math.PI) / 180), 1, 0, 0);
  const skewOffset = Math.tan((6 * Math.PI) / 180) * 210;
  ctx.font = `900 130px ${FONT_STACK}`;

  // Glow / Drop Shadow behind VICTORY
  ctx.fillStyle = colors.ink;
  ctx.fillText(data.headline, width / 2 + skewOffset + 4, 216);

  // Outer Stroke
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 14;
  ctx.strokeText(data.headline, width / 2 + skewOffset, 210);

  // Gold Text Fill
  ctx.fillStyle = colors.win;
  ctx.fillText(data.headline, width / 2 + skewOffset, 210);
  ctx.restore();

  // 4. Center Stage 3D Beyblade Backdrop & Render
  const bladeCenterY = 540;
  const glowColor = `#${data.bladeColor.toString(16).padStart(6, "0")}`;

  // Outer Radial Aura Glow
  const glow = ctx.createRadialGradient(
    width / 2,
    bladeCenterY,
    30,
    width / 2,
    bladeCenterY,
    340,
  );
  glow.addColorStop(0, `${glowColor}55`);
  glow.addColorStop(0.5, `${glowColor}22`);
  glow.addColorStop(1, `${glowColor}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(width / 2 - 350, bladeCenterY - 350, 700, 700);

  // Holographic Cyber Pedestal Rings
  ctx.save();
  ctx.strokeStyle = colors.accent;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(width / 2, bladeCenterY + 110, 240, 60, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(width / 2, bladeCenterY + 110, 290, 72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 3D Beyblade Sprite Render
  const blade = renderBladeSprite(data.bladeType);
  ctx.drawImage(blade, width / 2 - 270, bladeCenterY - 270, 540, 540);

  // 5. Blade Name & Subtitle
  ctx.fillStyle = colors.textLight;
  ctx.font = `900 64px ${FONT_STACK}`;
  ctx.fillText(data.bladeName, width / 2, 840);

  ctx.fillStyle = colors.muted;
  ctx.font = `700 28px ${FONT_STACK}`;
  ctx.save();
  ctx.letterSpacing = "6px";
  ctx.fillText(data.bladeEnglishName.toUpperCase(), width / 2, 890);
  ctx.restore();

  // 6. Finish Achievement Badge
  ctx.font = `900 36px ${FONT_STACK}`;
  const finishText = data.finishType;
  const badgeWidth = ctx.measureText(finishText).width + 100;
  const badgeY = 932;
  ctx.save();
  ctx.transform(1, 0, -Math.tan((4 * Math.PI) / 180), 1, 0, 0);
  const badgeSkew = Math.tan((4 * Math.PI) / 180) * (badgeY + 30);
  const badgeX = width / 2 - badgeWidth / 2 + badgeSkew;

  // Badge Shadow
  ctx.fillStyle = colors.ink;
  ctx.fillRect(badgeX - 4, badgeY + 4, badgeWidth, 60);

  // Badge Body Fill
  ctx.fillStyle = finishColors[data.finishType];
  ctx.fillRect(badgeX, badgeY, badgeWidth, 60);

  // Badge Border
  ctx.lineWidth = 4;
  ctx.strokeStyle = colors.ink;
  ctx.strokeRect(badgeX, badgeY, badgeWidth, 60);

  // Badge Text
  ctx.fillStyle = "#ffffff";
  ctx.fillText(finishText, badgeX + badgeWidth / 2, badgeY + 32);
  ctx.restore();

  // 7. Glassmorphic Battle Stats Container Box (Bottom)
  const panelW = width - 120;
  const panelH = 140;
  const panelX = width / 2 - panelW / 2;
  const panelY = 1030;

  ctx.save();
  // Panel Background
  ctx.fillStyle = colors.panelBg;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 16);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.panelBorder;
    ctx.stroke();
  } else {
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.panelBorder;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
  }

  // Inside Match Stats Content
  // Left: Winner Info (Name + Win Record Pill)
  const leftX = panelX + panelW * 0.28;
  const rightX = panelX + panelW * 0.72;
  const centerY = panelY + panelH / 2;

  // Winner Name
  ctx.textAlign = "center";
  ctx.fillStyle = colors.win;
  ctx.font = `900 42px ${FONT_STACK}`;
  ctx.fillText(data.playerName, leftX, centerY - (data.recordText ? 20 : 0));

  // Record Pill under Winner Name (if present)
  if (data.recordText) {
    ctx.font = `800 24px ${FONT_STACK}`;
    const recW = ctx.measureText(data.recordText).width + 32;
    const recH = 36;
    const recX = leftX - recW / 2;
    const recY = centerY + 18 - recH / 2;

    ctx.fillStyle = colors.card;
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(recX, recY, recW, recH, 18);
      ctx.fill();
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillRect(recX, recY, recW, recH);
    }
    ctx.fillStyle = colors.accent;
    ctx.fillText(data.recordText, leftX, centerY + 19);
  }

  // Center: VS Emblem
  ctx.textAlign = "center";
  ctx.font = `italic 900 36px ${FONT_STACK}`;
  ctx.fillStyle = colors.accent;
  ctx.fillText("VS", width / 2, centerY);

  // Right: Opponent Name
  ctx.textAlign = "center";
  ctx.fillStyle = colors.muted;
  ctx.font = `800 38px ${FONT_STACK}`;
  ctx.fillText(data.opponentName, rightX, centerY);

  ctx.restore();

  // 8. Footer Date & Game Subtitle
  const date = new Date();
  const dateText = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  ctx.save();
  ctx.textAlign = "center";
  ctx.letterSpacing = "4px";
  ctx.fillStyle = colors.muted;
  ctx.font = `600 18px ${FONT_STACK}`;
  ctx.fillText(`${dateText} · CYBERBLADE 3D BATTLE`, width / 2, 1200);

  // 9. Styled CTA Button (Play Free)
  ctx.letterSpacing = "2px";
  ctx.font = `900 22px ${FONT_STACK}`;
  const prefixText = "PLAY FREE AT ";
  const urlText = "CYBERBLADE3D.COM";
  const prefixWidth = ctx.measureText(prefixText).width;
  const urlWidth = ctx.measureText(urlText).width;
  const totalTextWidth = prefixWidth + urlWidth;

  const btnWidth = totalTextWidth + 56;
  const btnHeight = 44;
  const btnY = 1234;

  ctx.transform(1, 0, -Math.tan((4 * Math.PI) / 180), 1, 0, 0);
  const btnSkew = Math.tan((4 * Math.PI) / 180) * (btnY + btnHeight / 2);
  const btnX = width / 2 - btnWidth / 2 + btnSkew;

  // Button Shadow
  ctx.fillStyle = colors.ink;
  ctx.fillRect(btnX - 4, btnY + 4, btnWidth, btnHeight);

  // Button Background
  ctx.fillStyle = colors.panelBg;
  ctx.fillRect(btnX, btnY, btnWidth, btnHeight);

  // Button Border
  ctx.lineWidth = 3;
  ctx.strokeStyle = colors.accent;
  ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

  // Text inside button
  const startTextX = btnX + (btnWidth - totalTextWidth) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(prefixText, startTextX, btnY + btnHeight / 2 + 2);
  ctx.fillStyle = colors.accent;
  ctx.fillText(urlText, startTextX + prefixWidth, btnY + btnHeight / 2 + 2);

  ctx.restore();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("分享卡輸出失敗"));
    }, "image/png");
  });
}

export function canShareFile(file: File): boolean {
  return (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

export async function shareCard(file: File): Promise<void> {
  try {
    await navigator.share({
      files: [file],
      title: "CYBERBLADE 3D",
      text: "我在 CYBERBLADE 3D 打贏了！",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  }
}

export function downloadCard(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "cyberblade-victory.png";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
