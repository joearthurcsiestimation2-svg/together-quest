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
let roomRef, playerRef, chatRef;
let players = {}, activeGame = "hub", activeRaceType = "";
let countdownTimer, isGameRunning = false;
let isChatExpanded = false;

// Engine variables
let wheelAngle = 0;
let canvas, ctx, animFrameId, targets = [];
let myScore = 0, opponentScore = 0, timeRemaining = 30;

let snakeCanvas, snakeCtx, snakeTimer;
let snake = [{x: 10, y: 10}], snakeDir = "RIGHT", apple = {x: 5, y: 5};
let ludoScore = 0, hasBomb = true, bombTimer;

const rulesBook = {
    ttt: "Tic Tac Toe:\n- Align 3 'X' or 'O' in a row to win!",
    rps: "RPS Battle:\n- Rock beats Scissors, Scissors beats Paper, Paper beats Rock!",
    balloon: "Balloon Pop:\n- Tap balloons as fast as possible before time runs out!",
    hearts: "Catch Hearts:\n- Catch pink/red hearts to gain points!",
    coins: "Speed Coins:\n- Collect coins before your opponent!",
    td: "Truth or Dare:\n- Spin wheel and complete the challenge!",
    snake: "Snake Duo:\n- Eat apples to grow, avoid crashing!",
    pong: "Ping Pong:\n- Catch fast-moving ping-pong paddles!",
    ludo: "Ludo Mini:\n- Roll dice and reach 20 steps first!",
    bomb: "Bomb Pass:\n- Pass the ticking bomb before explosion!",
    c4: "Connect 4:\n- Align 4 discs in a row!",
    quiz: "Couple Quiz:\n- Answer fun questions together!"
};

const quizData = [
    { q: "Partner ka favorite late night snack kya hai?", opts: ["Pizza 🍕", "Ice Cream 🍦", "Chips 🍟", "Chocolate 🍫"] },
    { q: "Ideal Sunday Date location kya honi chahiye?", opts: ["Movie Night 🎬", "Long Drive 🚗", "Beach Walk 🏖️", "Cozy Sleep 😴"] }
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

    if (!myName || (!isSinglePlayer && !currentRoom)) return alert("Please enter name & room code!");

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

    playerRef.set({ id: playerId, name: myName, score: 0 });
    playerRef.onDisconnect().remove();

    roomRef.child('players').on('value', (snapshot) => {
        players = snapshot.val() || {};
        const pKeys = Object.keys(players);
        document.getElementById('hub-status').innerText = pKeys.length === 2 ? "Partner Connected! 🔥" : "Waiting for partner...";
    });

    roomRef.child('activeScreen').on('value', (snapshot) => {
        const screen = snapshot.val();
        if (screen && screen !== activeGame) switchLayout(screen);
    });

    chatRef.on('child_added', snapshot => appendChatMessage(snapshot.val().sender, snapshot.val().text));
}

function openGame(gameType) {
    if (!isSinglePlayer && Object.keys(players).length < 2) return alert("Waiting for partner!");
    if (!isSinglePlayer) roomRef.update({ activeScreen: gameType });
    else switchLayout(gameType);
}

function switchLayout(screen) {
    activeGame = screen;
    document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
    document.getElementById('result-modal').classList.add('hidden');

    if (screen === 'hub') {
        document.getElementById('hub-screen').classList.remove('hidden');
        isGameRunning = false; clearInterval(snakeTimer); cancelAnimationFrame(animFrameId);
        return;
    }

    if (['balloon', 'hearts', 'coins', 'pong'].includes(screen)) {
        activeRaceType = screen;
        document.getElementById('game-race').classList.remove('hidden');
        document.getElementById('race-title').innerText = screen.toUpperCase() + " ARENA";
    } else {
        document.getElementById(`game-${screen}`).classList.remove('hidden');
    }

    startPrepCountdown(() => {
        isGameRunning = true;
        if (['balloon', 'hearts', 'coins', 'pong'].includes(screen)) initGraphicsEngine(screen);
        if (screen === 'ttt') initTTT();
        if (screen === 'snake') initSnakeGame();
        if (screen === 'bomb') initBombGame();
        if (screen === 'c4') initConnect4();
        if (screen === 'quiz') initQuizGame();
    });
}

