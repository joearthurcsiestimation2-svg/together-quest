const firebaseConfig = {
    apiKey: "AIzaSyDK7KDuxzivTm6SskJkzzsWIe2ATqKg28A",
    authDomain: "togetherquest-9f3b7.firebaseapp.com",
    databaseURL: "https://togetherquest-9f3b7-default-rtdb.firebaseio.com/",
    projectId: "togetherquest-9f3b7",
    storageBucket: "togetherquest-9f3b7.firebasestorage.app",
    messagingSenderId: "113517858109",
    appId: "1:113517858109:web:f59b1787dbf7bce85e8954"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let playerId, myName, currentRoom, isSinglePlayer = true;
let roomRef, playerRef, chatRef, callRef;
let players = {}, activeGame = "hub", activeRaceType = "";
let countdownTimer, isGameRunning = false;
let isChatExpanded = false;

// Audio Voice Note Recording Vars
let mediaRecorder, audioChunks = [], isRecording = false;

// Real-Time Live Voice Call (WebRTC) Vars
let peerConnection, localStream, isCallActive = false;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Wheel Animation Vars
let wheelAngle = 0, isWheelSpinning = false;

// 2D Canvas Engine Vars
let canvas, ctx, animFrameId, targets = [], particles = [];
let myScore = 0, opponentScore = 0, timeRemaining = 30;

// New Games Engine State Variables
let snakePos = {x: 100, y: 100}, snakeDir = 'RIGHT', snakeFood = {x: 200, y: 200};
let pongPaddleX = 150, pongBall = {x: 200, y: 160, vx: 3, vy: 3};
let brickPaddleX = 150, bricks = [];
let bombHolder = 'p1', bombTimer = 0;
let ludoScoreP1 = 0, ludoScoreP2 = 0;
let memoryCards = [], flippedCards = [], matchedPairs = 0;

const rulesBook = {
    ttt: "Tic Tac Toe:\n- Place ❌ or ⭕ turn by turn.\n- Connect 3 horizontally, vertically, or diagonally to WIN!",
    rps: "Rock Paper Scissors:\n- Rock ✊ beats Scissors ✌️\n- Paper ✋ beats Rock ✊\n- Scissors ✌️ beats Paper ✋",
    balloon: "Balloon Pop:\n- Tap rising balloons on screen to pop them.\n- Score higher than AI / Partner before time expires!",
    hearts: "Catch Hearts:\n- Catch falling glowing hearts!\n- Hard difficulty moves targets faster.",
    coins: "Speed Coins:\n- Tap coins quickly before they vanish.",
    td: "Truth & Dare:\n- Spin the wheel when it's your turn!\n- Complete the Deep/Dark Truth or Dare challenge shown.",
    snake: "Nokia Snake Duo:\n- Use controls to guide the snake.\n- Eat red apples to score before crashing!",
    pong: "Ping Pong Battle:\n- Drag bottom paddle to reflect the ball and score points!",
    ludo: "Ludo Mini Duel:\n- Roll dice turn by turn. First to reach 15 points wins!",
    bomb: "Bomb Pass:\n- Tap 'PASS BOMB' immediately to throw the ticking bomb to opponent before explosion!",
    brick: "Brick Breaker Smash:\n- Move paddle left/right to destroy upper bricks!",
    memory: "Memory Cards Flip:\n- Flip cards to match emoji pairs!"
};

// Expanded Deep, Bold & Dark Truth & Dare Collection
const truthList = [
    "Aap ki sab se embarrassing ya secret romantic fantasy kya hai?",
    "Aap ne partner se kabhi koi boht bara jhooth bola hai? Reveal karo!",
    "Aap ka pehla crush konsa banda/bandi tha aur unmein kya pasand tha?",
    "Aap ka life ka sab se dark secret jo aap ne aj tak kisi ko nahi bataya?",
    "Agar aap ko ek raat ke liye kisi ke sath room mein lock kar diya jaye, wo kaun hoga?",
    "Aap ki life ki sab se wild ya crazy cheez jo aap ne secretly ki ho?",
    "Konsi aisi baat hai jo aap mere baare mein badalna chahte ho?",
    "Aap ne akhri baar kab aur kyun secretly rona shuru kiya tha?",
    "Aap ki sab se bari insecurity kya hai jab aap kisi ke close hotay ho?",
    "Kya aap ne kabhi secretly mera phone check karne ki koshish ki hai?"
];

const dareList = [
    "Opponent ko Voice Note par ek boht hi romantic ya flirty dialog bolo!",
    "Apni sab se bold/cute picture chat mein immediately send karo!",
    "30 seconds ke liye mic ON karke ek funny romantic song gao!",
    "Chat mein partner ki sab se ziada attractive cheez detail mein type karo!",
    "Agley 3 minutes tak partner ki har baat par 'Ji Jaan' bolna lazmi hai!",
    "Partner ko ek dark aur mysterious secret whisper style Voice Note bhejo!",
    "Phone se kisi random contact ko 'I miss you' message bhejo aur screenshot chat mein daalo!",
    "Apne room ke saare lights off karo aur 10 seconds tak funny scary sound nikalo!",
    "Opponent ko 1 minute tak bina rukay tareefon ke pul baandho!",
    "Camera se apni eye ya lips ki close-up photo le kar chat mein send karo!"
];

function toggleRoomInput() {
    const mode = document.getElementById('gameModeType').value;
    const roomInp = document.getElementById('roomCode');
    if (mode === 'multi') roomInp.classList.remove('hidden');
    else roomInp.classList.add('hidden');
}

window.addEventListener('load', () => {
    toggleRoomInput();
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', handleCanvasClick);
    canvas.addEventListener('pointermove', handleCanvasMove);

    const savedSession = sessionStorage.getItem('tq_session');
    if (savedSession) {
        const data = JSON.parse(savedSession);
        myName = data.name; currentRoom = data.room;
        isSinglePlayer = data.isSingle; playerId = data.id;

        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('hub-screen').classList.remove('hidden');
        document.getElementById('welcome-msg').innerText = `Welcome ${myName}!`;
        document.getElementById('chat-widget').classList.remove('hidden');

        if (!isSinglePlayer) attachFirebaseListeners();
    }
});

document.getElementById('joinBtn').addEventListener('click', () => {
    myName = document.getElementById('playerName').value.trim();
    currentRoom = document.getElementById('roomCode').value.trim();
    isSinglePlayer = document.getElementById('gameModeType').value === 'single';

    if (!myName || (!isSinglePlayer && !currentRoom)) {
        alert("Please enter all required details!");
        return;
    }

    playerId = 'p_' + Math.random().toString(36).substr(2, 5);
    sessionStorage.setItem('tq_session', JSON.stringify({
        name: myName, room: currentRoom, isSingle: isSinglePlayer, id: playerId
    }));

    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('hub-screen').classList.remove('hidden');
    document.getElementById('welcome-msg').innerText = `Welcome ${myName}!`;
    document.getElementById('chat-widget').classList.remove('hidden');

    if (isSinglePlayer) {
        players[playerId] = { name: myName, score: 0 };
        players['bot'] = { name: "Smart AI 🤖", score: 0 };
    } else {
        attachFirebaseListeners();
    }
});

function attachFirebaseListeners() {
    roomRef = database.ref('arcadeRooms/' + currentRoom);
    playerRef = roomRef.child('players').child(playerId);
    chatRef = roomRef.child('chat');
    callRef = roomRef.child('callSignals');

    playerRef.set({ id: playerId, name: myName, score: 0 });
    playerRef.onDisconnect().remove();

    roomRef.child('players').on('value', (snapshot) => {
        players = snapshot.val() || {};
        const pKeys = Object.keys(players);
        document.getElementById('hub-status').innerText = pKeys.length === 2 
            ? "Partner Connected! 🔥" 
            : "Waiting for partner...";
        updateRaceScoreboard();
        if(activeGame === 'rps') checkRPSResult();
    });

    roomRef.child('activeScreen').on('value', (snapshot) => {
        const screen = snapshot.val();
        if (screen && screen !== activeGame) switchLayout(screen);
    });

    roomRef.child('ttt').on('value', (snapshot) => {
        if (activeGame === 'ttt' && snapshot.exists()) {
            const data = snapshot.val();
            renderTTTBoard(data.board || Array(9).fill(""));
            evaluateTTT(data.board || Array(9).fill(""), data.turn);
        }
    });

    chatRef.on('child_added', (snapshot) => {
        const msg = snapshot.val();
        appendChatMessage(msg.sender, msg.text, msg.audio, msg.image);
    });

    chatRef.on('child_removed', () => {
        const box = document.getElementById('chat-messages');
        box.innerHTML = `<div class="chat-msg"><b>System:</b> Chat history cleared!</div>`;
    });

    setupCallSignaling();
}

function openGame(gameType) {
    if (!isSinglePlayer && Object.keys(players).length < 2) {
        alert("Waiting for partner!");
        return;
    }
    if (!isSinglePlayer) roomRef.update({ activeScreen: gameType });
    else switchLayout(gameType);
}

function switchLayout(screen) {
    activeGame = screen;
    document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('canvas-controls').style.display = 'none';

    if (screen === 'hub') {
        document.getElementById('hub-screen').classList.remove('hidden');
        isGameRunning = false;
        cancelAnimationFrame(animFrameId);
        return;
    }

    if (['balloon', 'hearts', 'coins', 'snake', 'pong', 'brick'].includes(screen)) {
        activeRaceType = screen;
        document.getElementById('game-race').classList.remove('hidden');
        document.getElementById('race-title').innerText = screen.toUpperCase() + " ARENA";
        if (screen === 'snake') document.getElementById('canvas-controls').style.display = 'flex';
    } else {
        document.getElementById(`game-${screen}`).classList.remove('hidden');
    }

    startPrepCountdown(() => {
        isGameRunning = true;
        if (screen === 'ttt') initTTT();
        if (['balloon', 'hearts', 'coins'].includes(screen)) initGraphicsEngine(screen);
        if (screen === 'snake') initSnakeEngine();
        if (screen === 'pong') initPongEngine();
        if (screen === 'brick') initBrickEngine();
        if (screen === 'memory') initMemoryGame();
        if (screen === 'ludo') initLudoGame();
        if (screen === 'bomb') initBombGame();
        if (screen === 'td') initTDGame();
    });
}

function startPrepCountdown(callback) {
    const overlay = document.getElementById('countdown-overlay');
    overlay.classList.remove('hidden');
    let count = 3;
    overlay.innerText = count;

    const timer = setInterval(() => {
        count--;
        if (count > 0) overlay.innerText = count;
        else if (count === 0) overlay.innerText = "GO!";
        else {
            clearInterval(timer);
            overlay.classList.add('hidden');
            callback();
        }
    }, 800);
}

function triggerGameEnd(didIWin, message) {
    isGameRunning = false;
    clearInterval(countdownTimer);
    cancelAnimationFrame(animFrameId);

    const modal = document.getElementById('result-modal');
    const title = document.getElementById('modal-status-title');
    const desc = document.getElementById('modal-desc');

    modal.classList.remove('hidden');
    if (didIWin === "tie") {
        title.innerText = "IT'S A DRAW! 🤝";
        title.className = "modal-title";
        title.style.color = "#ffeaa7";
    } else if (didIWin === true) {
        title.innerText = "VICTORY! 🎉";
        title.className = "modal-title win-title";
    } else {
        title.innerText = "DEFEAT! 💔";
        title.className = "modal-title lose-title";
    }
    desc.innerText = message || "";
}

function requestReplay() {
    document.getElementById('result-modal').classList.add('hidden');
    openGame(activeGame);
}

function backToHub() {
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('rules-modal').classList.add('hidden');
    
    isGameRunning = false;
    clearInterval(countdownTimer);
    cancelAnimationFrame(animFrameId);

    if (!isSinglePlayer && roomRef) {
        roomRef.update({ activeScreen: 'hub' });
    } else {
        switchLayout('hub');
    }
}

function exitToMainMenu() {
    if (confirm("Kya aap Arcade Hub se bahar nikal kar Main Menu par jana chahte hain?")) {
        sessionStorage.removeItem('tq_session');

        if (!isSinglePlayer && roomRef && playerRef) {
            playerRef.remove();
        }

        isGameRunning = false;
        clearInterval(countdownTimer);
        cancelAnimationFrame(animFrameId);

        document.getElementById('result-modal').classList.add('hidden');
        document.getElementById('rules-modal').classList.add('hidden');
        document.getElementById('chat-widget').classList.add('hidden');

        document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
        document.getElementById('lobby-screen').classList.remove('hidden');
    }
}

function showRules(type) {
    document.getElementById('rules-text').innerText = rulesBook[type] || "Play fair & enjoy!";
    document.getElementById('rules-modal').classList.remove('hidden');
}
function closeRules() { document.getElementById('rules-modal').classList.add('hidden'); }

// ==================== [1] TIC TAC TOE ====================
function initTTT() {
    renderTTTBoard(Array(9).fill(""));
    if (!isSinglePlayer) roomRef.child('ttt').set({ board: Array(9).fill(""), turn: Object.keys(players)[0] });
    else document.getElementById('ttt-status').innerText = "Your Turn! ⚡";
}

function playTTT(idx) {
    if (!isGameRunning) return;
    if (isSinglePlayer) {
        let cells = document.querySelectorAll('#game-ttt .cell');
        if (cells[idx].innerText !== "") return;
        cells[idx].innerText = "❌";
        
        if (checkTTTLocalWin("❌")) return triggerGameEnd(true, "You defeated Smart AI!");
        if (checkTTTFull()) return triggerGameEnd("tie", "Match Tied!");

        document.getElementById('ttt-status').innerText = "AI thinking... 🤔";
        const diff = document.getElementById('difficultySelect').value;
        const delay = diff === 'easy' ? 900 : diff === 'medium' ? 600 : 350;

        setTimeout(() => {
            if(!isGameRunning) return;
            let emptyIdxs = [];
            cells.forEach((c, i) => { if(c.innerText === "") emptyIdxs.push(i); });
            if(emptyIdxs.length === 0) return;
            
            let aiPick;
            if (diff === 'hard') {
                const mistakeChance = Math.random() < 0.25;
                aiPick = (!mistakeChance && (findWinningMove(cells, "⭕") ?? findWinningMove(cells, "❌"))) ?? emptyIdxs[Math.floor(Math.random() * emptyIdxs.length)];
            } else {
                aiPick = emptyIdxs[Math.floor(Math.random() * emptyIdxs.length)];
            }

            cells[aiPick].innerText = "⭕";
            if (checkTTTLocalWin("⭕")) triggerGameEnd(false, "AI Outsmarted You!");
            else if (checkTTTFull()) triggerGameEnd("tie", "Match Tied!");
            else document.getElementById('ttt-status').innerText = "Your Turn! ⚡";
        }, delay);
    } else {
        roomRef.child('ttt').once('value', snapshot => {
            const data = snapshot.val() || {};
            if (data.turn !== playerId) return;
            let b = data.board || Array(9).fill("");
            if (b[idx] !== "") return;
            const pKeys = Object.keys(players);
            b[idx] = pKeys[0] === playerId ? "❌" : "⭕";
            roomRef.child('ttt').update({ board: b, turn: pKeys[0] === playerId ? pKeys[1] : pKeys[0] });
        });
    }
}

function findWinningMove(cells, symbol) {
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (let w of wins) {
        let vals = w.map(i => cells[i].innerText);
        if (vals.filter(v => v === symbol).length === 2 && vals.includes("")) return w[vals.indexOf("")];
    }
    return null;
}

function renderTTTBoard(b) {
    document.querySelectorAll('#game-ttt .cell').forEach((c, i) => c.innerText = b[i] || "");
}

function evaluateTTT(b, turn) {
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (let p of wins) {
        if (b[p[0]] && b[p[0]] === b[p[1]] && b[p[0]] === b[p[2]]) {
            const pKeys = Object.keys(players);
            triggerGameEnd(b[p[0]] === (pKeys[0] === playerId ? "❌" : "⭕"), "3-in-a-row completed!");
            return;
        }
    }
    if (!b.includes("")) triggerGameEnd("tie", "Board full!");
    else document.getElementById('ttt-status').innerText = turn === playerId ? "Your Turn! ⚡" : "Opponent Turn... 💭";
}

function checkTTTLocalWin(m) {
    const b = Array.from(document.querySelectorAll('#game-ttt .cell')).map(c => c.innerText);
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return wins.some(p => b[p[0]] === m && b[p[1]] === m && b[p[2]] === m);
}

function checkTTTFull() {
    return Array.from(document.querySelectorAll('#game-ttt .cell')).every(c => c.innerText !== "");
}

// ==================== [2] ROCK PAPER SCISSORS ====================
function playRPS(move) {
    if(!isGameRunning) return;
    if (isSinglePlayer) {
        const moves = ['✊', '✋', '✌️'];
        const aiMove = moves[Math.floor(Math.random() * 3)];
        if (move === aiMove) triggerGameEnd("tie", `Both chose ${move}`);
        else if ((move==='✊'&&aiMove==='✌️')||(move==='✋'&&aiMove==='✊')||(move==='✌️'&&aiMove==='✋')) triggerGameEnd(true, `You: ${move} vs AI: ${aiMove}`);
        else triggerGameEnd(false, `You: ${move} vs AI: ${aiMove}`);
    } else {
        playerRef.update({ currentMove: move });
        document.getElementById('rps-status').innerText = "Move Locked! 🔒 Waiting for opponent...";
    }
}

function checkRPSResult() {
    const pKeys = Object.keys(players); if(pKeys.length < 2) return;
    const p1 = players[pKeys[0]], p2 = players[pKeys[1]];
    if(p1.currentMove && p2.currentMove) {
        if(p1.currentMove === p2.currentMove) triggerGameEnd("tie", `Both played ${p1.currentMove}`);
        else {
            const p1Wins = (p1.currentMove==='✊'&&p2.currentMove==='✌️')||(p1.currentMove==='✋'&&p2.currentMove==='✊')||(p1.currentMove==='✌️'&&p2.currentMove==='✋');
            triggerGameEnd(p1Wins ? p1.id === playerId : p2.id === playerId, `${p1.name}: ${p1.currentMove} vs ${p2.name}: ${p2.currentMove}`);
        }
    }
}

// ==================== [3] CANVAS GRAPHICS ENGINE ====================
function initGraphicsEngine(type) {
    targets = []; particles = [];
    myScore = 0; opponentScore = 0; timeRemaining = 30;
    
    document.getElementById('my-race-score').innerText = `You: ${myScore}`;
    document.getElementById('partner-race-score').innerText = isSinglePlayer ? `AI: ${opponentScore}` : "Opponent: 0";

    const diff = document.getElementById('difficultySelect').value;
    const spawnRate = diff === 'easy' ? 35 : diff === 'medium' ? 24 : 18;
    let spawnCounter = 0;

    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        timeRemaining--;
        document.getElementById('race-timer').innerText = `${timeRemaining}s`;

        if (timeRemaining <= 0) {
            let winStatus = myScore > opponentScore ? true : myScore < opponentScore ? false : "tie";
            triggerGameEnd(winStatus, `Final Score - You: ${myScore} | Opponent: ${opponentScore}`);
        }
    }, 1000);

    function gameLoop() {
        if (!isGameRunning) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        spawnCounter++;
        if (spawnCounter % spawnRate === 0) {
            spawnTarget(type, diff);
        }

        let aiHitChance = diff === 'easy' ? 0.012 : diff === 'medium' ? 0.022 : 0.032;
        if (isSinglePlayer && Math.random() < aiHitChance) {
            if (targets.length > 0) {
                let aiIdx = Math.floor(Math.random() * targets.length);
                let t = targets[aiIdx];
                createVFX(t.x, t.y, '#ff4757');
                targets.splice(aiIdx, 1);
                opponentScore++;
                document.getElementById('partner-race-score').innerText = `AI: ${opponentScore}`;
            }
        }

        for (let i = targets.length - 1; i >= 0; i--) {
            let t = targets[i];
            t.y += t.vy;
            
            ctx.save();
            ctx.shadowColor = t.glow;
            ctx.shadowBlur = 12;
            ctx.font = `${t.size}px Arial`;
            ctx.fillText(t.symbol, t.x - t.size/2, t.y + t.size/2);
            ctx.restore();

            if (t.y < -40 || t.y > canvas.height + 40) targets.splice(i, 1);
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx; p.y += p.vy; p.alpha -= 0.04;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            if (p.alpha <= 0) particles.splice(i, 1);
        }
        ctx.globalAlpha = 1.0;

        animFrameId = requestAnimationFrame(gameLoop);
    }
    gameLoop();
}

