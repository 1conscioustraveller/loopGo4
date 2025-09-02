class StepSequencer {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.currentStep = 0;
        this.tempo = 120;
        this.nextStepTime = 0;
        this.scheduleAheadTime = 0.1;
        this.lookahead = 25;
        this.stepInterval = null;
        
        this.instruments = {
            kick: null,
            snare: null,
            bass: null,
            chord: null
        };
        
        this.fx = {
            lowpass: false,
            highpass: false,
            distortion: false,
            delay: false,
            reverb: false,
            pitch: false,
            chorus: false,
            mute: false
        };
        
        this.fxNodes = {};
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initAudioContext();
        this.createInstruments();
        this.createFXNodes();
    }
    
    setupEventListeners() {
        // Play/Stop button
        document.getElementById('playStop').addEventListener('click', () => {
            this.togglePlayback();
        });
        
        // Tempo slider
        const tempoSlider = document.getElementById('tempo');
        const tempoValue = document.getElementById('tempoValue');
        tempoSlider.addEventListener('input', (e) => {
            this.tempo = parseInt(e.target.value);
            tempoValue.textContent = this.tempo;
        });
        
        // Step buttons
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', (e) => {
                e.target.classList.toggle('on');
            });
        });
        
        // Volume sliders
        document.querySelectorAll('.volume').forEach((slider, index) => {
            const track = Object.keys(this.instruments)[index];
            slider.addEventListener('input', (e) => {
                if (this.instruments[track] && this.instruments[track].gain) {
                    this.instruments[track].gain.gain.value = parseFloat(e.target.value);
                }
            });
        });
        
        // FX buttons
        document.querySelectorAll('.fx-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fx = e.target.dataset.fx;
                this.fx[fx] = !this.fx[fx];
                e.target.classList.toggle('active');
                this.updateFX();
            });
        });
    }
    
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            alert('Web Audio API is not supported in this browser');
        }
    }
    
    createInstruments() {
        // Kick drum
        this.instruments.kick = {
            steps: document.querySelectorAll('#kick-track .step'),
            gain: this.audioContext.createGain(),
            play: () => {
                const oscillator = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
                
                gain.gain.setValueAtTime(1, this.audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
                
                oscillator.connect(gain);
                gain.connect(this.instruments.kick.gain);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.5);
            }
        };
        
        // Snare drum
        this.instruments.snare = {
            steps: document.querySelectorAll('#snare-track .step'),
            gain: this.audioContext.createGain(),
            play: () => {
                const noise = this.audioContext.createBufferSource();
                const noiseFilter = this.audioContext.createBiquadFilter();
                const oscillator = this.audioContext.createOscillator();
                const noiseGain = this.audioContext.createGain();
                const oscGain = this.audioContext.createGain();
                
                // Create noise buffer
                const bufferSize = this.audioContext.sampleRate;
                const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                
                noise.buffer = buffer;
                noiseFilter.type = 'highpass';
                noiseFilter.frequency.value = 1000;
                
                oscillator.type = 'triangle';
                oscillator.frequency.value = 150;
                
                noiseGain.gain.setValueAtTime(1, this.audioContext.currentTime);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                
                oscGain.gain.setValueAtTime(0.7, this.audioContext.currentTime);
                oscGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                
                noise.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(this.instruments.snare.gain);
                
                oscillator.connect(oscGain);
                oscGain.connect(this.instruments.snare.gain);
                
                noise.start();
                oscillator.start();
                noise.stop(this.audioContext.currentTime + 0.2);
                oscillator.stop(this.audioContext.currentTime + 0.2);
            }
        };
        
        // Bass
        this.instruments.bass = {
            steps: document.querySelectorAll('#bass-track .step'),
            gain: this.audioContext.createGain(),
            play: () => {
                const oscillator = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(110, this.audioContext.currentTime);
                
                gain.gain.setValueAtTime(0.7, this.audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                
                oscillator.connect(gain);
                gain.connect(this.instruments.bass.gain);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.3);
            }
        };
        
        // Chord
        this.instruments.chord = {
            steps: document.querySelectorAll('#chord-track .step'),
            gain: this.audioContext.createGain(),
            play: () => {
                const frequencies = [261.63, 329.63, 392.00]; // C, E, G
                
                frequencies.forEach(freq => {
                    const oscillator = this.audioContext.createOscillator();
                    const gain = this.audioContext.createGain();
                    
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                    
                    gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
                    
                    oscillator.connect(gain);
                    gain.connect(this.instruments.chord.gain);
                    
                    oscillator.start();
                    oscillator.stop(this.audioContext.currentTime + 0.5);
                });
            }
        };
        
        // Connect all instruments to the master output
        Object.values(this.instruments).forEach(instrument => {
            instrument.gain.gain.value = 0.7;
            instrument.gain.connect(this.audioContext.destination);
        });
    }
    
    createFXNodes() {
        // Lowpass filter
        this.fxNodes.lowpass = this.audioContext.createBiquadFilter();
        this.fxNodes.lowpass.type = 'lowpass';
        this.fxNodes.lowpass.frequency.value = 1000;
        
        // Highpass filter
        this.fxNodes.highpass = this.audioContext.createBiquadFilter();
        this.fxNodes.highpass.type = 'highpass';
        this.fxNodes.highpass.frequency.value = 500;
        
        // Distortion
        this.fxNodes.distortion = this.audioContext.createWaveShaper();
        this.fxNodes.distortion.curve = this.makeDistortionCurve(400);
        this.fxNodes.distortion.oversample = '4x';
        
        // Delay
        this.fxNodes.delay = this.audioContext.createDelay();
        this.fxNodes.delay.delayTime.value = 0.25;
        this.fxNodes.delayGain = this.audioContext.createGain();
        this.fxNodes.delayGain.gain.value = 0.5;
        this.fxNodes.delay.connect(this.fxNodes.delayGain);
        this.fxNodes.delayGain.connect(this.fxNodes.delay);
        
        // Reverb (convolution)
        this.fxNodes.reverb = this.audioContext.createConvolver();
        this.createReverbBuffer();
        
        // Pitch shift (using delay trick)
        this.fxNodes.pitch = this.audioContext.createDelay();
        this.fxNodes.pitch.delayTime.value = 0.01;
        
        // Chorus
        this.fxNodes.chorus = this.audioContext.createChorus();
        
        // Mute is handled differently - it's just a gain node at 0
        this.fxNodes.mute = this.audioContext.createGain();
        this.fxNodes.mute.gain.value = 1;
        
        // Set up initial routing
        this.updateFX();
    }
    
    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < n_samples; i++) {
            const x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }
    
    createReverbBuffer() {
        const length = this.audioContext.sampleRate * 2;
        const buffer = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
        const dataL = buffer.getChannelData(0);
        const dataR = buffer.getChannelData(1);
        
        for (let i = 0; i < length; i++) {
            dataL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 1);
            dataR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 1);
        }
        
        this.fxNodes.reverb.buffer = buffer;
    }
    
    updateFX() {
        // Disconnect all instruments from current routing
        Object.values(this.instruments).forEach(instrument => {
            instrument.gain.disconnect();
        });
        
        // Build the FX chain based on active effects
        let lastNode = null;
        const fxChain = [];
        
        // Define the order of FX in the chain
        const fxOrder = ['lowpass', 'highpass', 'distortion', 'delay', 'reverb', 'pitch', 'chorus', 'mute'];
        
        // Add active FX to the chain in order
        fxOrder.forEach(fx => {
            if (this.fx[fx]) {
                fxChain.push(this.fxNodes[fx]);
            }
        });
        
        // Connect instruments through the FX chain
        Object.values(this.instruments).forEach(instrument => {
            if (fxChain.length > 0) {
                instrument.gain.connect(fxChain[0]);
                
                for (let i = 0; i < fxChain.length - 1; i++) {
                    fxChain[i].connect(fxChain[i + 1]);
                }
                
                fxChain[fxChain.length - 1].connect(this.audioContext.destination);
            } else {
                // No FX, connect directly to output
                instrument.gain.connect(this.audioContext.destination);
            }
        });
        
        // Handle mute separately as it should be the last node
        if (this.fx.mute) {
            this.fxNodes.mute.gain.value = 0;
        } else {
            this.fxNodes.mute.gain.value = 1;
        }
    }
    
    togglePlayback() {
        if (this.isPlaying) {
            this.stop();
            document.getElementById('playStop').textContent = 'Play';
        } else {
            this.start();
            document.getElementById('playStop').textContent = 'Stop';
        }
    }
    
    start() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isPlaying = true;
        this.currentStep = 0;
        this.nextStepTime = this.audioContext.currentTime;
        
        this.stepInterval = setInterval(() => {
            this.scheduler();
        }, this.lookahead);
    }
    
    stop() {
        this.isPlaying = false;
        clearInterval(this.stepInterval);
        
        // Remove active step highlighting
        document.querySelectorAll('.step.active').forEach(step => {
            step.classList.remove('active');
        });
    }
    
    scheduler() {
        while (this.nextStepTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleStep(this.currentStep);
            this.nextStep();
        }
    }
    
    scheduleStep(step) {
        // Play each instrument if its step is active
        Object.values(this.instruments).forEach(instrument => {
            if (instrument.steps[step].classList.contains('on')) {
                instrument.play();
            }
        });
        
        // Highlight the current step
        document.querySelectorAll('.step.active').forEach(step => {
            step.classList.remove('active');
        });
        
        document.querySelectorAll(`.step[data-step="${step}"]`).forEach(step => {
            step.classList.add('active');
        });
    }
    
    nextStep() {
        const secondsPerStep = 60.0 / this.tempo / 2; // 8th notes at given BPM
        
        this.nextStepTime += secondsPerStep;
        this.currentStep = (this.currentStep + 1) % 8;
    }
}

// Initialize the sequencer when the page loads
window.addEventListener('load', () => {
    const sequencer = new StepSequencer();
});