function startPrepCountdown(callback) {
    const overlay = document.getElementById('countdown-overlay');
    overlay.classList.remove('hidden');
    let count = 3; overlay.innerText = count;

    const timer = setInterval(() => {
        count--;
        if (count > 0) overlay.innerText = count;
        else if (count === 0) overlay.innerText = "GO!";
        else { clearInterval(timer); overlay.classList.add('hidden'); callback(); }
    }, 800);
}

function triggerGameEnd(didIWin, message) {
    isGameRunning = false; clearInterval(countdownTimer); clearInterval(snakeTimer); clearTimeout(bombTimer); cancelAnimationFrame(animFrameId);
    const modal = document.getElementById('result-modal');
    modal.classList.remove('hidden');
    document.getElementById('modal-status-title').innerText = didIWin === "tie" ? "DRAW! 🤝" : didIWin ? "VICTORY! 🎉" : "DEFEAT! 💔";
    document.getElementById('modal-desc').innerText = message || "";
}

function requestReplay() { document.getElementById('result-modal').classList.add('hidden'); openGame(activeGame); }
function backToHub() { switchLayout('hub'); }
function exitToMainMenu() { location.reload(); }
function showRules(type) { document.getElementById('rules-text').innerText = rulesBook[type] || "Play & Enjoy!"; document.getElementById('rules-modal').classList.remove('hidden'); }
function closeRules() { document.getElementById('rules-modal').classList.add('hidden'); }

// --- TIC TAC TOE ---
function initTTT() {
    const grid = document.getElementById('tttGrid'); grid.innerHTML = "";
    for(let i=0; i<9; i++) {
        const cell = document.createElement('div'); cell.className = 'ttt-cell';
        cell.onclick = () => { if(!cell.innerText) { cell.innerText = "❌"; checkTTTWin(); } };
        grid.appendChild(cell);
    }
}
function checkTTTWin() { triggerGameEnd(true, "Nice Move!"); }

// --- RPS ---
function playRPS(choice) {
    const choices = ['✊', '🖐️', '✌️'];
    const botChoice = choices[Math.floor(Math.random() * 3)];
    if(choice === botChoice) triggerGameEnd("tie", `Both chose ${choice}`);
    else triggerGameEnd(true, `You chose ${choice}, Opponent chose ${botChoice}!`);
}

// --- CONNECT 4 ---
function initConnect4() {
    const grid = document.getElementById('c4Grid'); grid.innerHTML = "";
    for(let i=0; i<42; i++) {
        const cell = document.createElement('div'); cell.className = 'c4-cell';
        cell.onclick = () => { cell.classList.add('red'); setTimeout(() => triggerGameEnd(true, "Connect 4 Formed!"), 500); };
        grid.appendChild(cell);
    }
}

// --- QUIZ ---
function initQuizGame() {
    const item = quizData[Math.floor(Math.random()*quizData.length)];
    document.getElementById('quiz-q').innerText = item.q;
    const optsBox = document.getElementById('quiz-options'); optsBox.innerHTML = "";
    item.opts.forEach(opt => {
        const b = document.createElement('button'); b.innerText = opt;
        b.onclick = () => triggerGameEnd(true, `Answered: ${opt}`);
        optsBox.appendChild(b);
    });
}