function spawnTarget(type, diff) {
    let speedMult = diff === 'easy' ? 1 : diff === 'medium' ? 1.6 : 2.2;
    let symbol = type === 'balloon' ? '🎈' : type === 'hearts' ? '❤️' : '🪙';
    let glow = type === 'balloon' ? '#ff3366' : type === 'hearts' ? '#ff4757' : '#ffd700';

    targets.push({
        x: Math.random() * (canvas.width - 60) + 30,
        y: type === 'balloon' ? canvas.height + 30 : -20,
        vy: type === 'balloon' ? -speedMult * (1.3 + Math.random()) : speedMult * (1.3 + Math.random()),
        size: 36,
        symbol: symbol,
        glow: glow
    });
}

function handleCanvasClick(e) {
    if (!isGameRunning) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

    for (let i = targets.length - 1; i >= 0; i--) {
        let t = targets[i];
        let dist = Math.hypot(clickX - t.x, clickY - (t.y + 5));
        if (dist < t.size) {
            createVFX(t.x, t.y, t.glow);
            targets.splice(i, 1);
            myScore++;
            document.getElementById('my-race-score').innerText = `You: ${myScore}`;
            if (!isSinglePlayer) playerRef.child('score').set(myScore);
            break;
        }
    }
}

function createVFX(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            size: Math.random() * 4 + 2,
            color: color,
            alpha: 1.0
        });
    }
}

