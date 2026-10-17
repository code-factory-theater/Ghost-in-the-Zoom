// ==================== Global State ====================
        const state = {
            isRunning: false,
            isPaused: false,
            startTime: 0,
            totalDuration: 300, // 5 minutes default
            currentStage: 0,
            degradationLevel: 0, // 0-1
            fpsTarget: 60,
            currentFps: 60,
            saturation: 100,
            audioGain: 1.0,
            bitCrusherActive: false
        };

        // ==================== DOM Elements ====================
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const timeSlider = document.getElementById('timeSlider');
        const timeValue = document.getElementById('timeValue');
        const presetBtns = document.querySelectorAll('.preset-btn');
        const btnStart = document.getElementById('btnStart');
        const btnAbort = document.getElementById('btnAbort');
        const progressBar = document.getElementById('progressBar');
        const stageLabel = document.getElementById('stageLabel');
        const timeDisplay = document.getElementById('timeDisplay');
        const bailoutIndicator = document.getElementById('bailoutIndicator');
        const reconnectSpinner = document.getElementById('reconnectSpinner');
        const reconnectText = document.getElementById('reconnectText');

        // Status displays
        const statusState = document.getElementById('statusState');
        const statusPhase = document.getElementById('statusPhase');
        const statusElapsed = document.getElementById('statusElapsed');
        const statusRemaining = document.getElementById('statusRemaining');
        const statusFps = document.getElementById('statusFps');
        const statusSaturation = document.getElementById('statusSaturation');
        const statusAudio = document.getElementById('statusAudio');

        // ==================== Web Audio Setup ====================
        let audioContext = null;
        let mediaStream = null;
        let sourceNode = null;
        let biquadFilter = null;
        let gainNode = null;
        let analyser = null;
        let dataArray = null;

        // ==================== Initialize ====================
        window.addEventListener('DOMContentLoaded', () => {
            setupCanvas();
            setupAudio();
            setupEventListeners();
            drawInitialFrame();
        });

        function setupCanvas() {
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }

        async function setupAudio() {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                sourceNode = audioContext.createMediaStreamSource(mediaStream);
                
                // Create filter chain
                biquadFilter = audioContext.createBiquadFilter();
                biquadFilter.type = 'lowpass';
                biquadFilter.frequency.value = 20000; // Full range initially
                
                gainNode = audioContext.createGain();
                gainNode.gain.value = 1.0;
                
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                dataArray = new Uint8Array(analyser.frequencyBinCount);
                
                sourceNode.connect(biquadFilter);
                biquadFilter.connect(gainNode);
                gainNode.connect(analyser);
                analyser.connect(audioContext.destination);
            } catch (err) {
                console.warn('Audio setup failed:', err);
            }
        }

        function setupEventListeners() {
            timeSlider.addEventListener('input', (e) => {
                state.totalDuration = parseInt(e.target.value);
                updateTimeDisplay();
                updatePresetButtons();
            });

            presetBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const time = parseInt(btn.dataset.time);
                    state.totalDuration = time;
                    timeSlider.value = time;
                    updateTimeDisplay();
                    updatePresetButtons();
                });
            });

            btnStart.addEventListener('click', startDissolveSequence);
            btnAbort.addEventListener('click', abortSequence);

            // Spacekey emergency abort
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space') {
                    e.preventDefault();
                    if (state.isRunning) {
                        abortSequence();
                    }
                }
            });

            // Canvas click for abort
            canvas.addEventListener('click', () => {
                if (state.isRunning) {
                    abortSequence();
                }
            });

            // Resize handler
            window.addEventListener('resize', () => {
                setupCanvas();
            });
        }

        function updateTimeDisplay() {
            const mins = Math.floor(state.totalDuration / 60);
            const secs = state.totalDuration % 60;
            timeValue.textContent = `${mins}分 ${String(secs).padStart(2, '0')}秒`;
        }

        function updatePresetButtons() {
            presetBtns.forEach(btn => {
                const time = parseInt(btn.dataset.time);
                btn.classList.toggle('active', time === state.totalDuration);
            });
        }

        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        // ==================== Dissolve Sequence ====================
        function startDissolveSequence() {
            if (state.isRunning) return;
            
            state.isRunning = true;
            state.startTime = Date.now();
            state.currentStage = 0;
            state.degradationLevel = 0;
            
            btnStart.disabled = true;
            btnAbort.disabled = false;
            statusState.textContent = '実行中';
            bailoutIndicator.classList.add('active');
            
            animationLoop();
        }

        function abortSequence() {
            if (!state.isRunning) return;
            
            state.isRunning = false;
            state.currentStage = 0;
            state.degradationLevel = 0;
            
            // Immediate recovery
            resetAudioEffects();
            resetVideoEffects();
            
            btnStart.disabled = false;
            btnAbort.disabled = true;
            statusState.textContent = '準備完了';
            statusPhase.textContent = '-';
            bailoutIndicator.classList.remove('active');
            reconnectSpinner.style.opacity = '0';
            reconnectText.style.opacity = '0';
            progressBar.style.width = '0%';
            stageLabel.textContent = '待機中';
            
            drawInitialFrame();
        }

        function resetAudioEffects() {
            if (biquadFilter && gainNode) {
                biquadFilter.frequency.setValueAtTime(20000, audioContext.currentTime);
                gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
            }
            state.saturation = 100;
            state.audioGain = 1.0;
            state.bitCrusherActive = false;
        }

        function resetVideoEffects() {
            state.fpsTarget = 60;
            state.currentFps = 60;
            state.saturation = 100;
        }

        let lastFrameTime = 0;
        let frameCount = 0;
        let fpsUpdateTime = 0;

        function animationLoop() {
            const now = Date.now();
            const elapsed = (now - state.startTime) / 1000;
            const progress = Math.min(elapsed / state.totalDuration, 1);
            
            // Calculate current stage
            if (progress < 0.4) {
                state.currentStage = 1;
                state.degradationLevel = progress / 0.4;
            } else if (progress < 0.8) {
                state.currentStage = 2;
                state.degradationLevel = (progress - 0.4) / 0.4;
            } else {
                state.currentStage = 3;
                state.degradationLevel = (progress - 0.8) / 0.2;
            }
            
            // Apply degradation
            applyVideoDegradation();
            applyAudioDegradation();
            
            // Update UI
            updateDisplay(elapsed, progress);
            
            // Frame skipping for FPS reduction
            const now2 = performance.now();
            if (now2 - lastFrameTime >= 1000 / state.fpsTarget) {
                drawFrame();
                lastFrameTime = now2;
            }
            
            frameCount++;
            if (now - fpsUpdateTime > 500) {
                state.currentFps = Math.round(frameCount / ((now - fpsUpdateTime) / 1000));
                statusFps.textContent = state.currentFps;
                frameCount = 0;
                fpsUpdateTime = now;
            }
            
            if (progress >= 1) {
                completeDissolve();
            } else if (state.isRunning) {
                requestAnimationFrame(animationLoop);
            }
        }

        function applyVideoDegradation() {
            const level = state.degradationLevel;
            
            if (state.currentStage === 1) {
                // Stage 1: Subtle jitter (0-40%)
                state.fpsTarget = 60 - (level * 15); // 60 -> 45 fps
                state.saturation = 100 - (level * 5); // 100 -> 95%
            } else if (state.currentStage === 2) {
                // Stage 2: Heavy packet loss (40-80%)
                state.fpsTarget = 45 - (level * 40); // 45 -> 5 fps
                state.saturation = 95 - (level * 65); // 95 -> 30%
            } else if (state.currentStage === 3) {
                // Stage 3: Critical collapse (80-100%)
                state.fpsTarget = 5;
                state.saturation = 30 - (level * 30); // 30 -> 0%
                
                // Show reconnect UI in stage 3
                reconnectSpinner.style.opacity = Math.min(level, 1);
                reconnectText.style.opacity = Math.min(level, 1);
            }
        }

        function applyAudioDegradation() {
            if (!biquadFilter || !gainNode) return;
            
            const level = state.degradationLevel;
            
            if (state.currentStage === 1) {
                // Stage 1: High-frequency cutoff
                const freq = 20000 - (level * 10000); // 20kHz -> 10kHz
                biquadFilter.frequency.setValueAtTime(freq, audioContext.currentTime);
            } else if (state.currentStage === 2) {
                // Stage 2: Heavy low-pass + volume fluctuation
                const freq = 10000 - (level * 8000); // 10kHz -> 2kHz
                biquadFilter.frequency.setValueAtTime(freq, audioContext.currentTime);
                
                // Simulate packet loss with gain modulation
                const modulation = 0.5 + (Math.sin(Date.now() * 0.01) * 0.3);
                gainNode.gain.setValueAtTime(modulation * (1 - level * 0.3), audioContext.currentTime);
                state.bitCrusherActive = true;
            } else if (state.currentStage === 3) {
                // Stage 3: Near-mute
                const finalGain = Math.max(0, 0.2 - (level * 0.2));
                gainNode.gain.setValueAtTime(finalGain, audioContext.currentTime);
            }
        }

        function drawInitialFrame() {
            const width = canvas.width / window.devicePixelRatio;
            const height = canvas.height / window.devicePixelRatio;
            
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            
            ctx.fillStyle = '#64c8ff';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('準備完了', width / 2, height / 2);
            ctx.font = '14px Arial';
            ctx.fillText('「シーケンス開始」をクリックしてください', width / 2, height / 2 + 40);
        }

        function drawFrame() {
            const width = canvas.width / window.devicePixelRatio;
            const height = canvas.height / window.devicePixelRatio;
            
            // Clear canvas
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            
            // Create gradient background
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#1a3a52');
            gradient.addColorStop(1, '#0d1f2d');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            
            // Draw test pattern
            drawTestPattern(width, height);
            
            // Apply degradation effects based on stage
            if (state.currentStage >= 1) {
                if (state.currentStage === 1) {
                    applySubtleJitter(width, height);
                } else if (state.currentStage === 2) {
                    applyBlockNoise(width, height);
                    applyMosaicEffect(width, height);
                } else if (state.currentStage === 3) {
                    applyFrozenFrame(width, height);
                }
            }
        }

        function drawTestPattern(width, height) {
            // Draw animated test bars with degradation
            const barCount = 6;
            const barWidth = width / barCount;
            
            for (let i = 0; i < barCount; i++) {
                const hue = (i / barCount * 360 + Date.now() * 0.1) % 360;
                ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
                
                // Apply saturation degradation
                const sat = Math.max(0, 80 - (100 - state.saturation));
                ctx.fillStyle = `hsl(${hue}, ${sat}%, 50%)`;
                
                ctx.fillRect(i * barWidth, 0, barWidth, height * 0.6);
            }
            
            // Draw waveform
            ctx.strokeStyle = '#64c8ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            const frequency = 2 + state.degradationLevel;
            for (let x = 0; x < width; x += 5) {
                const y = height * 0.7 + Math.sin(x * frequency * 0.01) * 20;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Status text
            ctx.fillStyle = '#64c8ff';
            ctx.font = 'bold 16px Courier New';
            ctx.textAlign = 'left';
            ctx.fillText(`FPS: ${state.currentFps}`, 20, height - 60);
            ctx.fillText(`Saturation: ${Math.round(state.saturation)}%`, 20, height - 35);
            
            const stageNames = ['', 'Stage 1: Subtle', 'Stage 2: Severe', 'Stage 3: Critical'];
            ctx.fillText(stageNames[state.currentStage] || '', 20, height - 10);
        }

        function applySubtleJitter(width, height) {
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Random block noise insertion
            if (Math.random() < 0.1) {
                const blockSize = 4;
                const x = Math.random() * (width - blockSize);
                const y = Math.random() * (height - blockSize);
                
                for (let i = 0; i < blockSize * blockSize * 4; i += 4) {
                    const idx = (Math.floor(y) * width + Math.floor(x)) * 4 + i;
                    if (idx < data.length) {
                        data[idx] = Math.random() * 255;
                        data[idx + 1] = Math.random() * 255;
                        data[idx + 2] = Math.random() * 255;
                    }
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
        }

        function applyBlockNoise(width, height) {
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            const blockSize = Math.max(2, Math.floor(8 * state.degradationLevel));
            const noiseAmount = Math.floor(50 * state.degradationLevel);
            
            for (let i = 0; i < noiseAmount; i++) {
                const bx = Math.floor(Math.random() * (width / blockSize)) * blockSize;
                const by = Math.floor(Math.random() * (height / blockSize)) * blockSize;
                
                for (let y = by; y < by + blockSize && y < height; y++) {
                    for (let x = bx; x < bx + blockSize && x < width; x++) {
                        const idx = (y * width + x) * 4;
                        if (Math.random() < 0.5) {
                            data[idx] = Math.random() * 255;
                            data[idx + 1] = Math.random() * 255;
                            data[idx + 2] = Math.random() * 255;
                        }
                    }
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
        }

        function applyMosaicEffect(width, height) {
            const tileSize = Math.max(4, Math.floor(16 * state.degradationLevel));
            
            for (let y = 0; y < height; y += tileSize) {
                for (let x = 0; x < width; x += tileSize) {
                    const imageData = ctx.getImageData(x, y, tileSize, tileSize);
                    const data = imageData.data;
                    
                    // Average color
                    let r = 0, g = 0, b = 0, count = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        r += data[i];
                        g += data[i + 1];
                        b += data[i + 2];
                        count++;
                    }
                    
                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);
                    
                    // Fill tile with average color
                    for (let i = 0; i < data.length; i += 4) {
                        data[i] = r;
                        data[i + 1] = g;
                        data[i + 2] = b;
                    }
                    
                    ctx.putImageData(imageData, x, y);
                }
            }
        }

        function applyFrozenFrame(width, height) {
            // Draw "thinking face" (DeepFreeze emulation)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, width, height);
            
            const centerX = width / 2;
            const centerY = height / 2;
            const faceSize = Math.min(width, height) * 0.3;
            
            // Draw face circle
            ctx.fillStyle = '#64c8ff';
            ctx.beginPath();
            ctx.arc(centerX, centerY, faceSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw eyes
            ctx.fillStyle = '#000';
            const eyeSize = faceSize * 0.15;
            ctx.beginPath();
            ctx.arc(centerX - faceSize * 0.3, centerY - faceSize * 0.2, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(centerX + faceSize * 0.3, centerY - faceSize * 0.2, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw thinking expression
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(centerX, centerY + faceSize * 0.2, faceSize * 0.2, 0, Math.PI);
            ctx.stroke();
        }

        function updateDisplay(elapsed, progress) {
            const remaining = Math.max(0, state.totalDuration - elapsed);
            
            progressBar.style.width = (progress * 100) + '%';
            timeDisplay.textContent = formatTime(elapsed);
            
            const stageNames = ['待機中', 'Stage 1: 微細劣化', 'Stage 2: 深刻障害', 'Stage 3: 臨界崩壊'];
            stageLabel.textContent = stageNames[state.currentStage] || '待機中';
            
            statusPhase.textContent = stageNames[state.currentStage] || '-';
            statusElapsed.textContent = formatTime(elapsed);
            statusRemaining.textContent = formatTime(remaining);
            statusSaturation.textContent = Math.round(state.saturation) + '%';
            
            if (state.currentStage === 3) {
                statusAudio.textContent = 'ミュート中';
            } else if (state.currentStage === 2) {
                statusAudio.textContent = 'ビットクラッシャー';
            } else if (state.currentStage === 1) {
                statusAudio.textContent = '高周波カット';
            } else {
                statusAudio.textContent = '通常';
            }
        }

        function completeDissolve() {
            state.isRunning = false;
            statusState.textContent = '完了';
            btnStart.disabled = false;
            btnAbort.disabled = true;
            bailoutIndicator.classList.remove('active');
            
            // Final frozen state
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
            
            ctx.fillStyle = '#64c8ff';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const centerX = canvas.width / window.devicePixelRatio / 2;
            const centerY = canvas.height / window.devicePixelRatio / 2;
            ctx.fillText('フェードアウト完了', centerX, centerY);
        }