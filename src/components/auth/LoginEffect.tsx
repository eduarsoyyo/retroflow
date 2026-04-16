// ═══ LOGIN EFFECT — Spectacular entrance animation ═══

export function playLoginEffect(onComplete: () => void) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0A1628;display:flex;align-items:center;justify-content:center;flex-direction:column;overflow:hidden';

  // Canvas for particles + light
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;

  // Logo container
  const logoWrap = document.createElement('div');
  logoWrap.style.cssText = 'position:relative;z-index:2;text-align:center;opacity:0;transform:scale(0.3);transition:all .8s cubic-bezier(0.34,1.56,0.64,1)';
  
  const logo = document.createElement('div');
  logo.style.cssText = 'font-family:Comfortaa,sans-serif;font-size:56px;font-weight:400;letter-spacing:8px;background:linear-gradient(90deg,#007AFF,#5856D6,#AF52DE);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text';
  logo.textContent = 'revelio';

  const sub = document.createElement('div');
  sub.style.cssText = 'font-size:14px;color:#86868B;margin-top:12px;opacity:0;transition:opacity .6s ease .5s';
  sub.textContent = 'Ningún proyecto debería moverse en las sombras';

  logoWrap.appendChild(logo);
  logoWrap.appendChild(sub);
  overlay.appendChild(canvas);
  overlay.appendChild(logoWrap);
  document.body.appendChild(overlay);

  // Pleasant chime sound
  function playChime() {
    try {
      const a = new AudioContext(), t = a.currentTime;
      // Bell tone: two harmonics + soft decay
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = a.createOscillator(), g = a.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, t + i * 0.08);
        g.gain.linearRampToValueAtTime(0.06 / (i + 1), t + i * 0.08 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 2);
        osc.connect(g); g.connect(a.destination);
        osc.start(t + i * 0.08); osc.stop(t + i * 0.08 + 2.5);
      });
      // Soft pad underneath
      const pad = a.createOscillator(), pg = a.createGain();
      pad.type = 'triangle'; pad.frequency.value = 261.63;
      pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(0.03, t + 0.3);
      pg.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
      pad.connect(pg); pg.connect(a.destination);
      pad.start(t); pad.stop(t + 3);
      setTimeout(() => a.close(), 4000);
    } catch {}
  }

  // Particles
  const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; hue: number }> = [];
  let frame = 0;
  let glowRadius = 0;

  function animate() {
    frame++;
    ctx.clearRect(0, 0, W, H);

    // Phase 1 (0-40): Growing glow orb from center
    if (frame <= 40) {
      glowRadius = (frame / 40) * Math.min(W, H) * 0.4;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
      grad.addColorStop(0, `rgba(88,86,214,${0.3 * (frame / 40)})`);
      grad.addColorStop(0.5, `rgba(0,122,255,${0.15 * (frame / 40)})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2); ctx.fill();
    }

    // Phase 2 (30-50): Explosion — spawn many particles
    if (frame >= 30 && frame <= 50 && frame % 1 === 0) {
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 6;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 50 + Math.random() * 40, maxLife: 50 + Math.random() * 40,
          size: 1 + Math.random() * 3, hue: 220 + Math.random() * 80,
        });
      }
    }

    // Phase 2 (30+): Show logo
    if (frame === 30) {
      playChime();
      logoWrap.style.opacity = '1';
      logoWrap.style.transform = 'scale(1)';
      sub.style.opacity = '1';
    }

    // Light rays from center (frames 30-80)
    if (frame >= 30 && frame <= 80) {
      const rayAlpha = Math.max(0, 1 - (frame - 30) / 50) * 0.08;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + frame * 0.005;
        const len = glowRadius * 1.5;
        const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        grad.addColorStop(0, `rgba(120,100,255,${rayAlpha})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle - 0.03) * len, cy + Math.sin(angle - 0.03) * len);
        ctx.lineTo(cx + Math.cos(angle + 0.03) * len, cy + Math.sin(angle + 0.03) * len);
        ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      }
    }

    // Render particles
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.97; p.vy *= 0.97;
      p.life--;
      const a = Math.min(1, p.life / p.maxLife * 2);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      g.addColorStop(0, `hsla(${p.hue},80%,75%,${a * 0.5})`);
      g.addColorStop(0.5, `hsla(${p.hue},60%,55%,${a * 0.1})`);
      g.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6);
    });
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // Ambient floating particles (frames 50+)
    if (frame > 50 && frame % 4 === 0 && particles.length < 30) {
      particles.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3, vy: -Math.random() * 0.5 - 0.2,
        life: 60 + Math.random() * 40, maxLife: 60 + Math.random() * 40,
        size: 0.5 + Math.random() * 1.5, hue: 230 + Math.random() * 50,
      });
    }

    if (frame < 120) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // Fade out and complete
  setTimeout(() => {
    overlay.style.transition = 'opacity .5s ease';
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); onComplete(); }, 500);
  }, 2200);
}