function updateRaceScoreboard() {
    const pKeys = Object.keys(players);
    if(pKeys.length < 2 || isSinglePlayer) return;
    const partnerId = pKeys[0] === playerId ? pKeys[1] : pKeys[0];
    document.getElementById('partner-race-score').innerText = `${players[partnerId]?.name || 'Partner'}: ${players[partnerId]?.score || 0}`;
}

// ==================== [NEW GAMES INTEGRATION ENGINE] ====================

// 1. NOKIA SNAKE DUO
function initSnakeEngine() {
    snakePos = {x: 100, y: 100}; snakeDir = 'RIGHT';
    snakeFood = {x: 200, y: 150}; myScore = 0;
    document.getElementById('my-race-score').innerText = `Score: ${myScore}`;
    document.getElementById('partner-race-score').innerText = "";

    function loop() {
        if (!isGameRunning) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (snakeDir === 'LEFT') snakePos.x -= 10;
        if (snakeDir === 'RIGHT') snakePos.x += 10;
        if (snakeDir === 'UP') snakePos.y -= 10;
        if (snakeDir === 'DOWN') snakePos.y += 10;

        if (snakePos.x < 0 || snakePos.x >= canvas.width || snakePos.y < 0 || snakePos.y >= canvas.height) {
            triggerGameEnd(false, "Snake Crashed into wall!");
            return;
        }

        ctx.fillStyle = '#00ffaa';
        ctx.fillRect(snakePos.x, snakePos.y, 14, 14);

        ctx.fillStyle = '#ff3366';
        ctx.beginPath();
        ctx.arc(snakeFood.x, snakeFood.y, 8, 0, Math.PI * 2);
        ctx.fill();

        if (Math.hypot(snakePos.x - snakeFood.x, snakePos.y - snakeFood.y) < 15) {
            myScore += 5;
            document.getElementById('my-race-score').innerText = `Score: ${myScore}`;
            snakeFood = { x: Math.random() * (canvas.width - 40) + 20, y: Math.random() * (canvas.height - 40) + 20 };
        }

        setTimeout(() => requestAnimationFrame(loop), 100);
    }
    loop();
}

