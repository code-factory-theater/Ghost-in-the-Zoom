// ============================================================================
        // Ghost-in-the-Zoom Phase 3: Graceful Fadeout Orchestrator
        // ============================================================================

        // Constants & Configuration
        const STAGES = {
            0: { name: 'Normal', duration: 0, videoQuality: 1.0, audioQuality: 1.0 },
            1: { name: 'Warning', videoQuality: 0.85, audioQuality: 0.9 },
            2: { name: 'Degraded', videoQuality: 0.5, audioQuality: 0.6 },
            3: { name: 'Critical', videoQuality: 0.2, audioQuality: 0.3 },
            4: { name: 'Poof', videoQuality: 0.0, audioQuality: 0.0 }
        };

        // Global State
        let state = {
            isRunning: false,
            currentStage: 0,
            startTime: null,
            totalDuration: 180,
            targetProfile: 'SlowDeath',
            videoQualityLevel: 1.0,
            audioQualityLevel: 1.0,
            frameCount: 0,
            cpuLoad: 'Low'
        };

        // ============================================================================
        // ORCHESTRATOR - Main Timeline Controller
        // ============================================================================

        class FadeoutOrchestrator {
            constructor(options = {}) {
                this.duration = options.duration || 180; // seconds
                this.profile = options.profile || 'SlowDeath';
                this.startTime = Date.now();
                this.isRunning = false;
                this.listeners = {};
                this.animationId = null;
                this.stageTransitions = this._buildStageTransitions();
            }

            _buildStageTransitions() {
                const dur = this.duration;
                const profile = this.profile;

                if (profile === 'SlowDeath') {
                    return {
                        0: 0,
                        1: dur * 0.25,
                        2: dur * 0.50,
                        3: dur * 0.85,
                        4: dur
                    };
                } else if (profile === 'SurgeDrop') {
                    return {
                        0: 0,
                        1: dur * 0.10,
                        2: dur * 0.20,
                        3: dur * 0.40,
                        4: dur
                    };
                } else if (profile === 'GhostLoop') {
                    return {
                        0: 0,
                        1: dur * 0.20,
                        2: dur * 0.40,
                        3: dur * 0.60,
                        4: dur * 1.5 // Loop back before final cutoff
                    };
                }
            }

            on(eventName, callback) {
                if (!this.listeners[eventName]) {
                    this.listeners[eventName] = [];
                }
                this.listeners[eventName].push(callback);
            }

            emit(eventName, data) {
                if (this.listeners[eventName]) {
                    this.listeners[eventName].forEach(cb => cb(data));
                }
            }

            start() {
                this.isRunning = true;
                this.startTime = Date.now();
                this.emit('start', { timestamp: this.startTime });
                this._tick();
            }

            stop() {
                this.isRunning = false;
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                }
                this.emit('stop', { timestamp: Date.now() });
            }

            abort() {
                this.isRunning = false;
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                }
                this.emit('abort', { timestamp: Date.now() });
            }

            _tick() {
                if (!this.isRunning) return;

                const elapsed = (Date.now() - this.startTime) / 1000; // seconds
                const progress = Math.min(elapsed / this.duration, 1.0);

                // Determine current stage
                let stage = 0;
                for (let s = 4; s >= 0; s--) {
                    if (elapsed >= this.stageTransitions[s]) {
                        stage = s;
                        break;
                    }
                }

                // Calculate quality levels based on stage
                let videoQuality = 1.0;
                let audioQuality = 1.0;

                if (stage === 1) {
                    const stageProgress = (elapsed - this.stageTransitions[1]) / 
                        (this.stageTransitions[2] - this.stageTransitions[1]);
                    videoQuality = 1.0 - (0.15 * stageProgress);
                    audioQuality = 1.0 - (0.1 * stageProgress);
                } else if (stage === 2) {
                    const stageProgress = (elapsed - this.stageTransitions[2]) / 
                        (this.stageTransitions[3] - this.stageTransitions[2]);
                    videoQuality = 0.85 - (0.65 * stageProgress);
                    audioQuality = 0.9 - (0.6 * stageProgress);
                } else if (stage === 3) {
                    const stageProgress = (elapsed - this.stageTransitions[3]) / 
                        (this.stageTransitions[4] - this.stageTransitions[3]);
                    videoQuality = Math.max(0.2 - (0.2 * stageProgress), 0);
                    audioQuality = Math.max(0.3 - (0.3 * stageProgress), 0);
                } else if (stage === 4) {
                    videoQuality = 0;
                    audioQuality = 0;
                } else if (stage === 0) {
                    videoQuality = 1.0;
                    audioQuality = 1.0;
                }

                this.emit('tick', {
                    elapsed,
                    progress,
                    stage,
                    videoQuality,
                    audioQuality
                });

                if (stage >= 4) {
                    this.emit('complete', { elapsed });
                    this.isRunning = false;
                } else {
                    this.animationId = requestAnimationFrame(() => this._tick());
                }
            }
        }

        // ============================================================================
        // VIDEO DEGRADATION ENGINE
        // ============================================================================

        class VideoProcessor {
            constructor(canvasElement) {
                this.canvas = canvasElement;
                this.ctx = canvasElement.getContext('2d');
                this.imageData = null;
                this.qualityLevel = 1.0;
                this.blockSize = 1;
                this.frame = 0;
            }

            update(qualityLevel) {
                this.qualityLevel = qualityLevel;

                // Calculate block size based on quality (pixelation effect)
                if (qualityLevel > 0.9) {
                    this.blockSize = 1;
                } else if (qualityLevel > 0.7) {
                    this.blockSize = 2;
                } else if (qualityLevel > 0.5) {
                    this.blockSize = 4;
                } else if (qualityLevel > 0.2) {
                    this.blockSize = 8;
                } else {
                    this.blockSize = 16;
                }
            }

            render() {
                const w = this.canvas.width;
                const h = this.canvas.height;

                // Draw animated gradient background
                const gradient = this.ctx.createLinearGradient(0, 0, w, h);
                const hue = (this.frame * 0.5) % 360;
                gradient.addColorStop(0, `hsl(${hue}, 70%, 50%)`);
                gradient.addColorStop(1, `hsl(${(hue + 60) % 360}, 70%, 40%)`);
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(0, 0, w, h);

                // Add pixelation/block noise
                if (this.blockSize > 1) {
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                    for (let y = 0; y < h; y += this.blockSize * 2) {
                        for (let x = 0; x < w; x += this.blockSize * 2) {
                            if (Math.random() > this.qualityLevel) {
                                this.ctx.fillRect(x, y, this.blockSize, this.blockSize);
                            }
                        }
                    }
                }

                // Draw status text
                const stageNames = ['Normal', 'Warning', 'Degraded', 'Critical', 'Disconnected'];
                const currentStageName = stageNames[state.currentStage] || 'Unknown';
                
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.font = 'bold 20px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`Stage ${state.currentStage}: ${currentStageName}`, w / 2, h / 2);

                this.ctx.font = '14px monospace';
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                this.ctx.fillText(`Quality: ${(this.qualityLevel * 100).toFixed(0)}%`, w / 2, h / 2 + 40);

                // Add scan lines for older CRT effect
                if (this.qualityLevel < 0.7) {
                    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                    this.ctx.lineWidth = 1;
                    for (let y = 0; y < h; y += 4) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(0, y);
                        this.ctx.lineTo(w, y);
                        this.ctx.stroke();
                    }
                }

                this.frame++;
            }
        }

        // ============================================================================
        // AUDIO DEGRADATION ENGINE
        // ============================================================================

        class AudioProcessor {
            constructor() {
                this.audioContext = null;
                this.qualityLevel = 1.0;
                this.analyser = null;
                this.dataArray = null;
                this.initialized = false;
            }

            init() {
                if (this.initialized) return;
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    this.analyser = this.audioContext.createAnalyser();
                    this.analyser.fftSize = 256;
                    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
                    this.initialized = true;
                } catch (e) {
                    console.log('Audio context not available');
                }
            }

            getFrequencyData() {
                if (!this.analyser) return null;
                this.analyser.getByteFrequencyData(this.dataArray);
                return this.dataArray;
            }

            update(qualityLevel) {
                this.qualityLevel = qualityLevel;
                // In a real scenario, this would modify audio nodes
            }

            generatePacketDropSound() {
                if (!this.audioContext) return;
                
                const now = this.audioContext.currentTime;
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();

                osc.connect(gain);
                gain.connect(this.audioContext.destination);

                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0, now + 0.05);

                osc.start(now);
                osc.stop(now + 0.05);
            }
        }

        // ============================================================================
        // UI STATE MANAGER
        // ============================================================================

        class UIManager {
            constructor() {
                this.orchestrator = null;
                this.videoProcessor = new VideoProcessor(document.getElementById('simulationCanvas'));
                this.audioProcessor = new AudioProcessor();
                this.animationId = null;
                this.setupEventListeners();
            }

            setupEventListeners() {
                // Duration selection
                document.getElementById('durationSelect').addEventListener('change', (e) => {
                    if (e.target.value === 'custom') {
                        document.getElementById('customDurationGroup').style.display = 'block';
                    } else {
                        document.getElementById('customDurationGroup').style.display = 'none';
                    }
                });

                // Main controls
                document.getElementById('startBtn').addEventListener('click', () => this.startSequence());
                document.getElementById('stopBtn').addEventListener('click', () => this.stopSequence());
                document.getElementById('testStageBtn').addEventListener('click', () => this.testStages());
                document.getElementById('interruptBtn').addEventListener('click', () => this.interrupt());
                document.getElementById('resetBtn').addEventListener('click', () => this.reset());

                // Legacy tools
                document.getElementById('deepFreezeBtn').addEventListener('click', () => this.deepFreeze());
                document.getElementById('panicAudioBtn').addEventListener('click', () => this.panicAudio());
                document.getElementById('glitchVideoBtn').addEventListener('click', () => this.glitchVideo());
                document.getElementById('makeExcuseBtn').addEventListener('click', () => this.makeExcuse());

                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => {
                    if (e.code === 'Space' && state.isRunning) {
                        e.preventDefault();
                        this.interrupt();
                    }
                    if (e.code === 'Escape') {
                        this.reset();
                    }
                });

                // Canvas animation loop
                this.animate();
            }

            getDuration() {
                const selected = document.getElementById('durationSelect').value;
                if (selected === 'custom') {
                    return parseInt(document.getElementById('customDuration').value) || 120;
                }
                return parseInt(selected);
            }

            startSequence() {
                if (state.isRunning) return;

                const duration = this.getDuration();
                const profile = document.getElementById('profileSelect').value;

                state.isRunning = true;
                state.startTime = Date.now();
                state.totalDuration = duration;
                state.targetProfile = profile;
                state.currentStage = 0;

                document.getElementById('startBtn').disabled = true;
                document.getElementById('stopBtn').disabled = false;
                document.getElementById('testStageBtn').disabled = true;

                // Disable legacy tools
                this.disableLegacyTools(true);

                this.orchestrator = new FadeoutOrchestrator({
                    duration,
                    profile
                });

                this.orchestrator.on('tick', (data) => {
                    state.currentStage = data.stage;
                    state.videoQualityLevel = data.videoQuality;
                    state.audioQualityLevel = data.audioQuality;
                    this.updateUI(data);
                });

                this.orchestrator.on('complete', () => {
                    this.sequenceComplete();
                });

                this.orchestrator.start();
                this.showToast(`Sequence started: ${duration}s / ${profile}`, 'success');
            }

            stopSequence() {
                if (!state.isRunning) return;

                state.isRunning = false;
                if (this.orchestrator) {
                    this.orchestrator.abort();
                }

                document.getElementById('startBtn').disabled = false;
                document.getElementById('stopBtn').disabled = true;
                document.getElementById('testStageBtn').disabled = false;
                this.disableLegacyTools(false);

                this.showToast('Sequence aborted', 'danger');
                this.reset();
            }

            interrupt() {
                if (!state.isRunning) return;
                this.stopSequence();
            }

            testStages() {
                if (state.isRunning) return;

                // Quickly cycle through all stages
                let stage = 0;
                const interval = setInterval(() => {
                    state.currentStage = stage;
                    state.videoQualityLevel = [1.0, 0.85, 0.5, 0.2, 0][stage];
                    state.audioQualityLevel = [1.0, 0.9, 0.6, 0.3, 0][stage];
                    this.updateTestUI(stage);

                    this.videoProcessor.update(state.videoQualityLevel);

                    if (stage >= 4) {
                        clearInterval(interval);
                        setTimeout(() => this.reset(), 1000);
                    }
                    stage++;
                }, 1000);
            }

            updateUI(data) {
                const stageNames = ['Normal', 'Warning', 'Degraded', 'Critical', 'Poof'];
                
                // Update status
                document.getElementById('currentStage').textContent = 
                    `Stage ${data.stage} - ${stageNames[data.stage]}`;
                
                // Format time
                const mins = Math.floor(data.elapsed / 60);
                const secs = Math.floor(data.elapsed % 60);
                document.getElementById('elapsedTime').textContent = 
                    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

                const remaining = Math.max(0, state.totalDuration - data.elapsed);
                const rmins = Math.floor(remaining / 60);
                const rsecs = Math.floor(remaining % 60);
                document.getElementById('remainingTime').textContent = 
                    `${String(rmins).padStart(2, '0')}:${String(rsecs).padStart(2, '0')}`;

                // Video quality
                document.getElementById('videoQuality').textContent = 
                    `${(data.videoQuality * 100).toFixed(0)}%`;

                // Progress bar
                document.getElementById('progressFill').style.width = 
                    `${data.progress * 100}%`;

                // Stage indicators
                const dots = document.querySelectorAll('.stage-dot');
                dots.forEach((dot, i) => {
                    dot.classList.remove('active', 'passed');
                    if (i === data.stage) {
                        dot.classList.add('active');
                    } else if (i < data.stage) {
                        dot.classList.add('passed');
                    }
                });

                // Update CPU load estimate
                const cpuEstimate = Math.min(100, 20 + (data.stage * 15));
                if (cpuEstimate < 30) {
                    state.cpuLoad = 'Low';
                } else if (cpuEstimate < 60) {
                    state.cpuLoad = 'Medium';
                } else {
                    state.cpuLoad = 'High';
                }
                document.getElementById('cpuLoad').textContent = state.cpuLoad;

                // Update video processor
                this.videoProcessor.update(data.videoQuality);

                // Generate occasional packet drop sound at stage 2+
                if (data.stage >= 2 && Math.random() > 0.95) {
                    this.audioProcessor.generatePacketDropSound();
                }
            }

            updateTestUI(stage) {
                const stageNames = ['Normal', 'Warning', 'Degraded', 'Critical', 'Poof'];
                document.getElementById('currentStage').textContent = 
                    `Test: Stage ${stage} - ${stageNames[stage]}`;
                
                const dots = document.querySelectorAll('.stage-dot');
                dots.forEach((dot, i) => {
                    dot.classList.remove('active', 'passed');
                    if (i === stage) {
                        dot.classList.add('active');
                    } else if (i < stage) {
                        dot.classList.add('passed');
                    }
                });

                const qualities = [1.0, 0.85, 0.5, 0.2, 0];
                document.getElementById('videoQuality').textContent = 
                    `${(qualities[stage] * 100).toFixed(0)}%`;
            }

            sequenceComplete() {
                state.isRunning = false;
                document.getElementById('startBtn').disabled = false;
                document.getElementById('stopBtn').disabled = true;
                document.getElementById('testStageBtn').disabled = false;
                this.disableLegacyTools(false);

                this.showToast('Sequence complete! Meeting ended gracefully.', 'success');
                
                // Generate excuse mail
                setTimeout(() => {
                    this.generateExcuseMail();
                }, 500);
            }

            reset() {
                state.isRunning = false;
                state.currentStage = 0;
                state.videoQualityLevel = 1.0;
                state.audioQualityLevel = 1.0;
                state.startTime = null;

                document.getElementById('currentStage').textContent = 'Stage 0 - Normal';
                document.getElementById('elapsedTime').textContent = '00:00';
                document.getElementById('remainingTime').textContent = '--:--';
                document.getElementById('videoQuality').textContent = '100%';
                document.getElementById('cpuLoad').textContent = 'Low';
                document.getElementById('progressFill').style.width = '0%';

                const dots = document.querySelectorAll('.stage-dot');
                dots.forEach((dot, i) => {
                    dot.classList.remove('active', 'passed');
                    if (i === 0) dot.classList.add('active');
                });

                this.videoProcessor.update(1.0);
                document.getElementById('startBtn').disabled = false;
                document.getElementById('stopBtn').disabled = true;
            }

            disableLegacyTools(disabled) {
                document.getElementById('deepFreezeBtn').disabled = disabled;
                document.getElementById('panicAudioBtn').disabled = disabled;
                document.getElementById('glitchVideoBtn').disabled = disabled;
                document.getElementById('makeExcuseBtn').disabled = disabled;
            }

            deepFreeze() {
                state.videoQualityLevel = 0.1;
                this.videoProcessor.update(0.1);
                this.showToast('Deep Freeze activated', 'danger');
                setTimeout(() => {
                    state.videoQualityLevel = 1.0;
                    this.videoProcessor.update(1.0);
                }, 3000);
            }

            panicAudio() {
                this.audioProcessor.init();
                if (this.audioProcessor.audioContext) {
                    const now = this.audioProcessor.audioContext.currentTime;
                    const osc = this.audioProcessor.audioContext.createOscillator();
                    const gain = this.audioProcessor.audioContext.createGain();

                    osc.connect(gain);
                    gain.connect(this.audioProcessor.audioContext.destination);

                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
                    gain.gain.setValueAtTime(0.3, now);
                    gain.gain.exponentialRampToValueAtTime(0, now + 0.15);

                    osc.start(now);
                    osc.stop(now + 0.15);
                }
                this.showToast('Panic audio triggered', 'danger');
            }

            glitchVideo() {
                state.videoQualityLevel = 0.3;
                this.videoProcessor.update(0.3);
                this.showToast('Glitch video activated', 'danger');
                setTimeout(() => {
                    state.videoQualityLevel = 1.0;
                    this.videoProcessor.update(1.0);
                }, 2000);
            }

            makeExcuse() {
                const excuses = [
                    "すみません、急にルーターの調子が…",
                    "あ、電波が…接続が切れそうです",
                    "通信が不安定になってきました",
                    "インターネット接続が…"
                ];
                const excuse = excuses[Math.floor(Math.random() * excuses.length)];
                
                try {
                    navigator.clipboard.writeText(excuse);
                    this.showToast(`Copied: "${excuse}"`, 'success');
                } catch (e) {
                    this.showToast('Failed to copy excuse', 'danger');
                }
            }

            generateExcuseMail() {
                const excuses = [
                    "申し訳ございません。先ほどの会議中にネットワーク接続が不安定になり、途中で接続が切れてしまいました。ご迷惑をおかけして申し訳ございませんでした。",
                    "お疲れ様です。申し訳ございませんが、本日は通信環境の問題で会議から外れてしまいました。重要な情報を見落としていないか、議事録をご確認いただけますでしょうか。",
                    "大変失礼いたしました。自宅のルーター接続が不安定で、会議に参加できなくなってしまいました。後ほど別の形式でフォローさせていただきたく存じます。"
                ];
                const mail = excuses[Math.floor(Math.random() * excuses.length)];
                
                try {
                    navigator.clipboard.writeText(mail);
                    this.showToast('Excuse email drafted and copied', 'success');
                } catch (e) {
                    this.showToast('Email draft ready', 'success');
                }
            }

            animate() {
                this.videoProcessor.render();

                // Update audio meter
                if (this.audioProcessor.initialized) {
                    const freqData = this.audioProcessor.getFrequencyData();
                    if (freqData) {
                        const bars = document.querySelectorAll('.meter-bar');
                        const step = Math.floor(freqData.length / bars.length);
                        bars.forEach((bar, i) => {
                            const value = freqData[i * step] || 0;
                            bar.style.height = `${(value / 255) * 100}%`;
                        });
                    }
                }

                this.animationId = requestAnimationFrame(() => this.animate());
            }

            showToast(message, type = 'success') {
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.textContent = message;
                document.body.appendChild(toast);

                setTimeout(() => {
                    toast.classList.add('fadeout');
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }
        }

        // ============================================================================
        // INITIALIZATION
        // ============================================================================

        let uiManager = null;

        document.addEventListener('DOMContentLoaded', () => {
            uiManager = new UIManager();
            console.log('Ghost-in-the-Zoom Phase 3: Graceful Fadeout Orchestrator initialized');
        });