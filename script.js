class StepSequencer {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.isPlaying = false;
        this.currentStep = 0;
        this.tempo = 120;
        this.stepInterval = null;
        this.lastStepTime = 0;
        
        // Create master gain node
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.audioContext.destination);
        
        // Initialize tracks
        this.tracks = {
            kick: { steps: [0, 0, 0, 0, 0, 0, 0, 0], volume: 0.8, gainNode: null },
            snare: { steps: [0, 0, 0, 0, 0, 0, 0, 0], volume: 0.7, gainNode: null },
            bass: { steps: [0, 0, 0, 0, 0, 0, 0, 0], volume: 0.7, gainNode: null },
            chord: { steps: [0, 0, 0, 0, 0, 0, 0, 0], volume: 0.6, gainNode: null }
        };
        
        // Initialize FX
        this.fx = {
            lowpass: { active: false, node: null },
            highpass: { active: false, node: null },
            distortion: { active: false, node: null },
            delay: { active: false, node: null, feedback: null },
            reverb: { active: false, node: null, convolver: null },
            pitch: { active: false, node: null },
            chorus: { active: false, node: null },
            mute: { active: false }
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.createAudioNodes();
        this.loadReverbImpulseResponse();
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
            if (this.isPlaying) {
                this.stop();
                this.start();
            }
        });
        
        // Step buttons
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', (e) => {
                const trackId = e.target.closest('.track').id.split('-')[0];
                const stepIndex = parseInt(e.target.getAttribute('data-step'));
                this.toggleStep(trackId, stepIndex);
                e.target.classList.toggle('on');
            });
        });
        
        // Volume sliders
        document.querySelectorAll('.volume').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const trackId = e.target.closest('.track').id.split('-')[0];
                const volume = parseFloat(e.target.value);
                this.setTrackVolume(trackId, volume);
            });
        });
        
        // FX buttons
        document.querySelectorAll('.fx-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fxType = e.target.getAttribute('data-fx');
                this.toggleFX(fxType);
                e.target.classList.toggle('active');
            });
        });
    }
    
    createAudioNodes() {
        // Create gain nodes for each track
        for (const track in this.tracks) {
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = this.tracks[track].volume;
            gainNode.connect(this.masterGain);
            this.tracks[track].gainNode = gainNode;
        }
        
        // Create FX nodes
        this.fx.lowpass.node = this.audioContext.createBiquadFilter();
        this.fx.lowpass.node.type = 'lowpass';
        this.fx.lowpass.node.frequency.value = 1000;
        
        this.fx.highpass.node = this.audioContext.createBiquadFilter();
        this.fx.highpass.node.type = 'highpass';
        this.fx.highpass.node.frequency.value = 500;
        
        this.fx.distortion.node = this.audioContext.createWaveShaper();
        this.fx.distortion.node.curve = this.makeDistortionCurve(400);
        this.fx.distortion.node.oversample = '4x';
        
        this.fx.delay.node = this.audioContext.createDelay();
        this.fx.delay.node.delayTime.value = 0.25;
        this.fx.delay.feedback = this.audioContext.createGain();
        this.fx.delay.feedback.gain.value = 0.5;
        
        this.fx.reverb.node = this.audioContext.createConvolver();
        
        this.fx.pitch.node = this.audioContext.createBiquadFilter();
        // Pitch shift using filter frequency as a simple approach
        // A real implementation would use a different technique
        
        this.fx.chorus.node = this.audioContext.createStereoPanner();
        this.fx.chorus.node.pan.value = 0;
        
        // Connect FX in chain
        this.setupFXChain();
    }
    
    setupFXChain() {
        // Start with master gain
        let lastNode = this.masterGain;
        
        // Connect FX in the desired order
        const fxOrder = ['lowpass', 'highpass', 'distortion', 'delay', 'reverb', 'pitch', 'chorus'];
        
        for (const fxType of fxOrder) {
            if (this.fx[fxType].node) {
                lastNode.connect(this.fx[fxType].node);
                lastNode = this.fx[fxType].node;
            }
        }
        
        // Connect the last FX node to the destination
        lastNode.connect(this.audioContext.destination);
        
        // Set up delay feedback loop
        if (this.fx.delay.node && this.fx.delay.feedback) {
            this.fx.delay.node.connect(this.fx.delay.feedback);
            this.fx.delay.feedback.connect(this.fx.delay.node);
        }
    }
    
    toggleFX(fxType) {
        this.fx[fxType].active = !this.fx[fxType].active;
        
        if (fxType === 'mute') {
            this.masterGain.gain.value = this.fx.mute.active ? 0 : 0.8;
            return;
        }
        
        if (this.fx[fxType].node) {
            if (this.fx[fxType].active) {
                // Connect the node into the signal chain
                this.connectFXNode(fxType);
            } else {
                // Bypass the node
                this.bypassFXNode(fxType);
            }
        }
    }
    
    connectFXNode(fxType) {
        // Implementation would connect the FX node properly
        // This is a simplified version
        console.log(`Connecting ${fxType} FX`);
    }
    
    bypassFXNode(fxType) {
        // Implementation would bypass the FX node
        // This is a simplified version
        console.log(`Bypassing ${fxType} FX`);
    }
    
    loadReverbImpulseResponse() {
        // Create a simple impulse response for reverb
        const sampleRate = this.audioContext.sampleRate;
        const length = 2 * sampleRate;
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);
        
        for (let i = 0; i < length; i++) {
            left[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.5));
            right[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.5));
        }
        
        this.fx.reverb.node.buffer = impulse;
    }
    
    makeDistortionCurve(amount) {
        const samples = 256;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((Math.PI + amount) * x) / (Math.PI + (amount * Math.abs(x)));
        }
        return curve;
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
        this.lastStepTime = this.audioContext.currentTime;
        this.scheduleSteps();
    }
    
    stop() {
        this.isPlaying = false;
        if (this.stepInterval) {
            clearTimeout(this.stepInterval);
            this.stepInterval = null;
        }
        
        // Remove active class from all steps
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });
    }
    
    scheduleSteps() {
        if (!this.isPlaying) return;
        
        const now = this.audioContext.currentTime;
        const stepDuration = 60 / this.tempo / 4; // 16th notes
        
        // Schedule next step
        this.stepInterval = setTimeout(() => {
            this.scheduleSteps();
        }, stepDuration * 1000);
        
        // Play current step
        this.playStep(this.currentStep);
        
        // Update UI
        this.updateStepUI(this.currentStep);
        
        // Move to next step
        this.currentStep = (this.currentStep + 1) % 8;
        this.lastStepTime = now;
    }
    
    playStep(stepIndex) {
        for (const track in this.tracks) {
            if (this.tracks[track].steps[stepIndex]) {
                this.playSound(track);
            }
        }
    }
    
    playSound(track) {
        const now = this.audioContext.currentTime;
        const gainNode = this.tracks[track].gainNode;
        
        switch(track) {
            case 'kick':
                this.playKick(now, gainNode);
                break;
            case 'snare':
                this.playSnare(now, gainNode);
                break;
            case 'bass':
                this.playBass(now, gainNode);
                break;
            case 'chord':
                this.playChord(now, gainNode);
                break;
        }
    }
    
    playKick(time, output) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);
        
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
        
        osc.connect(gain);
        gain.connect(output);
        osc.start(time);
        osc.stop(time + 0.5);
    }
    
    playSnare(time, output) {
        const noise = this.audioContext.createBufferSource();
        const noiseBuffer = this.createNoiseBuffer(0.1);
        const filter = this.audioContext.createBiquadFilter();
        const gain = this.audioContext.createGain();
        
        noise.buffer = noiseBuffer;
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(output);
        noise.start(time);
        noise.stop(time + 0.2);
    }
    
    playBass(time, output) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, time);
        
        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        
        osc.connect(gain);
        gain.connect(output);
        osc.start(time);
        osc.stop(time + 0.3);
    }
    
    playChord(time, output) {
        const notes = [262, 330, 392]; // C4, E4, G4
        const duration = 0.5;
        
        notes.forEach(freq => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);
            
            gain.gain.setValueAtTime(0.3, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            
            osc.connect(gain);
            gain.connect(output);
            osc.start(time);
            osc.stop(time + duration);
        });
    }
    
    createNoiseBuffer(length) {
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * length, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        return buffer;
    }
    
    updateStepUI(stepIndex) {
        // Remove active class from all steps
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });
        
        // Add active class to current step
        document.querySelectorAll(`.step[data-step="${stepIndex}"]`).forEach(step => {
            step.classList.add('active');
        });
    }
    
    toggleStep(trackId, stepIndex) {
        this.tracks[trackId].steps[stepIndex] = this.tracks[trackId].steps[stepIndex] ? 0 : 1;
    }
    
    setTrackVolume(trackId, volume) {
        this.tracks[trackId].volume = volume;
        this.tracks[trackId].gainNode.gain.value = volume;
    }
}

// Initialize the sequencer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const sequencer = new StepSequencer();
    
    // Pre-activate some steps for demo purposes
    setTimeout(() => {
        document.querySelectorAll('#kick-track .step[data-step="0"]').forEach(step => step.click());
        document.querySelectorAll('#kick-track .step[data-step="4"]').forEach(step => step.click());
        document.querySelectorAll('#snare-track .step[data-step="4"]').forEach(step => step.click());
        document.querySelectorAll('#bass-track .step[data-step="0"]').forEach(step => step.click());
        document.querySelectorAll('#bass-track .step[data-step="2"]').forEach(step => step.click());
        document.querySelectorAll('#bass-track .step[data-step="4"]').forEach(step => step.click());
        document.querySelectorAll('#bass-track .step[data-step="6"]').forEach(step => step.click());
        document.querySelectorAll('#chord-track .step[data-step="0"]').forEach(step => step.click());
        document.querySelectorAll('#chord-track .step[data-step="7"]').forEach(step => step.click());
    }, 100);
});