function changeDirection(dir) { snakeDir = dir; }

// 2. PING PONG BATTLE
function initPongEngine() {
    pongPaddleX = 150; pongBall = {x: 200, y: 160, vx: 3, vy: 3};
    myScore = 0; opponentScore = 0;

    function loop() {
        if (!isGameRunning) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        pongBall.x += pongBall.vx;
        pongBall.y += pongBall.vy;

        if (pongBall.x <= 0 || pongBall.x >= canvas.width) pongBall.vx *= -1;
        if (pongBall.y <= 0) pongBall.vy *= -1;

        if (pongBall.y >= canvas.height - 20 && pongBall.x >= pongPaddleX && pongBall.x <= pongPaddleX + 80) {
            pongBall.vy *= -1;
            myScore++;
            document.getElementById('my-race-score').innerText = `Hits: ${myScore}`;
        } else if (pongBall.y > canvas.height) {
            triggerGameEnd(false, "Missed the Ping Pong ball!");
            return;
        }

        ctx.fillStyle = '#ff3366';
        ctx.fillRect(pongPaddleX, canvas.height - 15, 80, 10);

        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(pongBall.x, pongBall.y, 8, 0, Math.PI * 2);
        ctx.fill();

        animFrameId = requestAnimationFrame(loop);
    }
    loop();
}

