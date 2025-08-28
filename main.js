document.addEventListener('DOMContentLoaded', () => {
    // --- 主要な要素を取得 ---
    const loader = document.getElementById('loader');
    const loaderMessage = document.getElementById('loader-message');
    const sceneEl = document.querySelector('a-scene');
    const targetEntity = document.querySelector('[mindar-image-target]');

    // --- 設定項目 ---
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    // ファイルパスの書き方を修正しました。
    const AUDIO_FILE_PATH = 'audio/hanabi_sound_40s.mp3'; // './' を削除
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    // --- Web Audio APIの準備 ---
    let audioContext;
    let audioBuffer;
    let sourceNode;
    let bitcrusherNode;
    let decayInterval;
    let isAudioReady = false;

    // --- 音響劣化システムの初期化 ---
    const initAudioSystem = async () => {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 音源ファイルを非同期で読み込む
            const response = await fetch(AUDIO_FILE_PATH);
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            isAudioReady = true;
            console.log("音源の準備が完了しました。");

        } catch (e) {
            console.error('音響システムの初期化に失敗しました:', e);
            throw new Error('音源の読み込みに失敗しました。ファイルパスが正しいか確認してください。');
        }
    };

    // --- AR体験を開始する関数 ---
    const startExperience = async () => {
        loader.classList.add('is-loading');
        loaderMessage.textContent = 'LOADING...';

        try {
            // 音響システムの初期化を待つ
            await initAudioSystem();

            // ARを開始
            loader.classList.add('hidden');
            sceneEl.classList.add('visible');
            await sceneEl.systems['mindar-image-system'].start();

        } catch (error) {
            console.error("初期化エラー:", error);
            loader.classList.remove('is-loading');
            loaderMessage.innerHTML = `ERROR<br><small>${error.message}</small>`;
        }
    };

    // 画面全体をクリックした時に一度だけ実行
    loader.addEventListener('click', startExperience, { once: true });

    // --- 音の劣化体験を開始/停止する関数 ---
    const startDecayExperience = () => {
        if (!isAudioReady || !audioBuffer) return;
        
        // 既存の再生があれば停止
        stopDecayExperience();

        // --- ★毎回違う壊れ方にするためのランダム設定（40秒版）★ ---
        const decayDuration = 30 + Math.random() * 10; // 劣化にかかる時間 (30〜40秒に調整)
        const finalBitDepth = 1 + Math.random() * 2;   // 最終的なビット深度 (1〜3)
        const finalNormFreq = 0.05 + Math.random() * 0.1; // 最終的な周波数 (0.05〜0.15)
        
        // --- 音源とエフェクトを接続 ---
        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        bitcrusherNode = createBitcrusherNode(audioContext);
        sourceNode.connect(bitcrusherNode);
        bitcrusherNode.connect(audioContext.destination);

        // --- 時間をかけて徐々に音を壊していく処理 ---
        const initialBits = 16;
        const initialNormFreq = 1.0;
        let elapsedTime = 0;
        const updateInterval = 100;

        bitcrusherNode.bits = initialBits;
        bitcrusherNode.normfreq = initialNormFreq;

        decayInterval = setInterval(() => {
            elapsedTime += updateInterval / 1000;
            const progress = Math.min(elapsedTime / decayDuration, 1.0);
            const easedProgress = 1 - Math.pow(1 - progress, 3);

            bitcrusherNode.bits = initialBits - (initialBits - finalBitDepth) * easedProgress;
            bitcrusherNode.normfreq = initialNormFreq - (initialNormFreq - finalNormFreq) * easedProgress;

            if (progress >= 1.0) {
                clearInterval(decayInterval);
            }
        }, updateInterval);
        
        sourceNode.start(0);
        console.log("音の劣化体験を開始");
    };

    const stopDecayExperience = () => {
        if (sourceNode) {
            sourceNode.stop();
            sourceNode = null;
        }
        if (decayInterval) {
            clearInterval(decayInterval);
            decayInterval = null;
        }
        console.log("音の劣化体験を停止");
    };

    // --- ARターゲットの検出・消失イベント ---
    targetEntity.addEventListener("targetFound", () => {
        console.log("ターゲット発見！");
        startDecayExperience();
    });

    targetEntity.addEventListener("targetLost", () => {
        console.log("ターゲット消失。");
        stopDecayExperience();
    });

    // --- ビットクラッシャー（音を壊す装置）を作成する関数 ---
    function createBitcrusherNode(context) {
        const bufferSize = 4096;
        const node = context.createScriptProcessor(bufferSize, 1, 1);
        node.bits = 8; 
        node.normfreq = 1;
        let step = 0;
        let lastValue = 0;
        
        node.onaudioprocess = function(e) {
            const input = e.inputBuffer.getChannelData(0);
            const output = e.outputBuffer.getChannelData(0);
            const phaserStep = Math.pow(2, node.bits);

            for (let i = 0; i < bufferSize; i++) {
                step += node.normfreq;
                if (step >= 1.0) {
                    step -= 1.0;
                    lastValue = phaserStep * Math.floor((input[i] + 1) / 2 * phaserStep) / phaserStep - 0.5;
                }
                output[i] = lastValue;
            }
        };
        return node;
    }
});
