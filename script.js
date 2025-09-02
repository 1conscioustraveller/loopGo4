document.addEventListener('DOMContentLoaded', function() {
    // Audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Global nodes
    let masterGain;
    let fxNodes = {};
    let isPlaying = false;
    let currentStep = 0;
    let noteInterval;
    let tempo = 120;
    
    // Initialize audio graph
    function initAudio() {
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.8;
        masterGain.connect(audioContext.destination);
        
        // Create FX nodes but don't connect them yet
        createFXNodes();
    }
    
    // Create all FX nodes
    function createFXNodes() {
        // Lowpass filter
        fxNodes.lowpass = audioContext.createBiquadFilter();
        fxNodes.lowpass.type = 'lowpass';
        fxNodes.lowpass.frequency.value = 1000;
        
        // Highpass filter
        fxNodes.highpass = audioContext.createBiquadFilter();
        fxNodes.highpass.type = 'highpass';
        fxNodes.highpass.frequency.value = 500;
        
        // Distortion
        fxNodes.distortion = audioContext.createWaveShaper();
        fxNodes.distortion.curve = makeDistortionCurve(400);
        fxNodes.distortion.oversample = '4x';
        
        // Delay
        fxNodes.delay = audioContext.createDelay();
        fxNodes.delay.delayTime.value = 0.3;
        fxNodes.delayFeedback = audioContext.createGain();
        fxNodes.delayFeedback.gain.value = 0.5;
        
        // Reverb (using convolution)
        fxNodes.reverb = audioContext.createConvolver();
        // Create an impulse response for reverb
        createReverb();
        
        // Pitch shift (using oscillator)
        fxNodes.pitch = audioContext.createOscillator();
        fxNodes.pitch.type = 'sawtooth';
        fxNodes.pitch.frequency.value = 0;
        fxNodes.pitch.start();
        
        // Chorus (using oscillator and delay)
        fxNodes.chorus = audioContext.createOscillator();
        fxNodes.chorus.type = 'sine';
        fxNodes.chorus.frequency.value = 2;
        fxNodes.chorus.start();
        fxNodes.chorusDepth = audioContext.createGain();
        fxNodes.chorusDepth.gain.value = 0.005;
        fxNodes.chorusDelay = audioContext.createDelay();
        fxNodes.chorusDelay.delayTime.value = 0.02;
        
        // Mute (just a gain node)
        fxNodes.mute = audioContext.createGain();
        fxNodes.mute.gain.value = 1;
    }
    
    // Create a simple impulse response for reverb
    function createReverb() {
        const length = 2 * audioContext.sampleRate;
        const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);
        
        for (let i = 0; i < length; i++) {
            left[i] = (Math.random() * 2 - 1) * Math.exp(-i / (0.5 * audioContext.sampleRate));
            right[i] = (Math.random() * 2 - 1) * Math.exp(-i / (0.5 * audioContext.sampleRate));
        }
        
        fxNodes.reverb.buffer = impulse;
    }
    
    // Create distortion curve
    function makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
        }
        
        return curve;
    }
    
    // Sound generators
    function createKick() {
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        
        // Apply track volume
        const trackVolume = audioContext.createGain();
        trackVolume.gain.value = document.querySelector('#kick-track .volume-slider').value;
        
        // Apply FX
        applyFX(trackVolume);
        
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
        gain.gain.setValueAtTime(1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
        
        oscillator.connect(gain);
        gain.connect(trackVolume);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    }
    
    function createSnare() {
        const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.5, audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < output.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const noiseFilter = audioContext.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        
        const noiseEnvelope = audioContext.createGain();
        noiseEnvelope.gain.value = 0;
        
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 100;
        
        const oscillatorEnvelope = audioContext.createGain();
        oscillatorEnvelope.gain.value = 0;
        
        // Apply track volume
        const trackVolume = audioContext.createGain();
        trackVolume.gain.value = document.querySelector('#snare-track .volume-slider').value;
        
        // Apply FX
        applyFX(trackVolume);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseEnvelope);
        noiseEnvelope.connect(trackVolume);
        
        oscillator.connect(oscillatorEnvelope);
        oscillatorEnvelope.connect(trackVolume);
        
        noiseEnvelope.gain.setValueAtTime(1, audioContext.currentTime);
        noiseEnvelope.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillatorEnvelope.gain.setValueAtTime(0.7, audioContext.currentTime);
        oscillatorEnvelope.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        noise.start();
        noise.stop(audioContext.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    }
    
    function createBass() {
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 55;
        
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        
        // Apply track volume
        const trackVolume = audioContext.createGain();
        trackVolume.gain.value = document.querySelector('#bass-track .volume-slider').value;
        
        // Apply FX
        applyFX(trackVolume);
        
        gain.gain.setValueAtTime(0.7, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(trackVolume);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    }
    
    function createChord() {
        const frequencies = [261.63, 329.63, 392.00]; // C, E, G
        
        // Apply track volume
        const trackVolume = audioContext.createGain();
        trackVolume.gain.value = document.querySelector('#chord-track .volume-slider').value;
        
        // Apply FX
        applyFX(trackVolume);
        
        frequencies.forEach(freq => {
            const oscillator = audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = freq;
            
            const gain = audioContext.createGain();
            gain.gain.value = 0;
            
            gain.gain.setValueAtTime(0.5, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.connect(gain);
            gain.connect(trackVolume);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
        });
    }
    
    // Apply active FX to a node
    function applyFX(node) {
        let lastNode = node;
        
        // Get all active FX buttons
        const activeFX = Array.from(document.querySelectorAll('.fx-btn.active'))
            .map(btn => btn.getAttribute('data-fx'));
        
        // Connect through all active FX in order
        activeFX.forEach(fx => {
            if (fxNodes[fx]) {
                lastNode.connect(fxNodes[fx]);
                lastNode = fxNodes[fx];
            }
        });
        
        // Connect to master output
        lastNode.connect(masterGain);
    }
    
    // Step sequencing
    function playStep() {
        // Remove active class from all steps
        document.querySelectorAll('.step.active').forEach(step => {
            step.classList.remove('active');
        });
        
        // Add active class to current step
        const currentSteps = document.querySelectorAll(`.step[data-step="${currentStep}"]`);
        currentSteps.forEach(step => {
            step.classList.add('active');
            
            // Play sound if step is on
            if (step.classList.contains('on')) {
                const trackId = step.closest('.track').id;
                
                switch(trackId) {
                    case 'kick-track':
                        createKick();
                        break;
                    case 'snare-track':
                        createSnare();
                        break;
                    case 'bass-track':
                        createBass();
                        break;
                    case 'chord-track':
                        createChord();
                        break;
                }
            }
        });
        
        // Move to next step
        currentStep = (currentStep + 1) % 8;
    }
    
    // Start the sequencer
    function startSequencer() {
        if (isPlaying) return;
        
        isPlaying = true;
        currentStep = 0;
        
        const stepsPerMinute = tempo * 2; // 8th notes at given BPM
        const interval = 60 / stepsPerMinute; // in seconds
        
        noteInterval = setInterval(() => {
            playStep();
        }, interval * 1000);
    }
    
    // Stop the sequencer
    function stopSequencer() {
        if (!isPlaying) return;
        
        isPlaying = false;
        clearInterval(noteInterval);
        
        // Remove active class from all steps
        document.querySelectorAll('.step.active').forEach(step => {
            step.classList.remove('active');
        });
    }
    
    // Event listeners
    function setupEventListeners() {
        // Play button
        document.getElementById('playBtn').addEventListener('click', () => {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            startSequencer();
        });
        
        // Stop button
        document.getElementById('stopBtn').addEventListener('click', stopSequencer);
        
        // Tempo slider
        const tempoSlider = document.getElementById('tempo');
        const tempoValue = document.getElementById('tempoValue');
        
        tempoSlider.addEventListener('input', () => {
            tempo = parseInt(tempoSlider.value);
            tempoValue.textContent = tempo;
            
            // Restart sequencer with new tempo if playing
            if (isPlaying) {
                stopSequencer();
                startSequencer();
            }
        });
        
        // Step buttons
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                step.classList.toggle('on');
            });
        });
        
        // Volume sliders
        document.querySelectorAll('.volume-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                // Volume is applied when sounds are created
            });
        });
        
        // FX buttons
        document.querySelectorAll('.fx-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
            });
        });
    }
    
    // Initialize the app
    function init() {
        initAudio();
        setupEventListeners();
    }
    
    // Start everything
    init();
});
