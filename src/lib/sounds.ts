/** Revelio Sound System — xylophone/marimba wood tones via Web Audio API */

let ctx: AudioContext | null = null

function getCtx() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function playTone(freq: number, duration = 0.15, volume = 0.12, type: OscillatorType = 'triangle') {
  try {
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    const filter = c.createBiquadFilter()

    // Wood-like: triangle wave + bandpass filter for warmth
    osc.type = type
    osc.frequency.setValueAtTime(freq, c.currentTime)

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(freq * 1.5, c.currentTime)
    filter.Q.setValueAtTime(2, c.currentTime)

    // Sharp attack, quick decay (like hitting wood)
    gain.gain.setValueAtTime(0, c.currentTime)
    gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(c.destination)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + duration + 0.05)
  } catch { /* audio not available */ }
}

// ── Public sounds ──

/** Success: ascending xylophone C-E-G (major chord) */
export function soundSuccess() {
  playTone(523, 0.12, 0.1) // C5
  setTimeout(() => playTone(659, 0.12, 0.1), 80) // E5
  setTimeout(() => playTone(784, 0.18, 0.12), 160) // G5
}

/** Create: single bright note */
export function soundCreate() {
  playTone(784, 0.15, 0.1) // G5
}

/** Delete: descending two notes */
export function soundDelete() {
  playTone(440, 0.1, 0.08) // A4
  setTimeout(() => playTone(330, 0.15, 0.08), 80) // E4
}

/** Drop: soft low thud (drag & drop landing) */
export function soundDrop() {
  playTone(262, 0.08, 0.06, 'sine') // C4 soft
}

/** Click: tiny tick */
export function soundTick() {
  playTone(1047, 0.04, 0.05) // C6 very short
}

/** Notification: two gentle notes */
export function soundNotify() {
  playTone(659, 0.1, 0.08) // E5
  setTimeout(() => playTone(784, 0.12, 0.08), 100) // G5
}

/** Error: low buzz */
export function soundError() {
  playTone(196, 0.2, 0.08, 'sawtooth') // G3
}

/** Complete: celebratory ascending scale */
export function soundComplete() {
  const notes = [523, 587, 659, 784, 1047] // C D E G C
  notes.forEach((f, i) => setTimeout(() => playTone(f, 0.12, 0.08 + i * 0.01), i * 70))
}

/** Slide: smooth whoosh effect for drag */
export function soundSlide() {
  try {
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, c.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.15)
    gain.gain.setValueAtTime(0.03, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.2)
  } catch { /* */ }
}
