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
let raceInterval, countdownTimer, aiTimer, isGameRunning = false;

const rulesBook = {
    ttt: "Tic Tac Toe Rules:\n- Take turns placing ❌ or ⭕.\n- Complete 3 in a row horizontally, vertically, or diagonally to WIN!",
    rps: "Rock Paper Scissors Rules:\n- Rock beats Scissors ✌️\n- Paper beats Rock ✊\n- Scissors beats Paper ✋",
    balloon: "Balloon Pop Race:\n- Tap floating balloons fast before they escape.\n- Highest score when time runs out WINS!",
    hearts: "Catch Hearts:\n- Tap the falling hearts before they disappear!\n- AI speed matches selected difficulty level.",
    coins: "Speed Coins:\n- Coins pop randomly and disappear quickly!\n- Tap faster than your opponent."
};

function toggleRoomInput() {
    const mode = document.getElementById('gameModeType').value;
    const roomInp = document.getElementById('roomCode');
    if (mode === 'multi') {
        roomInp.classList.remove('hidden');
    } else {
        roomInp.classList.add('hidden');
    }
}

// Session Lock Protection
window.addEventListener('load', () => {
    toggleRoomInput();
    const savedSession = sessionStorage.getItem('tq_session');
    if (savedSession) {
        const data = JSON.parse(savedSession);
        myName = data.name;
        currentRoom = data.room;
        isSinglePlayer = data.isSingle;
        playerId = data.id;

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
        alert("Please fill required fields!");
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
        document.getElementById('hub-status').innerText = "Single Player vs AI Active!";
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
            ? "Partner Connected! Ready to battle ❤️" 
            : "Waiting for partner to join...";

        if (pKeys.length === 1 && activeGame !== "hub" && isGameRunning) {
            triggerGameEnd(true, "Opponent Left the Game!");
        }
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
        alert("Waiting for partner to connect!");
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
        clearInterval(raceInterval);
        clearInterval(aiTimer);
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
        if (['balloon', 'hearts', 'coins'].includes(screen)) startRaceEngine(screen);
    });
}

function startPrepCountdown(callback) {
    const overlay = document.getElementById('countdown-overlay');
    overlay.classList.remove('hidden');
    let count = 3;
    overlay.innerText = count;

    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            overlay.innerText = count;
        } else if (count === 0) {
            overlay.innerText = "GO!";
        } else {
            clearInterval(timer);
            overlay.classList.add('hidden');
            callback();
        }
    }, 800);
}