function handleCanvasMove(e) {
    if (activeGame === 'pong' || activeGame === 'brick') {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        if (activeGame === 'pong') pongPaddleX = mouseX - 40;
        if (activeGame === 'brick') brickPaddleX = mouseX - 40;
    }
}

// 3. BRICK BREAKER SMASH
function initBrickEngine() {
    brickPaddleX = 150; pongBall = {x: 200, y: 200, vx: 3, vy: -3};
    bricks = []; myScore = 0;

    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 6; c++) {
            bricks.push({x: c * 60 + 20, y: r * 25 + 30, active: true});
        }
    }

    function loop() {
        if (!isGameRunning) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        pongBall.x += pongBall.vx; pongBall.y += pongBall.vy;
        if (pongBall.x <= 0 || pongBall.x >= canvas.width) pongBall.vx *= -1;
        if (pongBall.y <= 0) pongBall.vy *= -1;

        if (pongBall.y >= canvas.height - 20 && pongBall.x >= brickPaddleX && pongBall.x <= brickPaddleX + 80) {
            pongBall.vy *= -1;
        }

        bricks.forEach(b => {
            if (b.active && Math.hypot(pongBall.x - (b.x + 25), pongBall.y - (b.y + 10)) < 25) {
                b.active = false;
                pongBall.vy *= -1;
                myScore += 10;
            }
        });

        if (bricks.every(b => !b.active)) {
            triggerGameEnd(true, "All Bricks Smashed!");
            return;
        }

        if (pongBall.y > canvas.height) {
            triggerGameEnd(false, "Ball dropped!");
            return;
        }

        ctx.fillStyle = '#00b894';
        bricks.forEach(b => { if(b.active) ctx.fillRect(b.x, b.y, 50, 18); });

        ctx.fillStyle = '#ff3366';
        ctx.fillRect(brickPaddleX, canvas.height - 15, 80, 10);

        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(pongBall.x, pongBall.y, 7, 0, Math.PI * 2);
        ctx.fill();

        animFrameId = requestAnimationFrame(loop);
    }
    loop();
}

