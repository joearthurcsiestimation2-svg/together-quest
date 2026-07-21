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
let roomRef, playerRef;
let players = {}, activeGame = "hub", activeRaceType = "";
let countdownTimer, isGameRunning = false;

// 2D Canvas Engine Vars
let canvas, ctx, animFrameId, targets = [], particles = [];
let myScore = 0, opponentScore = 0, timeRemaining = 30;

const rulesBook = {
    ttt: "Tic Tac Toe:\n- Place ❌ or ⭕ turn by turn.\n- Connect 3 horizontally, vertically, or diagonally to WIN!",
    rps: "Rock Paper Scissors:\n- Rock ✊ beats Scissors ✌️\n- Paper ✋ beats Rock ✊\n- Scissors ✌️ beats Paper ✋",
    balloon: "Balloon Pop:\n- Tap rising balloons on screen to pop them.\n- Score higher than AI / Partner before time expires!",
    hearts: "Catch Hearts:\n- Catch falling glowing hearts!\n- Hard difficulty moves targets faster.",
    coins: "Speed Coins:\n- Tap coins quickly before they vanish."
};

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

    const savedSession = sessionStorage.getItem('tq_session');
    if (savedSession) {
        const data = JSON.parse(savedSession);
        myName = data.name; currentRoom = data.room;
        isSinglePlayer = data.isSingle; playerId = data.id;

        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('hub-screen').classList.remove('hidden');
        document.getElementById('welcome-msg').innerText = `Welcome ${myName}!`;

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

    if (screen === 'hub') {
        document.getElementById('hub-screen').classList.remove('hidden');
        isGameRunning = false;
        cancelAnimationFrame(animFrameId);
        return;
    }

    if (['balloon', 'hearts', 'coins'].includes(screen)) {
        activeRaceType = screen;
        document.getElementById('game-race').classList.remove('hidden');
        document.getElementById('race-title').innerText = screen.toUpperCase() + " ARENA";
    } else {
        document.getElementById(`game-${screen}`).classList.remove('hidden');
    }

    startPrepCountdown(() => {
        isGameRunning = true;
        if (screen === 'ttt') initTTT();
        if (['balloon', 'hearts', 'coins'].includes(screen)) initGraphicsEngine(screen);
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
    } else if (didIWin) {
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
    sessionStorage.removeItem('tq_session');
    document.getElementById('result-modal').classList.add('hidden');
    if (!isSinglePlayer && roomRef) roomRef.update({ activeScreen: 'hub' });
    else switchLayout('hub');
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
        const delay = diff === 'easy' ? 900 : diff === 'medium' ? 500 : 250;

        setTimeout(() => {
            if(!isGameRunning) return;
            let emptyIdxs = [];
            cells.forEach((c, i) => { if(c.innerText === "") emptyIdxs.push(i); });
            if(emptyIdxs.length === 0) return;
            
            let aiPick = (diff === 'hard') 
                ? (findWinningMove(cells, "⭕") ?? findWinningMove(cells, "❌") ?? emptyIdxs[0])
                : emptyIdxs[Math.floor(Math.random() * emptyIdxs.length)];

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
        document.getElementById('rps-status').innerText = "Move Locked! 🔒";
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

// ==================== [3] HIGH-GRAPHICS 2D CANVAS ENGINE ====================
function initGraphicsEngine(type) {
    targets = []; particles = [];
    myScore = 0; opponentScore = 0; timeRemaining = 30;
    
    document.getElementById('my-race-score').innerText = `You: ${myScore}`;
    document.getElementById('partner-race-score').innerText = isSinglePlayer ? `AI: ${opponentScore}` : "Opponent: 0";

    const diff = document.getElementById('difficultySelect').value;
    const spawnRate = diff === 'easy' ? 40 : diff === 'medium' ? 25 : 15;
    let spawnCounter = 0;

    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        timeRemaining--;
        document.getElementById('race-timer').innerText = `${timeRemaining}s`;
        if (timeRemaining <= 0) {
            triggerGameEnd(myScore > opponentScore ? true : myScore < opponentScore ? false : "tie", `Final Score: You (${myScore}) - Enemy (${opponentScore})`);
        }
    }, 1000);

    function gameLoop() {
        if (!isGameRunning) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Spawn logic
        spawnCounter++;
        if (spawnCounter % spawnRate === 0) {
            spawnTarget(type, diff);
        }

        // Single Player AI Auto Hit
        if (isSinglePlayer && Math.random() < (diff === 'easy' ? 0.02 : diff === 'medium' ? 0.04 : 0.08)) {
            if (targets.length > 0) {
                let aiIdx = Math.floor(Math.random() * targets.length);
                let t = targets[aiIdx];
                createVFX(t.x, t.y, '#ff4757');
                targets.splice(aiIdx, 1);
                opponentScore++;
                document.getElementById('partner-race-score').innerText = `AI: ${opponentScore}`;
            }
        }

        // Update & Render Targets
        for (let i = targets.length - 1; i >= 0; i--) {
            let t = targets[i];
            t.y += t.vy;
            
            // Draw Target Graphics
            ctx.save();
            ctx.shadowColor = t.glow;
            ctx.shadowBlur = 12;
            ctx.font = `${t.size}px Arial`;
            ctx.fillText(t.symbol, t.x - t.size/2, t.y + t.size/2);
            ctx.restore();

            if (t.y < -40 || t.y > canvas.height + 40) targets.splice(i, 1);
        }

        // Render VFX Explosions
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
    let speedMult = diff === 'easy' ? 1 : diff === 'medium' ? 1.8 : 2.5;
    let symbol = type === 'balloon' ? '🎈' : type === 'hearts' ? '❤️' : '🪙';
    let glow = type === 'balloon' ? '#ff3366' : type === 'hearts' ? '#ff4757' : '#ffd700';

    targets.push({
        x: Math.random() * (canvas.width - 50) + 25,
        y: type === 'balloon' ? canvas.height + 30 : -20,
        vy: type === 'balloon' ? -speedMult * (1.5 + Math.random()) : speedMult * (1.5 + Math.random()),
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