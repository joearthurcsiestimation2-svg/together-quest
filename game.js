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

// Voice Note Recording
let mediaRecorder, audioChunks = [], isRecording = false;

// Real-Time Live Voice Call (WebRTC)
let peerConnection, localStream, isCallActive = false;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Wheel Animation
let wheelAngle = 0, isWheelSpinning = false;

// 2D Canvas Engine
let canvas, ctx, animFrameId, targets = [];
let myScore = 0, opponentScore = 0, timeRemaining = 30;

// Snake Engine
let snakeCanvas, snakeCtx, snakeTimer;
let snake = [{x: 10, y: 10}], snakeDir = "RIGHT", apple = {x: 5, y: 5};

// Ludo & Bomb State
let ludoScore = 0, hasBomb = true, bombTimer;

const rulesBook = {
    ttt: "Tic Tac Toe:\n- Connect 3 horizontally, vertically, or diagonally to WIN!",
    rps: "Rock Paper Scissors:\n- Rock ✊ beats Scissors ✌️\n- Paper ✋ beats Rock ✊\n- Scissors ✌️ beats Paper ✋",
    balloon: "Balloon Pop:\n- Tap rising balloons on screen to pop them.",
    hearts: "Catch Hearts:\n- Catch falling glowing hearts!",
    coins: "Speed Coins:\n- Tap coins quickly before they vanish.",
    td: "Truth or Dare:\n- Spin the wheel when it's your turn!",
    snake: "Nokia Snake Duo:\n- Eat apples to grow, avoid crashing into walls!",
    pong: "Ping Pong:\n- Tap screen to move paddle and bounce ball back!",
    ludo: "Ludo Mini:\n- Roll dice and be the first to reach 20 steps!",
    bomb: "Bomb Pass:\n- Pass the ticking bomb before it explodes on you!",
    brick: "Brick Smash:\n- Break all top bricks with bouncing ball!",
    memory: "Memory Match:\n- Match pairs of cute emoji cards!"
};

const truthList = [
    "Aap ki sab se funny ya embarrassing memory konsi hai?",
    "Aap ka pehla crush konsa celebrity tha?",
    "Agar aap ko $10,000 milain to pehli cheez kya khareedoge?"
];

