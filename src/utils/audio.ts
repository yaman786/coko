/**
 * Professional POS Audio Service
 * Uses Web Audio API to synthesize feedback sounds in real-time.
 */

class AudioService {
  private static instance: AudioService;
  private audioCtx: AudioContext | null = null;

  private constructor() {}

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  /**
   * Generates a clean, sharp 'beep' sound typical of retail scanners.
   */
  playScanSound() {
    try {
      // Initialize context on first interaction to comply with browser policies
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Resume context if suspended (common in many browsers)
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(750, ctx.currentTime); // Lowered from 880 for a "thicker" retail sound
      
      // Envelope: Increased gain and slightly longer duration for more "presence"
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01); // Increased from 0.08
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18); // Extended from 0.12

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.18);
    } catch (error) {
      console.warn('Audio feedback failed (possibly browser permission):', error);
    }
  }
}

export const playScanSound = () => AudioService.getInstance().playScanSound();
