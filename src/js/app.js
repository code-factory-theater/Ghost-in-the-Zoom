// ===== CONSTANTS & GLOBALS =====
        const CONFIG = {
            LOOP_DURATION_MS: 3000,
            FRAME_RATE: 30,
            CROSSFADE_DURATION_MS: 300,
            AUDIO_SAMPLE_RATE: 16000,
            MAX_MEMORY_MB: 50,
        };

        const STATE = {
            ghostActive: false,
            audioActive: false,
            autoReturn: false,
            voiceLine: false,
            triggerWords: ['田中さん', 'たなか', 'リーダー'],
            frameBuffer: [],
            isLooping: false,
            lastAlertTime: 0,
            debugMode: false,
        };

        let mediaStream = null;
        let video = null;
        let canvas = null;
        let canvasCtx = null;
        let ghostCanvas = null;
        let ghostCanvasCtx = null;
        let animationFrameId = null;
        let recognitionInstance = null;
        let currentStreamTrack = null;
        let loopStartIndex = 0;
        let loopDirection = 1;
        let frameIndex = 0;
        let fpsCounter = 0;
        let lastFpsTime = Date.now();

        // ===== INITIALIZATION =====
        async function initialize() {
            console.log('[Phase 2] Initializing Ghost Twin & Name Summon...');
            
            video = document.getElementById('video');
            ghostCanvas = document.getElementById('ghostCanvas');
            
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: true,
                });
                
                video.srcObject = mediaStream;
                currentStreamTrack = mediaStream.getVideoTracks()[0];
                
                // Setup canvas for frame capturing
                canvas = document.createElement('canvas');
                canvas.width = 1280;
                canvas.height = 720;
                canvasCtx = canvas.getContext('2d', { willReadFrequently: true });
                
                // Setup ghost canvas
                ghostCanvas.width = 1280;
                ghostCanvas.height = 720;
                ghostCanvasCtx = ghostCanvas.getContext('2d', { willReadFrequently: true });
                
                setupEventListeners();
                startFrameCapture();
                updateStatus('Camera ready', 'active');
                
                console.log('[Phase 2] ✓ Initialization complete');
            } catch (error) {
                console.error('[Phase 2] ✗ Camera access failed:', error);
                updateStatus('Camera access denied', 'error');
            }
        }

        // ===== EVENT LISTENERS =====
        function setupEventListeners() {
            // Ghost Twin Toggle
            document.getElementById('toggleGhost').addEventListener('click', toggleGhost);
            document.getElementById('ghostSwitch').addEventListener('click', toggleGhost);
            
            // Manual Return
            document.getElementById('manualReturn').addEventListener('click', manualReturn);
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space' && STATE.ghostActive) {
                    e.preventDefault();
                    manualReturn();
                }
            });
            
            // Settings
            document.getElementById('openSettings').addEventListener('click', openSettings);
            
            // Emergency Stop
            document.getElementById('emergencyStop').addEventListener('click', emergencyStop);
            
            // Audio Toggle
            document.getElementById('audioSwitch').addEventListener('click', toggleAudio);
            
            // Auto Return Toggle
            document.getElementById('autoReturnSwitch').addEventListener('click', toggleAutoReturn);
            
            // Voice Line Toggle
            document.getElementById('voiceLineSwitch').addEventListener('click', toggleVoiceLine);
            
            // Trigger Word Management
            document.getElementById('addTriggerBtn').addEventListener('click', addTriggerWord);
            document.getElementById('newTriggerInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') addTriggerWord();
            });
            
            updateTriggerWordsList();
        }

        // ===== FRAME CAPTURE LOOP =====
        function startFrameCapture() {
            function captureFrame() {
                if (!video.paused && video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    if (STATE.frameBuffer.length >= CONFIG.FRAME_RATE * (CONFIG.LOOP_DURATION_MS / 1000)) {
                        STATE.frameBuffer.shift();
                    }
                    
                    STATE.frameBuffer.push({
                        timestamp: Date.now(),
                        data: imageData,
                    });
                    
                    // Update FPS
                    fpsCounter++;
                    const now = Date.now();
                    if (now - lastFpsTime >= 1000) {
                        document.getElementById('fpsCounter').textContent = fpsCounter;
                        fpsCounter = 0;
                        lastFpsTime = now;
                    }
                }
                
                animationFrameId = requestAnimationFrame(captureFrame);
            }
            captureFrame();
        }

        // ===== GHOST TWIN CORE =====
        function toggleGhost() {
            STATE.ghostActive = !STATE.ghostActive;
            const btn = document.getElementById('toggleGhost');
            const indicator = document.getElementById('ghostIndicator');
            
            if (STATE.ghostActive) {
                STATE.isLooping = true;
                frameIndex = 0;
                loopDirection = 1;
                btn.textContent = '🎭 影武者OFF';
                btn.style.background = 'linear-gradient(135deg, rgba(200, 100, 50, 0.5) 0%, rgba(200, 100, 50, 0.3) 100%)';
                indicator.classList.add('active');
                document.getElementById('ghostSwitch').classList.add('active');
                updateStatus('影武者稼働中 | ループ品質: 高', 'active', 'ghost');
                console.log('[Ghost Twin] ✓ Loop started');
                startGhostLoop();
            } else {
                STATE.isLooping = false;
                btn.textContent = '🎭 影武者ON';
                btn.style.background = 'linear-gradient(135deg, rgba(100, 200, 255, 0.5) 0%, rgba(167, 139, 250, 0.3) 100%)';
                indicator.classList.remove('active');
                document.getElementById('ghostSwitch').classList.remove('active');
                updateStatus('⏹ 停止中 | ループ品質: 高', 'normal', 'ghost');
                manualReturn(true);
                console.log('[Ghost Twin] ⏹ Loop stopped');
            }
        }

        function startGhostLoop() {
            function drawGhostFrame() {
                if (!STATE.ghostActive) return;
                
                const frameCount = STATE.frameBuffer.length;
                if (frameCount < 10) {
                    // Not enough frames yet
                    ghostCanvasCtx.fillStyle = '#000';
                    ghostCanvasCtx.fillRect(0, 0, ghostCanvas.width, ghostCanvas.height);
                    requestAnimationFrame(drawGhostFrame);
                    return;
                }
                
                // Smooth pingpong loop
                const maxIndex = Math.min(frameCount - 1, 89);
                let frameToRender = STATE.frameBuffer[Math.min(frameIndex, frameCount - 1)];
                
                if (frameToRender) {
                    ghostCanvasCtx.putImageData(frameToRender.data, 0, 0);
                    
                    // Apply subtle motion blur for naturalness
                    ghostCanvasCtx.globalAlpha = 0.05;
                    if (frameIndex > 0) {
                        const prevFrame = STATE.frameBuffer[Math.max(0, frameIndex - 1)];
                        if (prevFrame) ghostCanvasCtx.putImageData(prevFrame.data, 0, 0);
                    }
                    ghostCanvasCtx.globalAlpha = 1.0;
                }
                
                // Update frame index (pingpong)
                frameIndex += loopDirection;
                if (frameIndex >= maxIndex) {
                    loopDirection = -1;
                } else if (frameIndex <= 0) {
                    loopDirection = 1;
                }
                
                requestAnimationFrame(drawGhostFrame);
            }
            
            // Replace video stream with canvas stream
            try {
                const canvasStream = ghostCanvas.captureStream(CONFIG.FRAME_RATE);
                const canvasVideoTrack = canvasStream.getVideoTracks()[0];
                
                if (currentStreamTrack) {
                    currentStreamTrack.stop();
                }
                
                video.srcObject = canvasStream;
                currentStreamTrack = canvasVideoTrack;
                
                drawGhostFrame();
            } catch (error) {
                console.error('[Ghost Twin] Stream replacement failed:', error);
            }
        }

        function manualReturn(silent = false) {
            if (!STATE.ghostActive && silent) return;
            
            STATE.isLooping = false;
            
            // Crossfade back to real stream
            if (currentStreamTrack) {
                currentStreamTrack.stop();
            }
            
            const newVideoTrack = mediaStream.getVideoTracks()[0];
            if (newVideoTrack) {
                video.srcObject = new MediaStream([newVideoTrack]);
                currentStreamTrack = newVideoTrack;
            }
            
            if (!silent) {
                console.log('[Ghost Twin] ↩️ Returned to real feed');
            }
        }

        // ===== NAME SUMMON (AUDIO RECOGNITION) =====
        function toggleAudio() {
            STATE.audioActive = !STATE.audioActive;
            
            if (STATE.audioActive) {
                startAudioRecognition();
                document.getElementById('audioSwitch').classList.add('active');
                updateStatus('🎤 リッスン中...', 'active', 'audio');
            } else {
                stopAudioRecognition();
                document.getElementById('audioSwitch').classList.remove('active');
                updateStatus('⏹ 停止中 | マイク: ✓', 'normal', 'audio');
            }
        }

        function startAudioRecognition() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            if (!SpeechRecognition) {
                console.warn('[Name Summon] Speech Recognition not supported');
                return;
            }
            
            recognitionInstance = new SpeechRecognition();
            recognitionInstance.continuous = true;
            recognitionInstance.interimResults = true;
            recognitionInstance.lang = 'ja-JP';
            
            recognitionInstance.onstart = () => {
                console.log('[Name Summon] 🎤 Recognition started');
            };
            
            recognitionInstance.onresult = (event) => {
                let transcript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const t = event.results[i][0].transcript;
                    transcript += t;
                    
                    if (event.results[i].isFinal) {
                        checkTriggerWords(transcript);
                    }
                }
            };
            
            recognitionInstance.onerror = (event) => {
                console.error('[Name Summon] Error:', event.error);
            };
            
            recognitionInstance.onend = () => {
                if (STATE.audioActive) {
                    recognitionInstance.start();
                }
            };
            
            recognitionInstance.start();
        }

        function stopAudioRecognition() {
            if (recognitionInstance) {
                recognitionInstance.stop();
                recognitionInstance = null;
            }
        }

        function checkTriggerWords(transcript) {
            const normalizedTranscript = transcript.toLowerCase().trim();
            
            for (const triggerWord of STATE.triggerWords) {
                const normalizedTrigger = triggerWord.toLowerCase();
                if (normalizedTranscript.includes(normalizedTrigger)) {
                    triggerDetected(triggerWord);
                    return;
                }
            }
        }

        function triggerDetected(triggerWord) {
            const now = Date.now();
            if (now - STATE.lastAlertTime < 1000) return; // Debounce
            STATE.lastAlertTime = now;
            
            console.log(`[Name Summon] 🚨 "${triggerWord}" detected!`);
            
            // Visual alert
            const alertOverlay = document.getElementById('alertOverlay');
            const alertText = document.getElementById('alertText');
            alertText.textContent = `🚨 CALLING: ${triggerWord}が呼ばれました！`;
            alertOverlay.classList.add('active');
            
            // Beep sound
            playAlertSound();
            
            // Browser notification
            if (Notification.permission === 'granted') {
                new Notification('🚨 名指し検知', {
                    body: `${triggerWord}さんが呼ばれています！`,
                    badge: '👻',
                    tag: 'name-summon',
                });
            }
            
            updateStatus(`🚨 「${triggerWord}」が検知されました！`, 'alert', 'audio');
            
            // Auto return if enabled
            if (STATE.autoReturn && STATE.ghostActive) {
                setTimeout(() => {
                    manualReturn();
                    if (STATE.voiceLine) {
                        playVoiceLine();
                    }
                    console.log('[Name Summon] ⚡ Auto-returned to real feed');
                }, 300);
            }
            
            // Clear alert after 2 seconds
            setTimeout(() => {
                alertOverlay.classList.remove('active');
            }, 2000);
        }

        function playAlertSound() {
            // Simple beep using Web Audio API
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.2);
        }

        function playVoiceLine() {
            // Simulate voice line using Web Speech API
            const utterance = new SpeechSynthesisUtterance('あ、すいません、ミュートが外れなくて');
            utterance.lang = 'ja-JP';
            utterance.rate = 1.2;
            utterance.pitch = 0.9;
            utterance.volume = 0.6;
            
            window.speechSynthesis.speak(utterance);
            console.log('[Voice Line] Spoke: 「あ、すいません、ミュートが外れなくて」');
        }

        // ===== AUTO RETURN =====
        function toggleAutoReturn() {
            STATE.autoReturn = !STATE.autoReturn;
            document.getElementById('autoReturnSwitch').classList.toggle('active');
            
            const status = STATE.autoReturn 
                ? 'トリガー検知で自動復帰' 
                : '手動復帰モード';
            
            updateStatus(status, STATE.autoReturn ? 'active' : 'normal', 'auto-return');
            console.log(`[Auto Return] ${STATE.autoReturn ? '✓ Enabled' : '⏹ Disabled'}`);
        }

        function toggleVoiceLine() {
            STATE.voiceLine = !STATE.voiceLine;
            document.getElementById('voiceLineSwitch').classList.toggle('active');
            console.log(`[Voice Line] ${STATE.voiceLine ? '✓ Enabled' : '⏹ Disabled'}`);
        }

        // ===== TRIGGER WORDS MANAGEMENT =====
        function addTriggerWord() {
            const input = document.getElementById('newTriggerInput');
            const word = input.value.trim();
            
            if (!word) return;
            if (STATE.triggerWords.includes(word)) {
                console.warn('Word already exists:', word);
                return;
            }
            
            STATE.triggerWords.push(word);
            input.value = '';
            updateTriggerWordsList();
            console.log('[Trigger Words] Added:', word);
        }

        function removeTriggerWord(word) {
            STATE.triggerWords = STATE.triggerWords.filter(w => w !== word);
            updateTriggerWordsList();
            console.log('[Trigger Words] Removed:', word);
        }

        function updateTriggerWordsList() {
            const list = document.getElementById('triggerWordsList');
            list.innerHTML = '';
            
            STATE.triggerWords.forEach(word => {
                const item = document.createElement('div');
                item.className = 'trigger-word-item';
                item.innerHTML = `
                    <span>${word}</span>
                    <button onclick="removeTriggerWord('${word}')">✕</button>
                `;
                list.appendChild(item);
            });
        }

        // ===== EMERGENCY STOP =====
        function emergencyStop() {
            console.log('[Emergency] 🛑 All systems halting...');
            
            STATE.ghostActive = false;
            STATE.audioActive = false;
            STATE.autoReturn = false;
            
            // Reset UI
            document.getElementById('toggleGhost').textContent = '🎭 影武者ON';
            document.getElementById('toggleGhost').style.background = 'linear-gradient(135deg, rgba(100, 200, 255, 0.5) 0%, rgba(167, 139, 250, 0.3) 100%)';
            document.getElementById('ghostSwitch').classList.remove('active');
            document.getElementById('audioSwitch').classList.remove('active');
            document.getElementById('autoReturnSwitch').classList.remove('active');
            document.getElementById('ghostIndicator').classList.remove('active');
            
            // Stop all processes
            stopAudioRecognition();
            manualReturn(true);
            
            updateStatus('🛑 すべてのシステムが停止しました', 'error');
            console.log('[Emergency] ✓ Emergency stop complete');
        }

        // ===== UI UTILITIES =====
        function updateStatus(text, type = 'normal', target = null) {
            const statusElement = document.getElementById('systemStatus');
            const statusDot = document.getElementById('systemStatusDot');
            
            if (statusElement) {
                statusElement.textContent = text;
            }
            
            if (statusDot) {
                statusDot.className = 'status-dot';
                if (type === 'active') {
                    statusDot.classList.remove('inactive');
                } else if (type === 'error') {
                    statusDot.classList.add('inactive');
                    statusDot.style.background = '#ff6464';
                } else {
                    statusDot.classList.add('inactive');
                }
            }
            
            // Update specific status text
            if (target === 'ghost') {
                const ghostStatus = document.getElementById('ghostStatus');
                if (ghostStatus) ghostStatus.textContent = text;
            } else if (target === 'audio') {
                const audioStatus = document.getElementById('audioStatus');
                if (audioStatus) audioStatus.textContent = text;
            } else if (target === 'auto-return') {
                const autoReturnStatus = document.getElementById('autoReturnStatus');
                if (autoReturnStatus) autoReturnStatus.textContent = text;
            }
        }

        function openSettings() {
            document.getElementById('settingsModal').classList.add('active');
        }

        function closeSettings() {
            document.getElementById('settingsModal').classList.remove('active');
        }

        function saveSettings() {
            STATE.debugMode = document.getElementById('debugMode').checked;
            console.log('[Settings] Saved. Debug mode:', STATE.debugMode);
            closeSettings();
        }

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // ===== START =====
        window.addEventListener('load', initialize);
        console.log('=== Phase 2: Ghost Twin & Name Summon - Loaded ===');