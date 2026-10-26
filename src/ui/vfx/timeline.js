// Plays one timeline from the library on its own clock. No DOM: the engine
// (engine.js) supplies the handlers that move cards and spawn particles, and
// the tests drive it directly.
//
// handlers (all optional):
//   start(beat)            a beat begins (a stream starts, a card starts moving)
//   update(beat, k)        a beat with an end, k from 0 to 1 while it runs
//   end(beat)              a beat with an end finishes (the card is back home)
//   fire(beat, { skipped }) a beat with no end: a burst or a cue (the hit lands)
// A beat's hitstop (ms, times `scale`) freezes this clock: nothing moves.

export class Timeline {
  constructor(def, { handlers = {}, scale = 1 } = {}) {
    this.def = def;
    this.handlers = handlers;
    this.scale = scale;
    this.t = 0;            // timeline ms
    this.frozen = 0;       // hit-stop ms still to wait
    this.done = false;
    this.state = def.beats.map(() => 'waiting');   // waiting · running · finished
  }

  // Moves the clock on by dt ms (already adjusted for the speed setting).
  advance(dt) {
    if (this.done) return;
    if (this.frozen > 0) {
      const used = Math.min(this.frozen, dt);
      this.frozen -= used;
      dt -= used;
      if (dt <= 0) return;
    }
    this.t += dt;
    this.def.beats.forEach((beat, i) => {
      if (this.state[i] === 'finished' || this.t < beat.at) return;
      if (beat.end === undefined) {
        this.state[i] = 'finished';
        this.call('fire', beat, { skipped: false });
        if (beat.hitstop) this.frozen += beat.hitstop * this.scale;
        return;
      }
      if (this.state[i] === 'waiting') {
        this.state[i] = 'running';
        this.call('start', beat);
      }
      const k = Math.min(1, (this.t - beat.at) / Math.max(1, beat.end - beat.at));
      this.call('update', beat, k);
      if (k >= 1) {
        this.state[i] = 'finished';
        this.call('end', beat);
      }
    });
    if (this.t >= this.def.duration && this.frozen <= 0) this.finish();
  }

  // Jumps to the end: every beat not yet done finishes now, in order (cues
  // still fire, flagged as skipped, so numbers and Burn still land).
  skip() {
    if (this.done) return;
    this.frozen = 0;
    this.def.beats.forEach((beat, i) => {
      if (this.state[i] === 'finished') return;
      if (beat.end === undefined) this.call('fire', beat, { skipped: true });
      else {
        if (this.state[i] === 'waiting') this.call('start', beat);
        this.call('update', beat, 1);
        this.call('end', beat);
      }
      this.state[i] = 'finished';
    });
    this.t = this.def.duration;
    this.finish();
  }

  // True while a hit-stop holds the clock.
  get holding() {
    return this.frozen > 0;
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.handlers.done?.();
  }

  call(name, beat, arg) {
    this.handlers[name]?.(beat, arg);
  }
}
