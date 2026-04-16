// ═══ CELEBRATION — Samsung TV style blackout + wizard voice + light reveal ═══
// Phase 1: Horizontal bars close from top/bottom to center line (~1.5s)
// Phase 2: Total black, wizard voice "REVELIO!" (~2s)
// Phase 3: Bars open from center outward + light burst (~1.5s)
// Phase 4: "revelio" logo + "travesura realizada ✨" (~2s)

export function playCelebration(tier: 'nox' | 'lumos' | 'revelio' | 'patronum' = 'revelio') {
  // NOX: brief dark flash, no ceremony
  if (tier === 'nox') {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;opacity:0;transition:opacity .3s';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '0.7');
    setTimeout(() => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 300); }, 800);
    return;
  }

  // LUMOS: simple glow pulse, no full ceremony
  if (tier === 'lumos') {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);opacity:0;transition:opacity .4s';
    const inner = document.createElement('div');
    inner.style.cssText = 'text-align:center;opacity:0;transform:scale(0.8);transition:all .5s cubic-bezier(0.34,1.56,0.64,1)';
    inner.innerHTML = '<div style="font-size:48px">💡</div><div style="font-family:Comfortaa,sans-serif;font-size:24px;color:#FF9500;margin-top:8px;font-weight:700">Lumos</div><div style="font-size:12px;color:#86868B;margin-top:4px">Retro aceptable — hay margen de mejora</div>';
    overlay.appendChild(inner);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; inner.style.opacity = '1'; inner.style.transform = 'scale(1)'; });
    setTimeout(() => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 400); }, 2500);
    return;
  }

  // REVELIO + PATRONUM: full ceremony
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const c = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  document.body.appendChild(canvas);

  let frame = 0;
  const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; hue: number }> = [];

  // ── SOUND: Dark descent (phase 1 only — ends before voice) ──
  function playDarkClose() {
    try {
      const a = new AudioContext(), t = a.currentTime;
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(200, t);
      o.frequency.exponentialRampToValueAtTime(25, t + 1.0);
      g.gain.setValueAtTime(0.03, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 1.3);
      setTimeout(() => a.close(), 2000);
    } catch {}
  }

  // ── SOUND: Wizard voice "REVELIO!" — spell incantation ──
  function playWizardVoice() {
    try {
      if ('speechSynthesis' in window) {
        // Pre-load voices
        const voices = speechSynthesis.getVoices();
        const deep = voices.find(v => v.lang.startsWith('es') && v.name.toLowerCase().includes('male'))
          || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male'))
          || voices.find(v => v.lang.startsWith('es'))
          || voices[0];

        // Dramatic slow incantation
        const utt = new SpeechSynthesisUtterance('Rrreevelio!');
        utt.rate = 0.45;   // very slow, dramatic
        utt.pitch = 0.3;   // deep, commanding
        utt.volume = 1.0;
        if (deep) utt.voice = deep;
        speechSynthesis.speak(utt);

        // Trailing echo: subtle reverberant tone that follows the voice
        setTimeout(() => {
          try {
            const a = new AudioContext(), t = a.currentTime;
            const rev = a.createConvolver();
            const rl = a.sampleRate * 3, rb = a.createBuffer(2, rl, a.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
              const d = rb.getChannelData(ch);
              for (let i = 0; i < rl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 1.5);
            }
            rev.buffer = rb; rev.connect(a.destination);
            // Ghost echo — very soft harmonic that fades like spell reverb
            const echo = a.createOscillator(), eg = a.createGain();
            echo.type = 'sine'; echo.frequency.value = 180;
            eg.gain.setValueAtTime(0.015, t);
            eg.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
            echo.connect(eg); eg.connect(rev);
            echo.start(t); echo.stop(t + 2);
            setTimeout(() => a.close(), 4000);
          } catch {}
        }, 800);
      }
    } catch {}
  }

  // ── SOUND: Pleasant chime on light reveal ──
  function playRevealChime() {
    try {
      const a = new AudioContext(), t = a.currentTime;
      const rev = a.createConvolver();
      const rl = a.sampleRate * 2, rb = a.createBuffer(2, rl, a.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = rb.getChannelData(ch);
        for (let i = 0; i < rl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.5);
      }
      rev.buffer = rb; rev.connect(a.destination);
      // Rising chime: C-E-G-C
      [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
        const o = a.createOscillator(), g = a.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t + i * 0.1);
        g.gain.linearRampToValueAtTime(0.04 / (i * 0.3 + 1), t + i * 0.1 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 2.5);
        o.connect(g); g.connect(rev); g.connect(a.destination);
        o.start(t + i * 0.1); o.stop(t + i * 0.1 + 3);
      });
      setTimeout(() => a.close(), 5000);
    } catch {}
  }

  // ── Easing ──
  const easeInOut = (t: number) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2.5);

  // No sound during phase 1 — silence builds tension
  playDarkClose();

  function animate() {
    frame++;
    c.clearRect(0, 0, W, H);

    // ═══ PHASE 1: Samsung TV OFF — horizontal bars close to center (frames 1-90) ═══
    if (frame <= 90) {
      const p = easeInOut(frame / 90);
      const gap = (H / 2) * (1 - p); // gap shrinks from H/2 to 0

      // Top bar
      c.fillStyle = '#020014';
      c.fillRect(0, 0, W, cy - gap);

      // Bottom bar
      c.fillRect(0, cy + gap, W, H);

      // Edge glow along the closing line
      if (gap > 2) {
        const glowIntensity = p * 0.4;
        // Top edge
        const gTop = c.createLinearGradient(0, cy - gap - 20, 0, cy - gap);
        gTop.addColorStop(0, 'rgba(88,86,214,0)');
        gTop.addColorStop(1, `rgba(88,86,214,${glowIntensity})`);
        c.fillStyle = gTop;
        c.fillRect(0, cy - gap - 20, W, 20);

        // Bottom edge
        const gBot = c.createLinearGradient(0, cy + gap, 0, cy + gap + 20);
        gBot.addColorStop(0, `rgba(88,86,214,${glowIntensity})`);
        gBot.addColorStop(1, 'rgba(88,86,214,0)');
        c.fillStyle = gBot;
        c.fillRect(0, cy + gap, W, 20);

        // Bright center line as bars approach
        if (p > 0.7) {
          const lineGlow = (p - 0.7) / 0.3;
          c.fillStyle = `rgba(160,140,255,${lineGlow * 0.3})`;
          c.fillRect(0, cy - 1, W, 2);
        }
      }

      // Scanline effect
      if (frame > 20) {
        const scanAlpha = Math.min(0.06, (frame - 20) / 70 * 0.06);
        for (let y = 0; y < H; y += 3) {
          c.fillStyle = `rgba(88,86,214,${scanAlpha})`;
          c.fillRect(0, y, W, 1);
        }
      }
    }

    // ═══ PHASE 2: TOTAL BLACK + wizard voice (frames 91-210) ═══
    if (frame > 90 && frame <= 210) {
      c.fillStyle = '#020014';
      c.fillRect(0, 0, W, H);

      // Trigger voice at frame 120
      if (frame === 120) { /* silence during black */ }

      // Subtle breathing glow in center
      if (frame > 150) {
        const b = Math.min(1, (frame - 150) / 60);
        const pulse = Math.sin((frame - 150) * 0.06) * 0.3 + 0.7;
        const gr = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, 50 * b * pulse));
        gr.addColorStop(0, `rgba(160,140,255,${0.15 * b * pulse})`);
        gr.addColorStop(0.5, `rgba(88,86,214,${0.06 * b * pulse})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr;
        c.beginPath();
        c.arc(cx, cy, Math.max(1, 50 * b * pulse), 0, Math.PI * 2);
        c.fill();
      }

      // Thin bright line at center, pulsing
      if (frame > 170) {
        const lineP = Math.min(1, (frame - 170) / 40);
        const lineW = W * 0.3 * lineP;
        c.fillStyle = `rgba(200,190,255,${lineP * 0.5})`;
        c.fillRect(cx - lineW / 2, cy - 0.5, lineW, 1);
      }
    }

    // ═══ PHASE 3: Samsung TV ON — bars open from center + light burst (frames 211-320) ═══
    if (frame > 210 && frame <= 320) {
      if (frame === 211) playRevealChime();

      const p = easeOut((frame - 210) / 110);
      const gap = (H / 2) * p; // gap grows from 0 to H/2

      // White flash at very start
      if (frame < 225) {
        const flash = (225 - frame) / 15;
        c.fillStyle = `rgba(220,215,255,${flash * 0.6})`;
        c.fillRect(0, 0, W, H);
      }

      // Light rays from center line
      if (gap > 5) {
        const rayCount = 16;
        for (let i = 0; i < rayCount; i++) {
          const angle = (i / rayCount) * Math.PI * 2 + frame * 0.003;
          const rayLen = gap * 2 * (0.6 + Math.sin(i * 2.7) * 0.4);
          const hue = 230 + (i / rayCount) * 60;
          const alpha = 0.12 * (1 - p);

          const grd = c.createLinearGradient(cx, cy, cx + Math.cos(angle) * rayLen, cy + Math.sin(angle) * rayLen);
          grd.addColorStop(0, `hsla(${hue},80%,85%,${alpha})`);
          grd.addColorStop(0.4, `hsla(${hue},70%,70%,${alpha * 0.4})`);
          grd.addColorStop(1, 'hsla(0,0%,100%,0)');

          c.save();
          c.beginPath();
          c.moveTo(cx, cy);
          c.lineTo(cx + Math.cos(angle - 0.04) * rayLen, cy + Math.sin(angle - 0.04) * rayLen);
          c.lineTo(cx + Math.cos(angle + 0.04) * rayLen, cy + Math.sin(angle + 0.04) * rayLen);
          c.closePath();
          c.fillStyle = grd;
          c.fill();
          c.restore();
        }
      }

      // Dark bars receding
      c.fillStyle = '#020014';
      c.fillRect(0, 0, W, cy - gap);
      c.fillRect(0, cy + gap, W, H);

      // Edge glow on the opening bars
      if (gap > 2 && gap < H / 2 - 10) {
        const glowI = (1 - p) * 0.6;
        const gT = c.createLinearGradient(0, cy - gap, 0, cy - gap + 15);
        gT.addColorStop(0, `rgba(160,140,255,${glowI})`);
        gT.addColorStop(1, 'rgba(88,86,214,0)');
        c.fillStyle = gT;
        c.fillRect(0, cy - gap, W, 15);

        const gB = c.createLinearGradient(0, cy + gap - 15, 0, cy + gap);
        gB.addColorStop(0, 'rgba(88,86,214,0)');
        gB.addColorStop(1, `rgba(160,140,255,${glowI})`);
        c.fillStyle = gB;
        c.fillRect(0, cy + gap - 15, W, 15);
      }

      // Particles at wavefront
      if (frame % 2 === 0 && gap < H / 2 * 0.8) {
        for (let i = 0; i < 8; i++) {
          const px = Math.random() * W;
          const py = cy + (Math.random() > 0.5 ? gap : -gap) + (Math.random() - 0.5) * 10;
          particles.push({
            x: px, y: py,
            vx: (Math.random() - 0.5) * 2,
            vy: (py > cy ? 1 : -1) * (Math.random() * 2 + 1),
            life: 30 + Math.random() * 25,
            maxLife: 30 + Math.random() * 25,
            size: 1 + Math.random() * 2.5,
            hue: 230 + Math.random() * 60,
          });
        }
      }
    }

    // ═══ PHASE 4: "revelio" logo (frames 290-480) ═══
    if (frame > 290 && frame <= 480) {
      const tIn = Math.min(1, (frame - 290) / 30);
      const tOut = frame > 440 ? Math.max(0, (480 - frame) / 40) : 1;
      const tA = tIn * tOut;
      const scale = 0.9 + tIn * 0.1;
      const wave = Math.sin(frame * 0.04) * 3 * Math.max(0, 1 - (frame - 290) / 100);

      c.save();
      c.globalAlpha = tA;
      c.translate(cx, cy);
      c.scale(scale, scale);

      // Triple glow
      c.font = '700 60px Comfortaa, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.shadowColor = '#5856D6';
      c.shadowBlur = 50;
      c.fillStyle = 'rgba(88,86,214,.04)';
      c.fillText('revelio', 0, wave);
      c.shadowBlur = 30;
      c.fillText('revelio', 0, wave);

      // Gradient text
      const tg = c.createLinearGradient(-130, 0, 130, 0);
      tg.addColorStop(0, '#007AFF');
      tg.addColorStop(0.35, '#5856D6');
      tg.addColorStop(0.65, '#AF52DE');
      tg.addColorStop(1, '#007AFF');
      c.shadowColor = '#8B7FFF';
      c.shadowBlur = 20;
      c.fillStyle = tg;
      c.fillText('revelio', 0, wave);

      // Subtitle
      c.shadowBlur = 0;
      c.font = '500 15px Comfortaa, sans-serif';
      c.fillStyle = `rgba(140,135,155,${tA * 0.7})`;
      const subtitle = tier === 'patronum' ? 'Expecto Patronum! 🦌' : 'travesura realizada ✨';
      c.fillText(subtitle, 0, 42 + wave * 0.6);

      // Tier badge
      c.font = '600 11px -apple-system, sans-serif';
      c.fillStyle = `rgba(${tier === 'patronum' ? '88,86,214' : '0,122,255'},${tA * 0.5})`;
      c.fillText(tier === 'patronum' ? '⭐ PATRONUM — Retro excelente' : '✨ REVELIO — Buena retro', 0, 68 + wave * 0.4);

      c.restore();

      // Logo particles
      if (frame % 7 === 0 && frame < 440) {
        const count = tier === 'patronum' ? 5 : 2;
        for (let i = 0; i < count; i++) {
          particles.push({
            x: cx + (Math.random() - 0.5) * 280,
            y: cy + (Math.random() - 0.5) * 80,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -Math.random() * 1 - 0.3,
            life: 30 + Math.random() * 25,
            maxLife: 30 + Math.random() * 25,
            size: tier === 'patronum' ? 1 + Math.random() * 2.5 : 0.6 + Math.random() * 1.5,
            hue: tier === 'patronum' ? 200 + Math.random() * 40 : 250 + Math.random() * 50,
          });
        }
      }

      // Patronum: draw patronus silhouette glow
      if (tier === 'patronum' && frame > 310 && frame < 420) {
        const pAlpha = Math.min(1, (frame - 310) / 30) * (frame > 380 ? Math.max(0, (420 - frame) / 40) : 1);
        c.save(); c.globalAlpha = pAlpha * 0.15;
        const pGlow = c.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 120);
        pGlow.addColorStop(0, 'rgba(120,180,255,1)');
        pGlow.addColorStop(1, 'rgba(88,86,214,0)');
        c.fillStyle = pGlow; c.beginPath(); c.arc(cx, cy - 20, 120, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }

    // ── Render particles ──
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.97; p.vy *= 0.97; p.vy -= 0.01;
      p.life--;
      const a = Math.min(1, p.life / p.maxLife * 2);
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      g.addColorStop(0, `hsla(${p.hue},75%,75%,${a * 0.5})`);
      g.addColorStop(0.5, `hsla(${p.hue},60%,55%,${a * 0.1})`);
      g.addColorStop(1, 'hsla(0,0%,0%,0)');
      c.fillStyle = g;
      c.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6);
    });
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    if (frame < 490) requestAnimationFrame(animate);
    else canvas.remove();
  }

  requestAnimationFrame(animate);
}