function triggerGameEnd(didIWin, message) {
    isGameRunning = false;
    clearInterval(raceInterval);
    clearInterval(countdownTimer);
    clearInterval(aiTimer);

    const modal = document.getElementById('result-modal');
    const title = document.getElementById('modal-status-title');
    const desc = document.getElementById('modal-desc');

    modal.classList.remove('hidden');
    if (didIWin === "tie") {
        title.innerText = "IT'S A TIE! 🤝";
        title.className = "modal-title";
        title.style.color = "#ffeaa7";
    } else if (didIWin) {
        title.innerText = "YOU WIN! 🎉";
        title.className = "modal-title win-title";
    } else {
        title.innerText = "YOU LOSE! 💔";
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

// ==================== [1] TIC TAC TOE (AI & MULTI) ====================
function initTTT() {
    renderTTTBoard(Array(9).fill(""));
    if (!isSinglePlayer) {
        roomRef.child('ttt').set({ board: Array(9).fill(""), turn: Object.keys(players)[0] });
    } else {
        document.getElementById('ttt-status').innerText = "Your Turn! ⚡";
    }
}

function playTTT(idx) {
    if (!isGameRunning) return;

    if (isSinglePlayer) {
        let cells = document.querySelectorAll('#game-ttt .cell');
        if (cells[idx].innerText !== "") return;
        cells[idx].innerText = "❌";
        
        if (checkTTTLocalWin("❌")) return triggerGameEnd(true, "You defeated Smart AI!");
        if (checkTTTFull()) return triggerGameEnd("tie", "Match Tied!");

        document.getElementById('ttt-status').innerText = "AI is thinking... 🤔";
        
        const diff = document.getElementById('difficultySelect').value;
        const delay = diff === 'easy' ? 1000 : diff === 'medium' ? 600 : 300;

        setTimeout(() => {
            if(!isGameRunning) return;
            let emptyIdxs = [];
            cells.forEach((c, i) => { if(c.innerText === "") emptyIdxs.push(i); });
            if(emptyIdxs.length === 0) return;
            
            let aiPick;
            if (diff === 'hard') {
                aiPick = findWinningMove(cells, "⭕") ?? findWinningMove(cells, "❌") ?? emptyIdxs[0];
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
        if (vals.filter(v => v === symbol).length === 2 && vals.includes("")) {
            return w[vals.indexOf("")];
        }
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
            const winningPlayerId = b[p[0]] === "❌" ? pKeys[0] : pKeys[1];
            triggerGameEnd(winningPlayerId === playerId, "3-in-a-row completed!");
            return;
        }
    }
    if (!b.includes("")) triggerGameEnd("tie", "Board full!");
    else document.getElementById('ttt-status').innerText = turn === playerId ? "Your Turn! ⚡" : "Opponent's Turn... 💭";
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
            const winnerId = p1Wins ? p1.id : p2.id;
            triggerGameEnd(winnerId === playerId, `${p1.name}: ${p1.currentMove} vs ${p2.name}: ${p2.currentMove}`);
        }
    }
}

// ==================== [3] RACING ENGINES (BALLOON, HEARTS, COINS) ====================
function startRaceEngine(type) {
    const diff = document.getElementById('difficultySelect').value;
    const zone = document.getElementById('race-zone');
    zone.innerHTML = "";
    
    let speed = diff === 'easy' ? 2 : diff === 'medium' ? 4 : 7;
    let spawnRate = diff === 'easy' ? 700 : diff === 'medium' ? 450 : 250;
    let myScore = 0, opponentScore = 0;
    
    let timeRem = 30;
    document.getElementById('race-timer').innerText = `Time: ${timeRem}s`;
    document.getElementById('my-race-score').innerText = "You: 0";
    document.getElementById('partner-race-score').innerText = isSinglePlayer ? "AI: 0" : "Opponent: 0";

    countdownTimer = setInterval(() => {
        timeRem--;
        document.getElementById('race-timer').innerText = `Time: ${timeRem}s`;
        if (timeRem <= 0) {
            triggerGameEnd(myScore > opponentScore ? true : myScore < opponentScore ? false : "tie", `Score: You (${myScore}) - Enemy (${opponentScore})`);
        }
    }, 1000);

    // Main Spawner Loop
    raceInterval = setInterval(() => {
        if (!isGameRunning) return;
        
        const item = document.createElement('div');
        item.className = 'spawn-item';
        item.innerText = type === 'balloon' ? '🎈' : type === 'hearts' ? '❤️' : '🪙';
        item.style.left = Math.random() * (zone.clientWidth - 45) + "px";

        if (type === 'coins') {
            item.style.top = Math.random() * (zone.clientHeight - 45) + "px";
            setTimeout(() => item.remove(), diff === 'easy' ? 1000 : 600);
        } else {
            let pos = type === 'balloon' ? 320 : -40;
            item.style.top = pos + "px";
            let fly = setInterval(() => {
                pos += type === 'balloon' ? -speed : speed;
                item.style.top = pos + "px";
                if (pos < -50 || pos > 330) { clearInterval(fly); item.remove(); }
            }, 20);
            item.flyRef = fly;
        }

        item.addEventListener('pointerdown', () => {
            if (item.flyRef) clearInterval(item.flyRef);
            item.remove();
            myScore++;
            document.getElementById('my-race-score').innerText = `You: ${myScore}`;
            if(!isSinglePlayer) playerRef.child('score').set(myScore);
        });

        zone.appendChild(item);
    }, spawnRate);

    // Active AI Engine Simulator for Single Player
    if (isSinglePlayer) {
        const aiHitChance = diff === 'easy' ? 0.35 : diff === 'medium' ? 0.6 : 0.85;
        const aiSpeedRate = diff === 'easy' ? 1000 : diff === 'medium' ? 600 : 350;

        aiTimer = setInterval(() => {
            if (!isGameRunning) return;
            const targets = zone.querySelectorAll('.spawn-item');
            if (targets.length > 0 && Math.random() < aiHitChance) {
                const target = targets[Math.floor(Math.random() * targets.length)];
                if (target.flyRef) clearInterval(target.flyRef);
                target.remove();
                opponentScore++;
                document.getElementById('partner-race-score').innerText = `AI: ${opponentScore}`;
            }
        }, aiSpeedRate);
    }
}

function updateRaceScoreboard() {
    const pKeys = Object.keys(players);
    if(pKeys.length < 2 || isSinglePlayer) return;
    const partnerId = pKeys[0] === playerId ? pKeys[1] : pKeys[0];
    document.getElementById('partner-race-score').innerText = `${players[partnerId]?.name || 'Partner'}: ${players[partnerId]?.score || 0}`;
}