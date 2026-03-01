/**
 * SoundManager - Procedural retro computing sounds using Web Audio API
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle(enabled: boolean) {
    this.enabled = enabled;
  }

  // Quick mechanical click for UI interactions
  playClick() {
    if (!this.enabled) return;
    this.initCtx();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx!.currentTime + 0.05);

    gain.gain.setValueAtTime(0.1, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.05);
  }

  // High-pitched "pick up" beep
  playPickup() {
    if (!this.enabled) return;
    this.initCtx();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, this.ctx!.currentTime + 0.1);

    gain.gain.setValueAtTime(0.05, this.ctx!.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }

  // Low-pitched "set down" thud
  playDrop() {
    if (!this.enabled) return;
    this.initCtx();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx!.currentTime + 0.1);

    gain.gain.setValueAtTime(0.05, this.ctx!.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }

  // Low "buzz" for errors/invalid moves
  playError() {
    if (!this.enabled) return;
    this.initCtx();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx!.currentTime);
    
    gain.gain.setValueAtTime(0.05, this.ctx!.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.2);
  }

  // Celebratory arpeggio for victory
  playWin() {
    if (!this.enabled) return;
    this.initCtx();
    const now = this.ctx!.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.5);
    });
  }
}

export const sounds = new SoundManager();