const dareList = [
    "Apne room mein 10 seconds ke liye funny dance karo!",
    "Opponent ki tareef mein 3 lines bolo bina rukay!",
    "Agley 2 minutes tak funny voice mein baat karo!"
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

    snakeCanvas = document.getElementById('snakeCanvas');
    snakeCtx = snakeCanvas.getContext('2d');

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

    if (screen === 'hub') {
        document.getElementById('hub-screen').classList.remove('hidden');
        isGameRunning = false;
        clearInterval(snakeTimer);
        cancelAnimationFrame(animFrameId);
        return;
    }

    if (['balloon', 'hearts', 'coins', 'pong', 'brick'].includes(screen)) {
        activeRaceType = screen;
        document.getElementById('game-race').classList.remove('hidden');
        document.getElementById('race-title').innerText = screen.toUpperCase() + " ARENA";
    } else {
        document.getElementById(`game-${screen}`).classList.remove('hidden');
    }

    startPrepCountdown(() => {
        isGameRunning = true;
        if (screen === 'ttt') initTTT();
        if (['balloon', 'hearts', 'coins', 'pong', 'brick'].includes(screen)) initGraphicsEngine(screen);
        if (screen === 'td') initTDGame();
        if (screen === 'snake') initSnakeGame();
        if (screen === 'bomb') initBombGame();
        if (screen === 'memory') initMemoryGame();
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
    clearInterval(snakeTimer);
    clearTimeout(bombTimer);
    cancelAnimationFrame(animFrameId);

    const modal = document.getElementById('result-modal');
    const title = document.getElementById('modal-status-title');
    const desc = document.getElementById('modal-desc');

    modal.classList.remove('hidden');
    if (didIWin === "tie") {
        title.innerText = "IT'S A DRAW! 🤝";
        title.style.color = "#ffeaa7";
    } else if (didIWin === true) {
        title.innerText = "VICTORY! 🎉";
        title.style.color = "#00ffaa";
    } else {
        title.innerText = "DEFEAT! 💔";
        title.style.color = "#ff3366";
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
    clearInterval(snakeTimer);
    clearTimeout(bombTimer);
    cancelAnimationFrame(animFrameId);

    if (!isSinglePlayer && roomRef) roomRef.update({ activeScreen: 'hub' });
    else switchLayout('hub');
}

function exitToMainMenu() {
    if (confirm("Main Menu par jana chahte hain?")) {
        sessionStorage.removeItem('tq_session');
        if (!isSinglePlayer && roomRef && playerRef) playerRef.remove();

        isGameRunning = false;
        clearInterval(countdownTimer);
        clearInterval(snakeTimer);
        clearTimeout(bombTimer);
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

// --- [1] TIC TAC TOE ---
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
        setTimeout(() => {
            if(!isGameRunning) return;
            let emptyIdxs = [];
            cells.forEach((c, i) => { if(c.innerText === "") emptyIdxs.push(i); });
            if(emptyIdxs.length === 0) return;
            let aiPick = emptyIdxs[Math.floor(Math.random() * emptyIdxs.length)];

            cells[aiPick].innerText = "⭕";
            if (checkTTTLocalWin("⭕")) triggerGameEnd(false, "AI Outsmarted You!");
            else if (checkTTTFull()) triggerGameEnd("tie", "Match Tied!");
            else document.getElementById('ttt-status').innerText = "Your Turn! ⚡";
        }, 600);
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

// --- [2] RPS ---
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
        document.getElementById('rps-status').innerText = "Move Locked! 🔒 Waiting for partner...";
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

// --- [3] CANVAS ARCADE ENGINE ---
function initGraphicsEngine(type) {
    targets = []; myScore = 0; opponentScore = 0; timeRemaining = 30;
    document.getElementById('my-race-score').innerText = `You: ${myScore}`;
    document.getElementById('partner-race-score').innerText = isSinglePlayer ? `AI: ${opponentScore}` : "Opponent: 0";

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

        if (Math.random() < 0.05) spawnTarget(type);

        for (let i = targets.length - 1; i >= 0; i--) {
            let t = targets[i];
            t.y += t.vy;
            ctx.font = `${t.size}px Arial`;
            ctx.fillText(t.symbol, t.x - t.size/2, t.y + t.size/2);
            if (t.y < -40 || t.y > canvas.height + 40) targets.splice(i, 1);
        }
        animFrameId = requestAnimationFrame(gameLoop);
    }
    gameLoop();
}

function spawnTarget(type) {
    let symbol = type === 'balloon' ? '🎈' : type === 'hearts' ? '❤️' : type === 'pong' ? '🏓' : '🪙';
    targets.push({
        x: Math.random() * (canvas.width - 60) + 30,
        y: type === 'balloon' ? canvas.height + 30 : -20,
        vy: type === 'balloon' ? -2 : 2,
        size: 36, symbol: symbol
    });
}

function handleCanvasClick(e) {
    if (!isGameRunning) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

    for (let i = targets.length - 1; i >= 0; i--) {
        let t = targets[i];
        if (Math.hypot(clickX - t.x, clickY - t.y) < t.size) {
            targets.splice(i, 1);
            myScore++;
            document.getElementById('my-race-score').innerText = `You: ${myScore}`;
            break;
        }
    }
}

function updateRaceScoreboard() {
    const pKeys = Object.keys(players);
    if(pKeys.length < 2 || isSinglePlayer) return;
    const partnerId = pKeys[0] === playerId ? pKeys[1] : pKeys[0];
    document.getElementById('partner-race-score').innerText = `${players[partnerId]?.name || 'Partner'}: ${players[partnerId]?.score || 0}`;
}

// --- [4] TRUTH OR DARE ---
function initTDGame() {
    document.getElementById('td-display-card').innerText = 'Tap "SPIN WHEEL 🎡" to select a challenge!';
}
function spinTDWheel() {
    if (isWheelSpinning) return;
    isWheelSpinning = true;
    wheelAngle += 360 * 4 + Math.floor(Math.random() * 360);
    document.getElementById('wheelCircle').style.transform = `rotate(${wheelAngle}deg)`;

    setTimeout(() => {
        isWheelSpinning = false;
        const choices = [...truthList, ...dareList];
        document.getElementById('td-display-card').innerText = choices[Math.floor(Math.random() * choices.length)];
    }, 3000);
}

// --- [5] NOKIA SNAKE DUO ---
function initSnakeGame() {
    snake = [{x: 10, y: 10}, {x: 9, y: 10}];
    snakeDir = "RIGHT";
    apple = {x: 5, y: 5};
    
    clearInterval(snakeTimer);
    snakeTimer = setInterval(() => {
        if (!isGameRunning) return;
        let head = {...snake[0]};
        if (snakeDir === "UP") head.y--;
        if (snakeDir === "DOWN") head.y++;
        if (snakeDir === "LEFT") head.x--;
        if (snakeDir === "RIGHT") head.x++;

        if (head.x < 0 || head.x >= 18 || head.y < 0 || head.y >= 12) {
            triggerGameEnd(false, "Snake crashed into boundary!");
            return;
        }

        snake.unshift(head);
        if (head.x === apple.x && head.y === apple.y) {
            apple = {x: Math.floor(Math.random()*16), y: Math.floor(Math.random()*10)};
        } else {
            snake.pop();
        }

        // Draw Snake
        snakeCtx.fillStyle = "#000";
        snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
        snakeCtx.fillStyle = "#00ffaa";
        snake.forEach(seg => snakeCtx.fillRect(seg.x*20, seg.y*20, 18, 18));
        snakeCtx.fillStyle = "#ff3366";
        snakeCtx.fillRect(apple.x*20, apple.y*20, 18, 18);
    }, 150);
}

function setSnakeDir(dir) { snakeDir = dir; }

// --- [6] LUDO MINI DUEL ---
function rollLudoDice() {
    if(!isGameRunning) return;
    const roll = Math.floor(Math.random() * 6) + 1;
    document.getElementById('dice-display').innerText = ['🎲','⚀','⚁','⚂','⚃','⚄','⚅'][roll];
    ludoScore += roll;
    document.getElementById('ludo-progress').innerText = `Your Tokens: ${ludoScore}/20 Steps`;
    if (ludoScore >= 20) {
        triggerGameEnd(true, "Reached Ludo Victory Home!");
    }
}

// --- [7] BOMB PASS ---
function initBombGame() {
    hasBomb = true;
    document.getElementById('bomb-holder').innerText = "Bomb in hand: YOU!";
    clearTimeout(bombTimer);
    bombTimer = setTimeout(() => {
        triggerGameEnd(!hasBomb, hasBomb ? "BOOM! Bomb exploded on you!" : "Phew! Passed the bomb in time!");
    }, 8000 + Math.random() * 5000);
}

function passBomb() {
    hasBomb = !hasBomb;
    document.getElementById('bomb-holder').innerText = hasBomb ? "Bomb in hand: YOU!" : "Bomb Passed to Partner! 💣";
}

// --- [8] MEMORY MATCH ---
function initMemoryGame() {
    const emojis = ['🐱','🐶','🍕','🍔','⭐','💎','🐱','🐶','🍕','🍔','⭐','💎'];
    emojis.sort(() => Math.random() - 0.5);
    const grid = document.getElementById('memoryGrid');
    grid.innerHTML = "";
    emojis.forEach((e, idx) => {
        const c = document.createElement('div');
        c.className = 'mem-card';
        c.innerText = '❓';
        c.onclick = () => { c.innerText = e; };
        grid.appendChild(c);
    });
}

// --- [9] CHAT, VOICE NOTES & LIVE CALL ---
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
                    if (isSinglePlayer) appendChatMessage(myName, "", base64Audio, null);
                    else chatRef.push({ sender: myName, text: "", audio: base64Audio, image: null });
                };
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('recording'); micBtn.innerText = "🛑";
        }).catch(() => alert("Mic permission required!"));
    } else {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            micBtn.classList.remove('recording'); micBtn.innerText = "🎙️";
        }
    }
}

function handleImageSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Img = e.target.result;
        if (isSinglePlayer) appendChatMessage(myName, "", null, base64Img);
        else chatRef.push({ sender: myName, text: "", audio: null, image: base64Img });
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
        setTimeout(() => appendChatMessage("Smart AI 🤖", "Maza aa raha hai! 🔥"), 1000);
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
    if (imageUrl) content += `<br/><img src="${imageUrl}" class="chat-img"/>`;

    div.innerHTML = content;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function clearChatMessages() {
    if (confirm("Clear chat history?")) {
        if (isSinglePlayer) document.getElementById('chat-messages').innerHTML = `<div class="chat-msg"><b>System:</b> Chat cleared!</div>`;
        else if (chatRef) chatRef.remove();
    }
}

function toggleChatExpand() {
    isChatExpanded = !isChatExpanded;
    const body = document.getElementById('chat-body');
    if (isChatExpanded) body.classList.remove('hidden');
    else body.classList.add('hidden');
}

// Live Call WebRTC
function toggleLiveVoiceCall() {
    if (isSinglePlayer) return alert("Call available in Multiplayer Mode!");
    const btn = document.getElementById('liveCallBtn');
    if (!isCallActive) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            localStream = stream; isCallActive = true;
            btn.classList.add('call-active');
            initPeerConnection();
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
            peerConnection.createOffer().then(offer => {
                peerConnection.setLocalDescription(offer);
                callRef.child(playerId).set({ type: 'offer', sdp: offer.sdp });
            });
        });
    } else {
        stopLiveVoiceCall();
    }
}

function stopLiveVoiceCall() {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    isCallActive = false;
    document.getElementById('liveCallBtn').classList.remove('call-active');
}

function initPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnection.ontrack = (e) => { document.getElementById('remoteAudioPlayer').srcObject = e.streams[0]; };
}

function setupCallSignaling() {
    callRef.on('child_added', snapshot => {
        const key = snapshot.key, data = snapshot.val();
        if (key.startsWith(playerId)) return;
        if (data.type === 'offer' && isCallActive) {
            initPeerConnection();
            if (localStream) localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
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