// --- GRAPHICS CANVASES ---
function initGraphicsEngine(type) {
    targets = []; myScore = 0; opponentScore = 0; timeRemaining = 30;
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        timeRemaining--;
        document.getElementById('race-timer').innerText = `${timeRemaining}s`;
        if (timeRemaining <= 0) triggerGameEnd(myScore >= opponentScore, `Score - You: ${myScore} | Opponent: ${opponentScore}`);
    }, 1000);

    function gameLoop() {
        if (!isGameRunning) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (Math.random() < 0.05) {
            targets.push({
                x: Math.random() * (canvas.width - 60) + 30,
                y: -20, vy: 2.5, size: 36,
                symbol: type === 'balloon' ? '🎈' : type === 'hearts' ? '❤️' : type === 'coins' ? '🪙' : '🏓'
            });
        }
        for (let i = targets.length - 1; i >= 0; i--) {
            let t = targets[i]; t.y += t.vy;
            ctx.font = `${t.size}px Arial`; ctx.fillText(t.symbol, t.x - t.size/2, t.y + t.size/2);
            if (t.y > canvas.height + 40) targets.splice(i, 1);
        }
        animFrameId = requestAnimationFrame(gameLoop);
    }
    gameLoop();
}

function handleCanvasClick(e) {
    if (!isGameRunning) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
    for (let i = targets.length - 1; i >= 0; i--) {
        if (Math.hypot(clickX - targets[i].x, clickY - targets[i].y) < targets[i].size) {
            targets.splice(i, 1); myScore++;
            document.getElementById('my-race-score').innerText = `You: ${myScore}`;
            break;
        }
    }
}

// --- SNAKE & BOMB ---
function initSnakeGame() {
    snake = [{x: 10, y: 10}]; snakeDir = "RIGHT"; apple = {x: 5, y: 5};
    clearInterval(snakeTimer);
    snakeTimer = setInterval(() => {
        let head = {...snake[0]};
        if (snakeDir === "UP") head.y--; if (snakeDir === "DOWN") head.y++;
        if (snakeDir === "LEFT") head.x--; if (snakeDir === "RIGHT") head.x++;
        if (head.x < 0 || head.x >= 18 || head.y < 0 || head.y >= 12) return triggerGameEnd(false, "Boundary Crash!");
        snake.unshift(head);
        if (head.x === apple.x && head.y === apple.y) apple = {x: Math.floor(Math.random()*16), y: Math.floor(Math.random()*10)};
        else snake.pop();

        snakeCtx.fillStyle = "#000"; snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
        snakeCtx.fillStyle = "#00ffaa"; snake.forEach(s => snakeCtx.fillRect(s.x*20, s.y*20, 18, 18));
        snakeCtx.fillStyle = "#ff3366"; snakeCtx.fillRect(apple.x*20, apple.y*20, 18, 18);
    }, 150);
}
function setSnakeDir(d) { snakeDir = d; }

function initBombGame() {
    hasBomb = true; clearTimeout(bombTimer);
    bombTimer = setTimeout(() => triggerGameEnd(!hasBomb, hasBomb ? "BOOM! Explosion!" : "Passed Bomb safely!"), 8000);
}
function passBomb() { hasBomb = !hasBomb; document.getElementById('bomb-holder').innerText = hasBomb ? "Bomb with: YOU!" : "Passed Bomb! 💣"; }

function rollLudoDice() {
    ludoScore += Math.floor(Math.random() * 6) + 1;
    document.getElementById('ludo-progress').innerText = `Your Tokens: ${ludoScore}/20 Steps`;
    if (ludoScore >= 20) triggerGameEnd(true, "Reached Ludo Victory!");
}

function spinTDWheel() {
    wheelAngle += 360 * 3 + Math.floor(Math.random() * 360);
    document.getElementById('wheelCircle').style.transform = `rotate(${wheelAngle}deg)`;
}

// --- CHAT ---
function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const txt = input.value.trim(); if (!txt) return;
    appendChatMessage(myName, txt); input.value = "";
}
function appendChatMessage(sender, text) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div'); div.className = 'chat-msg';
    div.innerHTML = `<b>${sender}:</b> ${text}`;
    box.appendChild(div); box.scrollTop = box.scrollHeight;
}
function toggleChatExpand() { isChatExpanded = !isChatExpanded; document.getElementById('chat-body').classList.toggle('hidden', !isChatExpanded); }