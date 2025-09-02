// script.js
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const tempoInput = document.getElementById("tempo");
let tempo = parseInt(tempoInput.value, 10);
let currentStep = 0;
let isPlaying = false;
let intervalId;

// === Sequencers Setup ===
const sequencers = {
  kick: { steps: [], buffer: null, fx: {} },
  snare: { steps: [], buffer: null, fx: {} },
  bass: { steps: [], buffer: null, fx: {} },
  chords: { steps: [], buffer: null, fx: {} },
};

// Sample files
const samples = {
  kick: "assets/kick.wav",
  snare: "assets/snare.wav",
  bass: "assets/bass.wav",
  chords: "assets/chords.wav",
};

// Load samples
async function loadSample(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await audioCtx.decodeAudioData(arrayBuffer);
}

async function init() {
  for (let [key, url] of Object.entries(samples)) {
    sequencers[key].buffer = await loadSample(url);
    sequencers[key].steps = new Array(8).fill(false);
  }
}
init();

// === FX Factory ===
function createEffect(ctx, type) {
  const input = ctx.createGain();
  const output = ctx.createGain();

  switch (type) {
    case "tremolo": {
      const depth = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 5; // tremolo rate
      depth.gain.value = 0.5; // depth of modulation
      lfo.connect(depth).connect(input.gain);
      lfo.start();
      input.connect(output);
      break;
    }

    case "flanger": {
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.005;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      depth.gain.value = 0.002;
      lfo.frequency.value = 0.25;
      lfo.connect(depth).connect(delay.delayTime);
      lfo.start();
      input.connect(delay).connect(output);
      input.connect(output); // dry signal
      break;
    }

    case "phaser": {
      const allpassFilters = [];
      for (let i = 0; i < 4; i++) {
        const allpass = ctx.createBiquadFilter();
        allpass.type = "allpass";
        allpass.frequency.value = 400 * (i + 1);
        allpassFilters.push(allpass);
      }
      // chain filters
      allpassFilters.reduce((prev, curr) => {
        prev.connect(curr);
        return curr;
      });
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      depth.gain.value = 500;
      lfo.frequency.value = 0.5;
      lfo.connect(depth).connect(allpassFilters[0].frequency);
      lfo.start();
      input.connect(allpassFilters[0]).connect(output);
      input.connect(output); // dry path
      break;
    }

    case "bandpass": {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1000;
      input.connect(filter).connect(output);
      break;
    }

    case "stereoPanner": {
      const panner = ctx.createStereoPanner();
      panner.pan.value = 0.5;
      input.connect(panner).connect(output);
      break;
    }

    case "ringMod": {
      const ringGain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 30;
      osc.connect(ringGain.gain);
      osc.start();
      input.connect(ringGain).connect(output);
      break;
    }

    case "reverb": {
      const convolver = ctx.createConvolver();
      // simple impulse response
      const length = ctx.sampleRate * 3;
      const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let ch = 0; ch < impulse.numberOfChannels; ch++) {
        const channelData = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
      }
      convolver.buffer = impulse;
      input.connect(convolver).connect(output);
      input.connect(output); // dry
      break;
    }

    case "pitchShift": {
      // placeholder: pitch shift is complex; for demo, use detune filter
      const shifter = ctx.createBiquadFilter();
      shifter.type = "highshelf";
      shifter.frequency.value = 1000;
      shifter.gain.value = 10;
      input.connect(shifter).connect(output);
      break;
    }

    default:
      input.connect(output);
  }

  return { input, output };
}

// === Playback ===
function playStep() {
  for (let [name, seq] of Object.entries(sequencers)) {
    if (seq.steps[currentStep]) {
      const source = audioCtx.createBufferSource();
      source.buffer = seq.buffer;

      // Build FX chain for this sequencer
      let node = source;
      for (let [fxName, isActive] of Object.entries(seq.fx)) {
        if (isActive) {
          const effect = createEffect(audioCtx, fxName);
          node.connect(effect.input);
          node = effect.output;
        }
      }
      node.connect(audioCtx.destination);

      source.start();
    }
  }

  // update UI
  document.querySelectorAll(".step").forEach((el, idx) => {
    if (idx % 8 === currentStep) el.classList.add("playing");
    else el.classList.remove("playing");
  });

  currentStep = (currentStep + 1) % 8;
}

function startSequencer() {
  if (!isPlaying) {
    isPlaying = true;
    const interval = (60 / tempo) * 1000 / 2;
    intervalId = setInterval(playStep, interval);
  }
}

function stopSequencer() {
  isPlaying = false;
  clearInterval(intervalId);
}

tempoInput.addEventListener("change", () => {
  tempo = parseInt(tempoInput.value, 10);
  if (isPlaying) {
    stopSequencer();
    startSequencer();
  }
});

// === UI Bindings ===
// Toggle step
document.querySelectorAll(".step").forEach((step, idx) => {
  step.addEventListener("click", () => {
    const seqName = step.closest(".sequencer").dataset.seq;
    const seq = sequencers[seqName];
    seq.steps[idx % 8] = !seq.steps[idx % 8];
    step.classList.toggle("active");
  });
});

// Controls
document.getElementById("startBtn").addEventListener("click", () => {
  audioCtx.resume();
  startSequencer();
});
document.getElementById("stopBtn").addEventListener("click", stopSequencer);

// FX toggles
document.querySelectorAll(".fx-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const seqName = btn.closest(".sequencer").dataset.seq;
    const fxName = btn.dataset.fx;
    sequencers[seqName].fx[fxName] = !sequencers[seqName].fx[fxName];
    btn.classList.toggle("active");
  });
});
