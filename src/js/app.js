// グローバル状態
        let isDeepFreezing = false;
        let isWorkHardRunning = false;
        let isBossSensorActive = false;
        let escapeCount = 0;
        let lastEscapeTime = 0;
        let escapeTimeout = null;

        // 画面表示更新
        function updateStatus(elementId, value, isActive = false) {
            const elem = document.getElementById(elementId);
            if (elem) {
                elem.textContent = value;
                if (isActive) {
                    elem.classList.add('active');
                } else {
                    elem.classList.remove('active');
                }
            }
        }

        // メッセージ表示
        function showMessage(text, duration = 3000) {
            const msg = document.getElementById('successMessage');
            msg.textContent = text;
            msg.classList.add('show');
            setTimeout(() => msg.classList.remove('show'), duration);
        }

        // ========== F-01: DeepFreeze ==========
        function activateDeepFreeze() {
            if (isDeepFreezing) return;
            isDeepFreezing = true;

            updateStatus('packetStatus', 'FREEZING...', true);
            showMessage('📡 パケットロス偽装を開始します...');

            const videoFrame = document.getElementById('videoFrame');
            videoFrame.innerHTML = '<span style="animation: glitch; color: #ff006e;">⚠️ 接続不安定...</span>';
            videoFrame.classList.add('glitch-effect');

            // ステップ1: 音声を段階的に途切れさせる
            playAudioEffect('static', 2000);

            // ステップ2: 映像をフリーズ
            setTimeout(() => {
                videoFrame.innerHTML = '<span style="font-size: 48px;">😌</span><p>接続を確認中...</p>';
                videoFrame.classList.remove('glitch-effect');
                videoFrame.classList.add('frozen-frame');
                updateStatus('packetStatus', 'FROZEN', true);
                playAudioEffect('silence', 1000);

                // ステップ3: 30秒後に自動切断
                setTimeout(() => {
                    completeDisconnection();
                }, 3000); // デモ用に3秒に短縮
            }, 2000);
        }

        // ========== F-02: PanicAudio ==========
        function playPanicAudio(preset) {
            updateStatus('emergencyStatus', 'AUDIO ALERT!', true);

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const now = audioContext.currentTime;

            if (preset === 'doorbell') {
                // インターホン連打音
                for (let i = 0; i < 5; i++) {
                    playTone(audioContext, 1000, 0.1, now + i * 0.25);
                    playTone(audioContext, 1200, 0.1, now + i * 0.25 + 0.15);
                }
                // 自分の悲鳴
                setTimeout(() => playVoiceEffect(audioContext, 'うわっ！'), 1500);
            } else if (preset === 'explosion') {
                // 爆破音：複雑な周波数の組み合わせ
                playLowFreqNoise(audioContext, now, 0.5);
                // 悲鳴を重ねる
                setTimeout(() => playVoiceEffect(audioContext, 'うわぁああ！'), 100);
            } else if (preset === 'kid') {
                // 子ども乱入音
                playVoiceEffect(audioContext, 'パパー！うんち出たー！');
            }

            setTimeout(() => {
                updateStatus('emergencyStatus', 'Standby');
                showMessage('🎤 音響効果を再生しました');
            }, 2000);
        }

        function playTone(audioContext, frequency, duration, startTime) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = frequency;
            gainNode.gain.setValueAtTime(0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
        }

        function playLowFreqNoise(audioContext, startTime, duration) {
            const bufferSize = audioContext.sampleRate * duration;
            const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            const gainNode = audioContext.createGain();
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            gainNode.gain.setValueAtTime(0.2, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            source.start(startTime);
        }

        function playVoiceEffect(audioContext, text) {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'ja-JP';
                utterance.pitch = 1.2;
                utterance.rate = 1.5;
                speechSynthesis.speak(utterance);
            }
        }

        function playAudioEffect(type, duration) {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const now = audioContext.currentTime;
                if (type === 'static') {
                    const bufferSize = audioContext.sampleRate * duration / 1000;
                    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = (Math.random() * 2 - 1) * 0.1;
                    }
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioContext.destination);
                    source.start(now);
                    source.stop(now + duration / 1000);
                }
            } catch (e) {
                console.log('Audio context error:', e);
            }
        }

        // ========== F-03: WorkHard Simulator ==========
        let keyboardInterval = null;
        let sighnInterval = null;

        function toggleWorkHardMode() {
            isWorkHardRunning = !isWorkHardRunning;
            const btn = document.getElementById('workHardBtn');
            const tip = document.getElementById('workHardTip');

            if (isWorkHardRunning) {
                btn.style.opacity = '0.6';
                btn.style.background = 'rgba(100, 200, 100, 0.8)';
                btn.textContent = 'シミュレーション中...';
                tip.textContent = '稼働中: キーボード音とため息を再生';

                updateStatus('emergencyStatus', 'WORK SIMULATION ACTIVE', true);

                // キーボード音
                keyboardInterval = setInterval(() => {
                    playKeyboardSound();
                }, Math.random() * 3000 + 1000);

                // ため息
                sighnInterval = setInterval(() => {
                    playVoiceEffect(new (window.AudioContext || window.webkitAudioContext)(), 'ふぅ…');
                }, Math.random() * 15000 + 8000);

                showMessage('⌨️ 労働シミュレーションを開始しました');
            } else {
                btn.style.opacity = '1';
                btn.style.background = 'rgba(255, 170, 0, 0.8)';
                btn.textContent = 'シミュレーション開始';
                tip.textContent = 'クリックで有効化 / ESC で停止';

                updateStatus('emergencyStatus', 'Standby');
                clearInterval(keyboardInterval);
                clearInterval(sighnInterval);
                showMessage('⌨️ シミュレーション停止');
            }
        }

        function playKeyboardSound() {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const now = audioContext.currentTime;
            // ランダムなキーボード打鍵音を生成
            for (let i = 0; i < Math.random() * 5 + 1; i++) {
                playTone(audioContext, Math.random() * 2000 + 1000, 0.05, now + i * 0.08);
            }
        }

        // ========== Boss Sensor ==========
        function toggleBossSensor() {
            isBossSensorActive = !isBossSensorActive;
            if (isBossSensorActive) {
                updateStatus('bossStatus', 'ACTIVE', true);
                document.getElementById('excelDisguise').classList.add('active');
                showMessage('👔 ボスセンサー有効化。Excel風UIに偽装しました。');
            } else {
                updateStatus('bossStatus', 'Monitoring...');
                document.getElementById('excelDisguise').classList.remove('active');
                showMessage('👔 ボスセンサー解除');
            }
        }

        // ========== 緊急脱出機能 ==========
        function emergencyAbort() {
            showMessage('🚨 緊急脱出プログラムを実行...');
            updateStatus('emergencyStatus', 'ESCAPING!', true);
            simulateDisconnect();
        }

        function simulateConnectionLoss() {
            const videoFrame = document.getElementById('videoFrame');
            videoFrame.style.filter = 'brightness(0)';
            showMessage('📡 接続が失われました');
            setTimeout(() => {
                videoFrame.style.filter = 'brightness(1)';
                completeDisconnection();
            }, 2000);
        }

        function completeDisconnection() {
            isDeepFreezing = false;
            updateStatus('packetStatus', 'Ready');
            updateStatus('zoomStatus', '接続が切れました', true);

            const videoFrame = document.getElementById('videoFrame');
            videoFrame.classList.remove('frozen-frame', 'glitch-effect');
            videoFrame.innerHTML = '<span style="color: #ff0000; font-size: 18px;">❌ CONNECTION LOST</span>';

            // 救われた時間を更新
            updateSavedTime();
            showMessage('✅ 会議から脱出しました。完全なる勝利です。');

            // 言い訳メール自動生成
            setTimeout(generateExcuseEmail, 1500);
        }

        function simulateDisconnect() {
            const videoFrame = document.getElementById('videoFrame');
            videoFrame.innerHTML = '<span style="color: #ff6666; font-weight: bold;">接続中断...</span>';
            setTimeout(() => {
                videoFrame.innerHTML = '<span style="color: #ff0000; font-size: 18px;">❌ CONNECTION LOST</span>';
                updateSavedTime();
            }, 1000);
        }

        // ========== 言い訳メール自動生成 ==========
        function generateExcuseEmail() {
            const excuses = [
                '🦅 近隣でカラスが電線に衝突したらしく、ブレーカーとルーターが同時に火を吹きました。',
                '⚡ 落雷により自宅のWiFiルーターが完全に焼け焦げました。復旧まで時間がかかります。',
                '🛰️ 何らかの衛星の落下による電波干渉が発生。復旧を試みていますが本日中は困難です。',
                '👷 近隣で突然のガス工事が開始され、あらゆる通信インフラが遮断されました。',
                '📡 ISPからの通知で、この時間帯のメンテナンスが行われるようです。申し訳ございません。'
            ];

            const excuse = excuses[Math.floor(Math.random() * excuses.length)];
            showMessage(`📧 言い訳メール送信: "${excuse}"`);

            updateStatus('zoomStatus', 'Offline - システムメンテナンス中');
        }

        // ========== Poof機能 ==========
        function activatePoof() {
            const container = document.querySelector('.container');
            container.style.opacity = '0.5';
            container.style.filter = 'blur(10px)';

            playAudioEffect('static', 500);

            setTimeout(() => {
                // 証拠隠滅
                clearLocalStorage();
                showMessage('💨 POOF! システムトレース完全削除。痕跡ゼロ。');

                setTimeout(() => {
                    container.style.opacity = '1';
                    container.style.filter = 'blur(0)';
                    updateStatus('emergencyStatus', 'Standby');
                }, 1000);
            }, 500);
        }

        function clearLocalStorage() {
            localStorage.clear();
            sessionStorage.clear();
            // Cookie削除シミュレーション
            document.cookie.split(";").forEach(c => {
                document.cookie = c.replace(/^ +/, "")
                    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
        }

        // ========== 救われた時間の計算 ==========
        let savedMinutes = 42;
        let savedSeconds = 18;

        function updateSavedTime() {
            savedMinutes += Math.floor(Math.random() * 30) + 15;
            if (savedSeconds > 60) {
                savedSeconds -= 60;
                savedMinutes += 1;
            }
            document.getElementById('savedTime').textContent = `${savedMinutes}分${savedSeconds}秒`;

            const motivations = [
                'あなたは悪くない。無駄な会議を設定した相手が悪いのです。',
                '時間は金。あなたは今、金を取り返しました。',
                'このフリーダムを全力で楽しんでください。',
                'ビールはあなたの英雄です。',
                '上司よ、申し訳ない。しかし必然だ。'
            ];
            document.getElementById('motivational').textContent = motivations[Math.floor(Math.random() * motivations.length)];
        }

        // ========== ESC キー連打検出 ==========
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const now = Date.now();
                if (now - lastEscapeTime > 500) {
                    escapeCount = 1;
                } else {
                    escapeCount++;
                }
                lastEscapeTime = now;

                clearTimeout(escapeTimeout);
                escapeTimeout = setTimeout(() => { escapeCount = 0; }, 1000);

                if (escapeCount === 3) {
                    playPanicAudio('explosion');
                    escapeCount = 0;
                }

                // WorkHardモードの停止
                if (isWorkHardRunning && escapeCount === 1) {
                    toggleWorkHardMode();
                }
            }
        });

        // ========== 初期化 ==========
        window.addEventListener('load', () => {
            updateStatus('sysStatus', '● ONLINE');
            updateStatus('zoomStatus', 'Connected');
            updateStatus('packetStatus', 'Ready');
            updateStatus('bossStatus', 'Monitoring...');
            updateStatus('emergencyStatus', 'Standby');

            // ビデオフレームの初期表示
            const videoFrame = document.getElementById('videoFrame');
            videoFrame.innerHTML = '<span style="color: #00ff9f;">📹 Connected</span>';

            showMessage('✅ システムを起動しました。会議の無意味さから解放される準備はいいですか？', 4000);
        });