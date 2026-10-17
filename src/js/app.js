// ===== Audio Degrader Module =====
        class AudioDegrader {
            constructor(audioContext) {
                this.audioContext = audioContext;
                this.isActive = false;
                this.degradationLevel = 0; // 0-1
                this.setupNodes();
            }

            setupNodes() {
                // ソース（マイク入力をシミュレート）
                this.sourceNode = this.audioContext.createOscillator();
                this.sourceNode.frequency.value = 440;
                
                // 圧縮器
                this.compressor = this.audioContext.createDynamicsCompressor();
                this.compressor.threshold.value = -50;
                this.compressor.knee.value = 40;
                this.compressor.ratio.value = 12;
                this.compressor.attack.value = 0.003;
                this.compressor.release.value = 0.25;

                // ロー＆ハイパスフィルタ（電話回線化）
                this.lowPass = this.audioContext.createBiquadFilter();
                this.lowPass.type = 'lowpass';
                this.lowPass.frequency.value = 8000;

                this.highPass = this.audioContext.createBiquadFilter();
                this.highPass.type = 'highpass';
                this.highPass.frequency.value = 200;

                // ゲイン
                this.masterGain = this.audioContext.createGain();
                this.masterGain.gain.value = 0.0; // 実際のテストでは0で無音

                // グラフ接続：オシレータ → 圧縮 → ハイパス → ロー → マスター → 出力
                this.sourceNode.connect(this.compressor);
                this.compressor.connect(this.highPass);
                this.highPass.connect(this.lowPass);
                this.lowPass.connect(this.masterGain);
                // this.masterGain.connect(this.audioContext.destination);
            }

            setDegradationLevel(level) {
                // 0 = 清晰, 1 = 完全崩壊
                this.degradationLevel = Math.max(0, Math.min(1, level));

                // ロー周波数を低下させる
                this.lowPass.frequency.value = 8000 - (this.degradationLevel * 7900);

                // ハイゲイン圧縮
                this.compressor.ratio.value = 12 + this.degradationLevel * 30;
            }

            start() {
                if (!this.isActive) {
                    this.sourceNode.start();
                    this.isActive = true;
                }
            }

            stop() {
                if (this.isActive) {
                    this.sourceNode.stop();
                    this.isActive = false;
                }
            }
        }

        // ===== Video Degrader Module =====
        class VideoDegrader {
            constructor(canvas) {
                this.canvas = canvas;
                this.ctx = canvas.getContext('2d');
                this.isActive = false;
                this.degradationLevel = 0; // 0-1
                this.frameSkipCounter = 0;
                this.targetFps = 60;
                this.frameCount = 0;
                this.lastTime = Date.now();
            }

            drawTestPattern() {
                const { width, height } = this.canvas;
                
                // グラデーション背景
                const gradient = this.ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, '#1a1a2e');
                gradient.addColorStop(1, '#16213e');
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(0, 0, width, height);

                // テキスト
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 24px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('Calamity Conductor', width / 2, height / 2 - 30);

                this.ctx.font = '14px Arial';
                this.ctx.fillText(`Degradation: ${(this.degradationLevel * 100).toFixed(0)}%`, width / 2, height / 2 + 20);
            }

            applyGlitch() {
                const { width, height } = this.canvas;
                const imageData = this.ctx.getImageData(0, 0, width, height);
                const data = imageData.data;

                // RGB分離ノイズ
                if (this.degradationLevel > 0.3) {
                    for (let i = 0; i < data.length; i += 4) {
                        if (Math.random() < this.degradationLevel * 0.3) {
                            const shift = Math.floor(this.degradationLevel * 10);
                            data[i] = Math.max(0, Math.min(255, data[i] + (Math.random() - 0.5) * shift));
                            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (Math.random() - 0.5) * shift));
                            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (Math.random() - 0.5) * shift));
                        }
                    }
                }

                // ブロックノイズ
                if (this.degradationLevel > 0.5) {
                    const blockSize = Math.floor(8 + this.degradationLevel * 16);
                    for (let y = 0; y < height; y += blockSize) {
                        for (let x = 0; x < width; x += blockSize) {
                            if (Math.random() < this.degradationLevel * 0.4) {
                                const index = (y * width + x) * 4;
                                const r = data[index];
                                const g = data[index + 1];
                                const b = data[index + 2];
                                for (let by = 0; by < blockSize; by++) {
                                    for (let bx = 0; bx < blockSize; bx++) {
                                        const bidx = ((y + by) * width + (x + bx)) * 4;
                                        if (bidx < data.length) {
                                            data[bidx] = r;
                                            data[bidx + 1] = g;
                                            data[bidx + 2] = b;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                this.ctx.putImageData(imageData, 0, 0);
            }

            setDegradationLevel(level) {
                this.degradationLevel = Math.max(0, Math.min(1, level));

                // FPS計算
                if (this.degradationLevel < 0.25) {
                    this.targetFps = 30;
                } else if (this.degradationLevel < 0.5) {
                    this.targetFps = 15;
                } else if (this.degradationLevel < 0.75) {
                    this.targetFps = 8;
                } else {
                    this.targetFps = 3;
                }
            }

            update() {
                this.frameSkipCounter++;
                const skipThreshold = Math.max(1, Math.floor(60 / this.targetFps));

                if (this.frameSkipCounter >= skipThreshold) {
                    this.frameSkipCounter = 0;

                    this.drawTestPattern();
                    this.applyGlitch();

                    this.frameCount++;
                    const now = Date.now();
                    if (now - this.lastTime >= 1000) {
                        // FPS更新は別途
                        this.lastTime = now;
                    }
                }
            }

            getCurrentFps() {
                return this.targetFps;
            }
        }

        // ===== Calamity Timeline Controller =====
        class CalamityTimeline {
            constructor(duration = 90000) {
                this.duration = duration; // ミリ秒
                this.startTime = null;
                this.isRunning = false;
                this.currentPhase = 0;
                this.degradationLevel = 0;
                this.audioSpeedMultiplier = 1;
                this.onPhaseChange = null;
                this.onUpdate = null;
                this.onComplete = null;
            }

            start() {
                this.startTime = Date.now();
                this.isRunning = true;
            }

            stop() {
                this.isRunning = false;
                this.startTime = null;
            }

            update() {
                if (!this.isRunning) return;

                const elapsed = Date.now() - this.startTime;
                const progress = Math.min(elapsed / this.duration, 1);

                // 段階的フェーズ判定
                let newPhase = 0;
                if (progress < 0.333) {
                    newPhase = 1; // 微細ノイズ期
                } else if (progress < 0.666) {
                    newPhase = 2; // 本格劣化期
                } else if (progress < 0.9) {
                    newPhase = 3; // 臨界崩壊期
                } else {
                    newPhase = 4; // ゴースト着地
                }

                if (newPhase !== this.currentPhase) {
                    this.currentPhase = newPhase;
                    if (this.onPhaseChange) {
                        this.onPhaseChange(newPhase);
                    }
                }

                // 劣化レベルは進捗に応じて増加
                this.degradationLevel = progress;

                if (this.onUpdate) {
                    this.onUpdate({
                        progress,
                        phase: newPhase,
                        elapsed,
                        duration: this.duration
                    });
                }

                // 完了判定
                if (progress >= 1) {
                    this.isRunning = false;
                    if (this.onComplete) {
                        this.onComplete();
                    }
                }
            }

            getProgress() {
                if (!this.isRunning) return 0;
                const elapsed = Date.now() - this.startTime;
                return Math.min(elapsed / this.duration, 1);
            }

            getPhaseName(phase) {
                const names = ['待機', '微細ノイズ期', '本格劣化期', '臨界崩壊期', 'ゴースト着地'];
                return names[phase] || '不明';
            }
        }

        // ===== Main Controller =====
        class CalamityConductor {
            constructor() {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.audioDegrader = new AudioDegrader(this.audioContext);
                
                this.mainCanvas = document.getElementById('mainVideoCanvas');
                this.previewCanvas = document.getElementById('previewCanvas');
                
                // リサイズ
                const rect = this.mainCanvas.parentElement.getBoundingClientRect();
                this.mainCanvas.width = rect.width;
                this.mainCanvas.height = rect.height * 0.9;
                
                this.previewCanvas.width = 320;
                this.previewCanvas.height = 180;

                this.videoDegrader = new VideoDegrader(this.mainCanvas);
                this.previewDegrader = new VideoDegrader(this.previewCanvas);

                this.timeline = null;
                this.isSequenceActive = false;

                this.setupEventListeners();
                this.startAnimationLoop();
            }

            setupEventListeners() {
                // ボタン
                document.getElementById('startCalamityBtn').addEventListener('click', () => this.startSequence());
                document.getElementById('stopCalamityBtn').addEventListener('click', () => this.stopSequence());
                document.getElementById('copyMessageBtn').addEventListener('click', () => this.copyMessage());
                document.getElementById('modalCloseBtn').addEventListener('click', () => this.closeModal());

                // スライダー
                document.getElementById('durationSlider').addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    document.getElementById('durationValue').textContent = value + '秒';
                });

                document.getElementById('audioSpeedSlider').addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    const labels = ['遅延', '標準', '高速'];
                    document.getElementById('audioSpeedValue').textContent = labels[value - 1];
                });

                // ホットキー
                document.addEventListener('keydown', (e) => {
                    if (e.altKey && e.key === 'd') {
                        e.preventDefault();
                        if (this.isSequenceActive) {
                            this.stopSequence();
                        } else {
                            this.startSequence();
                        }
                    }
                    if (e.code === 'Space') {
                        if (this.isSequenceActive) {
                            e.preventDefault();
                            this.stopSequence();
                        }
                    }
                });
            }

            startSequence() {
                if (this.isSequenceActive) return;

                const durationSec = parseInt(document.getElementById('durationSlider').value);
                const durationMs = durationSec * 1000;

                this.timeline = new CalamityTimeline(durationMs);

                this.timeline.onPhaseChange = (phase) => {
                    document.getElementById('currentPhase').innerHTML = 
                        `<span class="phase-indicator">${this.timeline.getPhaseName(phase)}</span>`;
                };

                this.timeline.onUpdate = (data) => {
                    document.getElementById('elapsedTime').textContent = 
                        (data.elapsed / 1000).toFixed(1) + 's';
                    document.getElementById('sequenceProgress').style.width = 
                        (data.progress * 100) + '%';
                    document.getElementById('degradationLevel').textContent = 
                        (data.progress * 100).toFixed(0) + '%';

                    // リップシンク遅延を計算
                    const lipSyncMs = Math.round(data.progress * 800);
                    document.getElementById('lipSyncValue').textContent = lipSyncMs + 'ms';

                    // 音声品質ステータス
                    let audioStatus = '清晰';
                    if (data.progress > 0.25) audioStatus = '軽微な乱れ';
                    if (data.progress > 0.5) audioStatus = 'ロボット化';
                    if (data.progress > 0.75) audioStatus = '引き延ばし音';
                    document.getElementById('audioQuality').textContent = audioStatus;

                    this.videoDegrader.setDegradationLevel(data.progress);
                    this.previewDegrader.setDegradationLevel(data.progress);
                };

                this.timeline.onComplete = () => {
                    this.handleSequenceComplete();
                };

                this.isSequenceActive = true;
                this.timeline.start();

                document.getElementById('startCalamityBtn').disabled = true;
                document.getElementById('stopCalamityBtn').disabled = false;
                document.getElementById('statusText').textContent = '進行中';
                document.getElementById('statusText').style.color = '#ff9800';

                this.showToast('通信崩壊シーケンス開始', 'warning');
            }

            stopSequence() {
                if (!this.isSequenceActive) return;

                this.timeline.stop();
                this.isSequenceActive = false;

                document.getElementById('startCalamityBtn').disabled = false;
                document.getElementById('stopCalamityBtn').disabled = true;
                document.getElementById('statusText').textContent = '待機中';
                document.getElementById('statusText').style.color = '#4caf50';

                document.getElementById('sequenceProgress').style.width = '0%';
                document.getElementById('degradationLevel').textContent = '0%';
                document.getElementById('currentPhase').innerHTML = 
                    '<span class="phase-indicator">待機</span>';

                this.showToast('シーケンス停止', 'warning');
            }

            handleSequenceComplete() {
                this.isSequenceActive = false;

                document.getElementById('startCalamityBtn').disabled = false;
                document.getElementById('stopCalamityBtn').disabled = true;
                document.getElementById('statusText').textContent = '完了';
                document.getElementById('statusText').style.color = '#4caf50';

                // フリーズ状態をシミュレート
                this.mainCanvas.style.filter = 'grayscale(1) brightness(0.7)';

                this.showToast('通信崩壊完了！', 'success');
                this.showCompleteModal();
            }

            copyMessage() {
                const message = 'すみません、Wi-Fiが限界なので一度ルーター再起動してきます';
                navigator.clipboard.writeText(message).then(() => {
                    this.showToast('メッセージをコピーしました', 'success');
                }).catch(() => {
                    this.showToast('コピーに失敗しました', 'warning');
                });
            }

            showCompleteModal() {
                document.getElementById('completeModal').classList.add('active');
            }

            closeModal() {
                document.getElementById('completeModal').classList.remove('active');
                this.mainCanvas.style.filter = '';
            }

            showToast(message, type = 'info') {
                const toast = document.createElement('div');
                toast.className = 'toast ' + type;
                toast.textContent = message;
                document.body.appendChild(toast);

                setTimeout(() => {
                    toast.style.animation = 'slideInUp 0.3s ease-out reverse';
                    setTimeout(() => toast.remove(), 300);
                }, 2000);
            }

            startAnimationLoop() {
                const animate = () => {
                    if (this.timeline && this.timeline.isRunning) {
                        this.timeline.update();
                    }

                    this.videoDegrader.update();
                    this.previewDegrader.update();

                    document.getElementById('fpsCounter').textContent = 
                        this.videoDegrader.getCurrentFps();

                    requestAnimationFrame(animate);
                };
                animate();
            }
        }

        // ===== Initialize =====
        let conductor;
        document.addEventListener('DOMContentLoaded', () => {
            conductor = new CalamityConductor();
        });