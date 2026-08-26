(() => {
  const KEY = "dnf-xingyuanshi-sfx-level";
  const LEVELS = [
    { id: "off", label: "音效 关", vol: 0 },
    { id: "low", label: "音效 低", vol: 0.4 },
    { id: "on", label: "音效 开", vol: 0.88 },
  ];

  let audio = null;
  let master = null;
  let noiseBuf = null;
  const saved = localStorage.getItem(KEY);
  let level = LEVELS.findIndex((x) => x.id === saved);
  if (level < 0) level = 2;
  const loops = new Map();
  let hoverAt = 0;
  let greeting = false;
  let bgm = null;

  function vol() {
    return LEVELS[level].vol;
  }

  function alive() {
    return vol() > 0.001;
  }

  function boot() {
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audio = new AC();
      master = audio.createGain();
      master.gain.value = vol();
      master.connect(audio.destination);
      noiseBuf = makeNoise(audio, 1.2);
    }
    master.gain.setTargetAtTime(vol(), audio.currentTime, 0.02);
    if (audio.state === "suspended") audio.resume();
    return audio;
  }

  function whenReady(fn) {
    const c = boot();
    if (!c || !alive()) return;
    if (c.state === "suspended") {
      c.resume().then(() => {
        if (alive() && audio) fn();
      }).catch(() => {});
      return;
    }
    fn();
  }

  function makeNoise(c, seconds) {
    const n = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function out(node, t, attack, peak, hold, release) {
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.55), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    node.connect(g);
    g.connect(master);
    return g;
  }

  function osc(type, freq, t, dur) {
    const o = audio.createOscillator();
    o.type = type;
    if (typeof freq === "number") o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(t + dur);
    return o;
  }

  function noise(t, dur, type, freq) {
    const src = audio.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = audio.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    src.connect(f);
    src.start(t);
    src.stop(t + dur);
    return f;
  }

  function tone(type, freq, dur, peak, attack = 0.008) {
    whenReady(() => {
      const t = audio.currentTime + 0.01;
      const o = osc(type, freq, t, dur + 0.08);
      out(o, t, attack, peak, dur * 0.35, dur * 0.6);
    });
  }

  function sweep(type, from, to, dur, peak) {
    whenReady(() => {
      const t = audio.currentTime + 0.01;
      const o = osc(type, from, t, dur + 0.1);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
      out(o, t, 0.02, peak, dur * 0.4, dur * 0.45);
    });
  }

  function burst(freq, peak, hp = 1800) {
    whenReady(() => {
      const t = audio.currentTime + 0.01;
      const n = noise(t, 0.22, "highpass", hp);
      out(n, t, 0.004, peak, 0.03, 0.16);
      const o = osc("triangle", freq, t, 0.16);
      out(o, t, 0.008, peak * 0.7, 0.04, 0.1);
    });
  }

  function chord(freqs, dur, peak) {
    freqs.forEach((f, i) => tone("sine", f, dur, peak * (1 - i * 0.12), 0.02));
  }

  function at(t, freq, type, dur, peak, attack = 0.006) {
    const o = osc(type, freq, t, dur);
    out(o, t, attack, peak, dur * 0.22, dur * 0.7);
    return o;
  }

  function bellAt(t, freq, dur, peak) {
    [1, 2.005, 2.76, 4.07, 5.43].forEach((m, i) => {
      const o = osc("sine", freq * m, t, dur);
      out(o, t, 0.004, peak * (i === 0 ? 1 : 0.22 / i), 0.06, dur * 0.82);
    });
  }

  function rumbleAt(t, dur, peak, cutoff) {
    const n = noise(t, dur, "lowpass", cutoff);
    out(n, t, 0.02, peak, dur * 0.35, dur * 0.55);
  }

  function startLoop(name, factory) {
    stopLoop(name);
    whenReady(() => {
      stopLoop(name);
      loops.set(name, factory(audio, master));
    });
  }

  function stopLoop(name) {
    const h = loops.get(name);
    if (!h) return;
    try {
      h.stop();
    } catch {
      /* already gone */
    }
    loops.delete(name);
  }

  function stopAllLoops() {
    [...loops.keys()].forEach(stopLoop);
    stopBgm(true);
  }

  function bgmVolume() {
    return Math.min(1, vol() * 0.42);
  }

  function ensureBgm() {
    if (!bgm) {
      bgm = new Audio("audio/bgm.mp3");
      bgm.loop = true;
      bgm.preload = "auto";
    }
    bgm.volume = bgmVolume();
    return bgm;
  }

  function playBgm() {
    if (!alive()) return;
    const a = ensureBgm();
    a.volume = bgmVolume();
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }

  function stopBgm(reset) {
    if (!bgm) return;
    bgm.pause();
    if (reset) bgm.currentTime = 0;
  }

  const Sfx = {
    level() {
      return LEVELS[level].id;
    },
    label() {
      return LEVELS[level].label;
    },
    cycle() {
      level = (level + 1) % LEVELS.length;
      localStorage.setItem(KEY, LEVELS[level].id);
      boot();
      if (master) master.gain.setTargetAtTime(vol(), audio.currentTime, 0.05);
      if (bgm) bgm.volume = bgmVolume();
      if (!alive()) {
        stopAllLoops();
      } else {
        Sfx.click();
        Sfx.ambientStart();
      }
      return Sfx.label();
    },
    unlock() {
      whenReady(() => {
        if (alive()) Sfx.ambientStart();
        if (!greeting && alive()) {
          greeting = true;
          Sfx.click();
        }
      });
    },

    click() {
      whenReady(() => {
        const t = audio.currentTime + 0.005;
        const n = noise(t, 0.04, "bandpass", 2800);
        n.Q = n.Q || { value: 0 };
        if (n.Q) n.Q.value = 0.8;
        out(n, t, 0.001, 0.16, 0.006, 0.028);
        at(t, 180, "sine", 0.035, 0.05, 0.001);
      });
    },
    hover() {
      const now = performance.now();
      if (now - hoverAt < 70) return;
      hoverAt = now;
      whenReady(() => {
        const t = audio.currentTime + 0.005;
        const n = noise(t, 0.02, "highpass", 4200);
        out(n, t, 0.001, 0.03, 0.003, 0.012);
      });
    },
    tab() {
      whenReady(() => {
        const t = audio.currentTime + 0.005;
        const n = noise(t, 0.05, "bandpass", 1900);
        out(n, t, 0.002, 0.12, 0.01, 0.03);
        at(t, 140, "sine", 0.045, 0.045, 0.002);
      });
    },
    check() {
      whenReady(() => {
        const t = audio.currentTime + 0.005;
        const n = noise(t, 0.045, "bandpass", 2200);
        out(n, t, 0.001, 0.13, 0.008, 0.03);
        at(t, 210, "sine", 0.04, 0.04, 0.001);
      });
    },
    change() {
      whenReady(() => {
        const t = audio.currentTime + 0.005;
        const n = noise(t, 0.035, "bandpass", 1600);
        out(n, t, 0.002, 0.1, 0.008, 0.025);
      });
    },
    deny() {
      whenReady(() => {
        const t = audio.currentTime + 0.005;
        const n = noise(t, 0.12, "lowpass", 500);
        out(n, t, 0.004, 0.12, 0.03, 0.08);
        at(t, 95, "sine", 0.14, 0.08, 0.004);
      });
    },
    selectTarget() {
      burst(520, 0.1, 900);
      tone("sine", 660, 0.14, 0.08);
    },
    selectMat() {
      burst(440, 0.1, 800);
      tone("sine", 520, 0.14, 0.08);
    },
    unslot() {
      sweep("sine", 500, 260, 0.14, 0.06);
    },
    drop() {
      burst(280, 0.14, 400);
      tone("triangle", 320, 0.16, 0.1);
      tone("sine", 640, 0.1, 0.05);
    },
    drag() {
      whenReady(() => {
        const t = audio.currentTime + 0.01;
        const n = noise(t, 0.16, "bandpass", 1400);
        out(n, t, 0.01, 0.08, 0.04, 0.1);
      });
    },
    craft() {
      chord([523, 659, 784], 0.28, 0.09);
    },
    batch() {
      [0, 0.05, 0.1, 0.16, 0.22].forEach((d, i) => {
        setTimeout(() => tone("triangle", 480 + i * 90, 0.08, 0.07), d * 1000);
      });
    },
    decompose() {
      whenReady(() => {
        const t = audio.currentTime + 0.01;
        const n = noise(t, 0.28, "highpass", 700);
        out(n, t, 0.004, 0.16, 0.04, 0.2);
      });
      sweep("sawtooth", 240, 80, 0.22, 0.1);
    },
    clear() {
      sweep("sine", 700, 180, 0.28, 0.08);
      burst(160, 0.08, 300);
    },
    lock() {
      tone("square", 480, 0.05, 0.07);
      tone("sine", 720, 0.12, 0.06);
    },
    skip() {
      sweep("triangle", 900, 400, 0.1, 0.06);
    },
    calc() {
      chord([392, 523, 659], 0.22, 0.07);
    },
    sim() {
      sweep("sine", 300, 880, 0.35, 0.08);
      setTimeout(() => chord([523, 659, 784, 1046], 0.32, 0.07), 280);
    },
    wash() {
      whenReady(() => {
        const t = audio.currentTime + 0.01;
        const n = noise(t, 0.45, "bandpass", 2400);
        out(n, t, 0.02, 0.14, 0.12, 0.28);
      });
      sweep("sine", 420, 880, 0.28, 0.12);
      tone("triangle", 1180, 0.18, 0.08);
    },
    fuseStart() {
      sweep("sine", 160, 480, 0.45, 0.1);
      tone("triangle", 240, 0.3, 0.06);
      Sfx.reelStart();
    },
    reelStart() {
      startLoop("reel", (c, dest) => {
        const src = c.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        const f = c.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 1600;
        f.Q.value = 0.7;
        const g = c.createGain();
        g.gain.value = 0.045;
        src.connect(f);
        f.connect(g);
        g.connect(dest);
        src.start();
        const tick = setInterval(() => {
          if (!alive()) return;
          const now = c.currentTime;
          const o = c.createOscillator();
          o.type = "square";
          o.frequency.value = 680 + Math.random() * 220;
          const tg = c.createGain();
          tg.gain.setValueAtTime(0.035, now);
          tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
          o.connect(tg);
          tg.connect(dest);
          o.start(now);
          o.stop(now + 0.06);
        }, 70);
        return {
          stop() {
            clearInterval(tick);
            src.stop();
          },
        };
      });
    },
    reelStop() {
      stopLoop("reel");
    },
    reelLock(affix) {
      const map = {
        common: 320,
        advanced: 380,
        rare: 460,
        artifact: 540,
        epic: 660,
        transcendent: 780,
        origin: 920,
      };
      const f = map[affix && affix.rarity] || 500;
      burst(f, 0.13, 1200);
      tone("triangle", f, 0.16, 0.1);
      if (affix && affix.typeId === "skillAtk") tone("sine", f * 1.5, 0.18, 0.07);
      if (affix && affix.crown) chord([f, f * 1.25, f * 1.5], 0.2, 0.06);
    },
    fuseDone(stone) {
      Sfx.reelStop();
      chord([392, 523, 659, 784], 0.42, 0.1);
      if (stone && stone.treasure) setTimeout(() => chord([523, 659, 784], 0.28, 0.08), 160);
    },
    seal() {
      whenReady(() => {
        const t0 = audio.currentTime + 0.01;
        rumbleAt(t0, 0.55, 0.12, 280);
        at(t0, 98, "sine", 1.15, 0.22, 0.01);
        at(t0, 147, "sine", 1.05, 0.16, 0.012);
        at(t0, 196, "triangle", 0.7, 0.1, 0.01);
        const shimmer = noise(t0, 0.9, "highpass", 3200);
        out(shimmer, t0, 0.02, 0.09, 0.18, 0.65);
        bellAt(t0 + 0.06, 523.25, 1.05, 0.2);
        bellAt(t0 + 0.14, 659.25, 0.95, 0.14);
        bellAt(t0 + 0.22, 783.99, 0.9, 0.12);
        at(t0 + 0.28, 392, "sine", 0.85, 0.12);
        at(t0 + 0.36, 1046.5, "sine", 0.55, 0.1);
        const rise = osc("sine", 420, t0 + 0.2, 0.55);
        rise.frequency.exponentialRampToValueAtTime(1320, t0 + 0.72);
        out(rise, t0 + 0.2, 0.03, 0.1, 0.2, 0.28);
        bellAt(t0 + 0.52, 784, 0.7, 0.16);
        bellAt(t0 + 0.6, 1174.7, 0.75, 0.14);
        at(t0 + 0.68, 1568, "sine", 0.45, 0.08);
        const spark = noise(t0 + 0.5, 0.4, "bandpass", 4800);
        out(spark, t0 + 0.5, 0.01, 0.08, 0.08, 0.28);
      });
    },
    hammerStart() {
      burst(140, 0.16, 200);
      sweep("sawtooth", 120, 90, 0.18, 0.08);
      Sfx.reelStart();
    },
    hammerLock(steps, rarity) {
      burst(180, 0.16, 250);
      tone("triangle", 220, 0.1, 0.1);
      if (steps >= 1) {
        const f = rarity === "origin" ? 880 : steps >= 2 ? 740 : 620;
        setTimeout(() => {
          chord(steps >= 2 ? [f, f * 1.25, f * 1.5] : [f, f * 1.26], 0.24, 0.1);
        }, 40);
      }
    },
    originGod() {
      Sfx.reelStop();
      whenReady(() => {
        const t0 = audio.currentTime + 0.01;
        rumbleAt(t0, 3.1, 0.2, 180);
        at(t0, 46, "sine", 2.8, 0.24, 0.04);
        at(t0, 69, "sine", 2.4, 0.14, 0.05);
        const tension = osc("sawtooth", 90, t0, 1.7);
        tension.frequency.exponentialRampToValueAtTime(220, t0 + 1.55);
        const tf = audio.createBiquadFilter();
        tf.type = "lowpass";
        tf.frequency.setValueAtTime(320, t0);
        tf.frequency.exponentialRampToValueAtTime(2600, t0 + 1.5);
        tension.connect(tf);
        out(tf, t0, 0.08, 0.12, 1.1, 0.45);

        const hits = [
          { at: 0.22, f: 110, p: 0.22 },
          { at: 0.58, f: 147, p: 0.26 },
          { at: 0.98, f: 196, p: 0.3 },
          { at: 1.42, f: 262, p: 0.36 },
        ];
        hits.forEach((h, i) => {
          const t = t0 + h.at;
          rumbleAt(t, 0.35, 0.16 + i * 0.03, 400);
          at(t, h.f, "sine", 0.55, h.p, 0.004);
          at(t, h.f * 1.5, "triangle", 0.28, h.p * 0.45, 0.004);
          const crack = noise(t, 0.18, "highpass", 900 + i * 400);
          out(crack, t, 0.002, 0.14, 0.03, 0.14);
          const brass = osc("sawtooth", h.f * 2, t, 0.32);
          const bf = audio.createBiquadFilter();
          bf.type = "lowpass";
          bf.frequency.setValueAtTime(500, t);
          bf.frequency.exponentialRampToValueAtTime(2200, t + 0.1);
          brass.connect(bf);
          out(bf, t, 0.006, 0.1 + i * 0.02, 0.06, 0.22);
        });

        const boom = t0 + 1.72;
        rumbleAt(boom, 1.4, 0.22, 240);
        ;[130.8, 164.8, 196, 261.6, 329.6, 392, 523.3].forEach((f, i) => {
          at(boom + i * 0.03, f, i < 3 ? "sine" : "triangle", 1.35, 0.16 - i * 0.012, 0.02);
        });
        const scream = osc("sawtooth", 180, boom, 1.2);
        scream.frequency.exponentialRampToValueAtTime(720, boom + 0.85);
        const sf = audio.createBiquadFilter();
        sf.type = "lowpass";
        sf.frequency.setValueAtTime(700, boom);
        sf.frequency.exponentialRampToValueAtTime(4200, boom + 0.7);
        scream.connect(sf);
        out(sf, boom, 0.04, 0.12, 0.45, 0.65);
        const rain = noise(boom + 0.15, 1.3, "highpass", 3600);
        out(rain, boom + 0.15, 0.05, 0.1, 0.4, 0.8);
        bellAt(boom + 0.2, 523.3, 1.4, 0.16);
        bellAt(boom + 0.32, 784, 1.2, 0.12);
        at(boom + 0.85, 1046.5, "sine", 0.9, 0.1);
      });
    },
    ambientStart() {
      playBgm();
    },
    ambientStop() {
      stopBgm(false);
    },
  };

  window.Sfx = Sfx;
})();