// 4. MEMORY CARDS FLIP
function initMemoryGame() {
    const emojis = ['❤️', '🔥', '💎', '🚀', '⭐', '🎈', '❤️', '🔥', '💎', '🚀', '⭐', '🎈'];
    memoryCards = emojis.sort(() => 0.5 - Math.random());
    flippedCards = []; matchedPairs = 0;

    const grid = document.getElementById('memory-grid');
    grid.innerHTML = '';
    memoryCards.forEach((emoji, idx) => {
        const card = document.createElement('div');
        card.className = 'mem-card';
        card.dataset.index = idx;
        card.onclick = () => flipMemoryCard(card, emoji);
        grid.appendChild(card);
    });
}

function flipMemoryCard(card, emoji) {
    if (flippedCards.length >= 2 || card.classList.contains('flipped')) return;

    card.innerText = emoji;
    card.classList.add('flipped');
    flippedCards.push({card, emoji});

    if (flippedCards.length === 2) {
        if (flippedCards[0].emoji === flippedCards[1].emoji) {
            matchedPairs++;
            flippedCards = [];
            if (matchedPairs === 6) triggerGameEnd(true, "Memory Pairs Completed!");
        } else {
            setTimeout(() => {
                flippedCards.forEach(c => { c.card.innerText = ''; c.card.classList.remove('flipped'); });
                flippedCards = [];
            }, 800);
        }
    }
}

// 5. LUDO MINI DUEL
function initLudoGame() {
    ludoScoreP1 = 0; ludoScoreP2 = 0;
    document.getElementById('ludo-p1').innerText = `You: ${ludoScoreP1}`;
    document.getElementById('ludo-p2').innerText = isSinglePlayer ? `AI: ${ludoScoreP2}` : `Partner: ${ludoScoreP2}`;
    document.getElementById('rollDiceBtn').disabled = false;
}

function rollLudoDice() {
    const val = Math.floor(Math.random() * 6) + 1;
    document.getElementById('dice-display').innerText = ['🎲','⚀','⚁','⚂','⚃','⚄','⚅'][val];
    
    ludoScoreP1 += val;
    document.getElementById('ludo-p1').innerText = `You: ${ludoScoreP1}`;

    if (ludoScoreP1 >= 15) {
        triggerGameEnd(true, "You reached 15 points in Ludo Mini!");
        return;
    }

    if (isSinglePlayer) {
        const aiVal = Math.floor(Math.random() * 6) + 1;
        ludoScoreP2 += aiVal;
        document.getElementById('ludo-p2').innerText = `AI: ${ludoScoreP2}`;
        if (ludoScoreP2 >= 15) triggerGameEnd(false, "Smart AI won the Ludo Duel!");
    }
}

// 6. BOMB PASS
function initBombGame() {
    bombHolder = 'p1';
    bombTimer = 10 + Math.floor(Math.random() * 10);
    document.getElementById('bomb-status').innerText = "Ticking Bomb! Pass it quickly!";

    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        bombTimer--;
        if (bombTimer <= 0) {
            clearInterval(countdownTimer);
            let winStatus = bombHolder !== 'p1';
            triggerGameEnd(winStatus, bombHolder === 'p1' ? "BOOM! Bomb exploded on you!" : "BOOM! Opponent Exploded!");
        }
    }, 1000);
}

function passBomb() {
    bombHolder = bombHolder === 'p1' ? 'p2' : 'p1';
    document.getElementById('bomb-status').innerText = bombHolder === 'p1' ? "You hold the Bomb! PASS IT!" : "Opponent holds the Bomb!";
}

// ==================== [4] ROTATING WHEEL TRUTH OR DARE ====================
function initTDGame() {
    document.getElementById('td-display-card').innerText = 'Tap "SPIN WHEEL 🎡" to select a challenge!';
    document.getElementById('spinWheelBtn').disabled = false;
    document.getElementById('td-turn-status').innerText = "Your Turn to Spin!";
}

function spinTDWheel() {
    if (isWheelSpinning) return;
    isWheelSpinning = true;

    const btn = document.getElementById('spinWheelBtn');
    btn.disabled = true;
    document.getElementById('td-display-card').innerText = "Wheel is spinning... 🌀";

    const randomTurns = 360 * (5 + Math.floor(Math.random() * 5));
    const randomDegree = Math.floor(Math.random() * 360);
    wheelAngle += randomTurns + randomDegree;

    const wheel = document.getElementById('wheelCircle');
    wheel.style.transform = `rotate(${wheelAngle}deg)`;

    setTimeout(() => {
        isWheelSpinning = false;
        btn.disabled = false;

        const actualDeg = wheelAngle % 360;
        const choice = (actualDeg >= 0 && actualDeg < 90) || (actualDeg >= 180 && actualDeg < 270) ? 'truth' : 'dare';

        const arr = choice === 'truth' ? truthList : dareList;
        const resultText = arr[Math.floor(Math.random() * arr.length)];

        document.getElementById('td-display-card').innerText = `${choice.toUpperCase()}: "${resultText}"`;

        if (isSinglePlayer) {
            document.getElementById('td-turn-status').innerText = "Challenge Selected! Complete it 🎯";
        }
    }, 3000);
}

// ==================== [5] ADVANCED CHAT, VOICE NOTES & IMAGE SUITE ====================
function toggleVoiceRecording() {
    const micBtn = document.getElementById('micBtn');

    if (!isRecording) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64Audio = reader.result;
                    if (isSinglePlayer) {
                        appendChatMessage(myName, "", base64Audio, null);
                        triggerAIVoiceReply();
                    } else {
                        chatRef.push({ sender: myName, text: "", audio: base64Audio, image: null });
                    }
                };
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('recording');
            micBtn.innerText = "🛑";
        }).catch(() => alert("Microphone Permission Required!"));
    } else {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            micBtn.classList.remove('recording');
            micBtn.innerText = "🎙️";
        }
    }
}

function handleImageSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Img = e.target.result;
        if (isSinglePlayer) {
            appendChatMessage(myName, "", null, base64Img);
            setTimeout(() => appendChatMessage("Smart AI 🤖", "Awesome picture! 📸"), 1000);
        } else {
            chatRef.push({ sender: myName, text: "", audio: null, image: base64Img });
        }
    };
    reader.readAsDataURL(file);
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const txt = input.value.trim();
    if (!txt) return;

    if (isSinglePlayer) {
        appendChatMessage(myName, txt, null, null);
        input.value = "";
        
        setTimeout(() => {
            const aiReplies = ["Good move! 🎮", "Haha sahi keh rahe ho! 😂", "Main jeet ke rahunga! 🔥", "Zabardast! ✨"];
            const replyText = aiReplies[Math.floor(Math.random() * aiReplies.length)];
            appendChatMessage("Smart AI 🤖", replyText, null, null);
            
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(replyText);
                window.speechSynthesis.speak(utterance);
            }
        }, 1000);
    } else {
        chatRef.push({ sender: myName, text: txt, audio: null, image: null });
        input.value = "";
    }
}

function appendChatMessage(sender, text, audioUrl, imageUrl) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';

    let content = `<b>${sender}:</b> `;
    if (text) content += text;
    if (audioUrl) content += `<br/><audio controls src="${audioUrl}"></audio>`;
    if (imageUrl) content += `<br/><img src="${imageUrl}" class="chat-img" onclick="window.open(this.src)"/>`;

    div.innerHTML = content;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function clearChatMessages() {
    if (confirm("Kya aap saari chat history delete karna chahte hain?")) {
        if (isSinglePlayer) {
            const box = document.getElementById('chat-messages');
            box.innerHTML = `<div class="chat-msg"><b>System:</b> Chat cleared!</div>`;
        } else if (chatRef) {
            chatRef.remove();
        }
    }
}

function toggleChatExpand() {
    isChatExpanded = !isChatExpanded;
    const body = document.getElementById('chat-body');
    if (isChatExpanded) body.classList.remove('hidden');
    else body.classList.add('hidden');
}

function triggerAIVoiceReply() {
    setTimeout(() => {
        const replies = [
            "Wah! Aap ki voice note boht zabardast hai! 🎮",
            "Main aap ka voice note sun chuka hoon, game par dhyan do! 🔥",
            "Aap ki baatein sun kar maza aya, chalo ab kheleim! 😂"
        ];
        const textReply = replies[Math.floor(Math.random() * replies.length)];
        appendChatMessage("Smart AI 🤖", textReply, null, null);

        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(textReply);
            window.speechSynthesis.speak(utterance);
        }
    }, 1200);
}

// ==================== [6] REAL-TIME LIVE VOICE CALL ENGINE (WEBRTC) ====================
function toggleLiveVoiceCall() {
    if (isSinglePlayer) {
        alert("Live Voice Call is available in Multiplayer Mode!");
        return;
    }

    const btn = document.getElementById('liveCallBtn');

    if (!isCallActive) {
        navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
            localStream = stream;
            isCallActive = true;
            btn.classList.add('call-active');
            btn.title = "End Voice Call";
            
            initPeerConnection();
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.createOffer().then(offer => {
                peerConnection.setLocalDescription(offer);
                callRef.child(playerId).set({ type: 'offer', sdp: offer.sdp });
            });
        }).catch(() => alert("Microphone access required for Live Call!"));
    } else {
        stopLiveVoiceCall();
    }
}

function stopLiveVoiceCall() {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    isCallActive = false;
    
    const btn = document.getElementById('liveCallBtn');
    if(btn) {
        btn.classList.remove('call-active');
        btn.title = "Toggle Live Voice Call";
    }
}

function initPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.ontrack = (event) => {
        const remoteAudio = document.getElementById('remoteAudioPlayer');
        if (remoteAudio.srcObject !== event.streams[0]) {
            remoteAudio.srcObject = event.streams[0];
        }
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            callRef.child(playerId + '_candidate').push(event.candidate.toJSON());
        }
    };
}

function setupCallSignaling() {
    callRef.on('child_added', snapshot => {
        const key = snapshot.key;
        const data = snapshot.val();

        if (key.startsWith(playerId)) return;

        if (data.type === 'offer' && isCallActive) {
            initPeerConnection();
            if (localStream) {
                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
            }
            peerConnection.setRemoteDescription(new RTCSessionDescription(data));
            peerConnection.createAnswer().then(answer => {
                peerConnection.setLocalDescription(answer);
                callRef.child(playerId).set({ type: 'answer', sdp: answer.sdp });
            });
        } else if (data.type === 'answer' && isCallActive) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(data));
        }
    });
}