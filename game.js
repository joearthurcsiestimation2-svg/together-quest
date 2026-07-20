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

let playerId, myName, currentRoom, roomRef, playerRef;
let players = {};
let activeGame = "hub";
let isGameActive = true;
let spawnInterval, countdownTimer;
let spawnActive = false;

const truths = [
    "Agar aapko kisi ek cheez ke baare me jhoot bolna pade mujhse, toh wo kya hoga?",
    "Aapki life ka sabse embarrassing lamha konsa tha?",
    "Aapne pehli baar mere baare me kya socha tha?",
    "Agar aapko hamari relationship ka koi ek din repeat karna ho, toh konsa hoga?",
    "Aapka sabse bada secret fear kya hai?",
    "Kya aapne kabhi mujhse koi baat chupayi hai? Agar haan toh kya?"
];

const dares = [
    "Mujhe abhi ek cute voice note bhejo aur tareef karo! 🥰",
    "Agay se jab tak bolu har sentence ke end me 'My Master' kaho! 😂",
    "Apni gallery ki last saved pic mujhe send karo abhi.",
    "Ek romantic status lagao WhatsApp par bina mera naam liye! ❤️",
    "Camera open karke apni sabse ajeeb shakl bana kar selfie bhejo!",
    "Mere liye koi bhi ek song gao chahay aawaz jaisi bhi ho! 🎤"
];

document.getElementById('joinBtn').addEventListener('click', () => {
    myName = document.getElementById('playerName').value.trim();
    currentRoom = document.getElementById('roomCode').value.trim();
    if (!myName || !currentRoom) return alert("Fill data! ❤️");

    playerId = 'p_' + Math.random().toString(36).substr(2, 5);
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('hub-screen').classList.remove('hidden');
    document.getElementById('welcome-msg').innerText = `Hello ${myName}! ❤️`;
    initMultiplayerArcade();
});

function initMultiplayerArcade() {
    roomRef = database.ref('arcadeRooms/' + currentRoom);
    playerRef = roomRef.child('players').child(playerId);
    playerRef.set({ id: playerId, name: myName, score: 0, currentMove: "" });
    playerRef.onDisconnect().remove();

    roomRef.child('players').on('value', (snapshot) => {
        players = snapshot.val() || {};
        const count = Object.keys(players).length;
        document.getElementById('hub-status').innerText = count === 2 ? "Dono Players Connected! Khelna Shuru Karein 🥰" : "Waiting for your partner to join...";
        updateScoreboards();
        if(activeGame === 'rps') checkRPSResult();
    });

    roomRef.child('activeScreen').on('value', (snapshot) => {
        const screen = snapshot.val();
        if (screen && screen !== activeGame) showScreenLayout(screen);
    });

    roomRef.child('ttt').on('value', (snapshot) => {
        if(activeGame === 'ttt' && snapshot.exists()) {
            const data = snapshot.val();
            renderTTTBoard(data.board || Array(9).fill(""));
            evaluateTTTWinner(data.board || Array(9).fill(""), data.turn);
        }
    });

    roomRef.child('truthdarePrompt').on('value', (snapshot) => {
        if(activeGame === 'truthdare' && snapshot.exists()) {
            document.getElementById('td-prompt').innerText = snapshot.val();
        }
    });

    roomRef.child('memoryBoard').on('value', (snapshot) => {
        if(activeGame === 'memory' && snapshot.exists()) renderMemoryBoard(snapshot.val());
    });

    // Unified Global Racing Mode Engine State Listener
    roomRef.child('raceState').on('value', (snapshot) => {
        if(snapshot.exists() && (activeGame === 'balloon' || activeGame === 'hearts' || activeGame === 'coins')) {
            const rState = snapshot.val();
            document.getElementById(`${activeGame}-timer`).innerText = `Time Left: ${rState.timeLeft}s`;
            if(rState.status === "playing" && !spawnActive) runRaceSpawner(activeGame);
            if(rState.status === "ended") stopRaceEngine(activeGame, rState.winnerName);
        }
    });
}

function switchGame(gameMode) {
    roomRef.update({ activeScreen: gameMode });
    if(gameMode === 'ttt') resetTicTacToe();
    if(gameMode === 'memory') resetMemoryGame();
    if(['balloon', 'hearts', 'coins'].includes(gameMode)) resetRaceSyncData();
}

function backToHub() {
    clearInterval(spawnInterval);
    clearInterval(countdownTimer);
    spawnActive = false;
    roomRef.update({ activeScreen: "hub" });
}

function showScreenLayout(screen) {
    activeGame = screen;
    document.querySelectorAll('.container').forEach(el => { if(el.id !== 'lobby-screen') el.classList.add('hidden'); });
    document.getElementById(`game-${screen}`) ? document.getElementById(`game-${screen}`).classList.remove('hidden') : document.getElementById('hub-screen').classList.remove('hidden');
    
    // Reset configurations on screen entry
    if(['balloon','hearts','coins'].includes(screen)) {
        document.getElementById(`${screen}-start-btn`).classList.remove('hidden');
        document.getElementById(`${screen}-status`).innerText = "Click Start when both are ready!";
        document.getElementById(`${screen}-zone`).innerHTML = "";
        clearInterval(spawnInterval);
        spawnActive = false;
    }
}

// SCOREBOARDS UPDATER
function updateScoreboards() {
    const pKeys = Object.keys(players);
    if(pKeys.length < 2) return;
    const me = players[playerId];
    const partner = players[pKeys[0] === playerId ? pKeys[1] : pKeys[0]];
    
    ['pop', 'heart', 'coin'].forEach(type => {
        const myEl = document.getElementById(`my-${type}-score`);
        const partEl = document.getElementById(`partner-${type}-score`);
        if(myEl) myEl.innerText = `You: ${me?.score || 0}`;
        if(partEl) partEl.innerText = `${partner?.name || 'Partner'}: ${partner?.score || 0}`;
    });
}

// ==================== [1] TIC TAC TOE ====================
function resetTicTacToe() {
    isGameActive = true;
    roomRef.child('ttt').set({ board: Array(9).fill(""), turn: Object.keys(players)[0] || playerId });
}
function playTTT(idx) {
    if(!isGameActive) return;
    roomRef.child('ttt').once('value', snapshot => {
        const data = snapshot.val() || {};
        if (data.turn !== playerId) return;
        let b = data.board || Array(9).fill("");
        if(b[idx] !== "") return;
        const keys = Object.keys(players);
        b[idx] = keys[0] === playerId ? "❌" : "⭕";
        roomRef.child('ttt').update({ board: b, turn: keys[0] === playerId ? keys[1] : keys[0] });
    });
}
function renderTTTBoard(b) {
    document.querySelectorAll('.cell').forEach((c, i) => c.innerText = b[i] || "");
}
function evaluateTTTWinner(b, turn) {
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let marker = null;
    for (let p of wins) { if (b[p[0]] && b[p[0]] === b[p[1]] && b[p[0]] === b[p[2]]) { marker = b[p[0]]; break; } }
    if(marker) {
        isGameActive = false;
        const wName = marker === "❌" ? players[Object.keys(players)[0]].name : players[Object.keys(players)[1]].name;
        document.getElementById('ttt-status').innerHTML = `🎉 <span style="color:#55efc4;">${wName} WINS!</span>`;
        return;
    }
    if(!b.includes("")) { isGameActive = false; document.getElementById('ttt-status').innerText = "Draw Match! 🤝"; return; }
    document.getElementById('ttt-status').innerText = turn === playerId ? "Your Turn! ⚡" : "Partner's Turn... 💭";
}

// ==================== [2] ROCK PAPER SCISSORS ====================
function playRPS(m) { playerRef.update({ currentMove: m }); document.getElementById('rps-status').innerText = "Move Locked! 🔒"; }
function checkRPSResult() {
    const keys = Object.keys(players); if(keys.length < 2) return;
    const p1 = players[keys[0]], p2 = players[keys[1]];
    if(p1.currentMove && p2.currentMove) {
        let r = `${p1.name}: ${p1.currentMove} vs ${p2.name}: ${p2.currentMove}<br><br>`;
        if(p1.currentMove === p2.currentMove) r += "Tie! 🤝";
        else if ((p1.currentMove==='✊'&&p2.currentMove==='✌️')||(p1.currentMove==='✋'&&p2.currentMove==='✊')||(p1.currentMove==='✌️'&&p2.currentMove==='✋')) r += `👑 ${p1.name} Wins!`;
        else r += `👑 ${p2.name} Wins!`;
        document.getElementById('rps-result').innerHTML = r; document.getElementById('rps-status').innerText = "Finished!";
    }
}

// ==================== [3] TRUTH OR DARE ====================
function selectTruthDare(type) {
    const arr = type === 'truth' ? truths : dares;
    const selection = arr[Math.floor(Math.random() * arr.length)];
    roomRef.update({ truthdarePrompt: `[${type.toUpperCase()}] ${selection}` });
}

// ==================== [4] MEMORY MATCH GAME ====================
let flippedIndices = [];
function resetMemoryGame() {
    const items = ['🍎','🍎','🍌','🍌','🍓','🍓','🍉','🍉','🦊','🦊','🐱','🐱','🎈','🎈','❤️','❤️'];
    // Shuffle
    for(let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [items[i], items[j]] = [items[j], items[i]]; }
    const boardState = items.map((val, idx) => ({ id: idx, value: val, flipped: false, matched: false }));
    roomRef.child('memoryBoard').set(boardState);
    roomRef.child('memoryClick').set({ active: true });
}
function clickMemoryCard(idx) {
    roomRef.child('memoryBoard').once('value', snapshot => {
        let b = snapshot.val();
        if(!b || b[idx].flipped || b[idx].matched) return;
        b[idx].flipped = true;
        roomRef.child('memoryBoard').set(b);
        
        let openCards = b.filter(c => c.flipped && !c.matched);
        if(openCards.length === 2) {
            setTimeout(() => {
                if(openCards[0].value === openCards[1].value) {
                    b[openCards[0].id].matched = true; b[openCards[1].id].matched = true;
                } else {
                    b[openCards[0].id].flipped = false; b[openCards[1].id].flipped = false;
                }
                roomRef.child('memoryBoard').set(b);
            }, 800);
        }
    });
}
function renderMemoryBoard(b) {
    const grid = document.getElementById('m-grid'); grid.innerHTML = "";
    b.forEach(card => {
        const div = document.createElement('div');
        div.className = `memory-card ${(card.flipped || card.matched) ? 'flipped' : ''}`;
        div.innerText = card.value;
        div.addEventListener('click', () => clickMemoryCard(card.id));
        grid.appendChild(div);
    });
}

// ==================== [5] MEGA RACING ENGINES (BALLOON, HEARTS, COINS) ====================
function resetRaceSyncData() {
    playerRef.update({ score: 0 });
    roomRef.child('raceState').set({ status: "waiting", timeLeft: 30, winnerName: "" });
}
function triggerRaceStart(gameType) {
    const keys = Object.keys(players); if(keys.length < 2) return alert("Partner missing!");
    keys.forEach(k => roomRef.child('players').child(k).update({ score: 0 }));
    document.getElementById(`${gameType}-start-btn`).classList.add('hidden');
    roomRef.child('raceState').set({ status: "playing", timeLeft: 30, winnerName: "" });

    if(keys[0] === playerId) {
        let remaining = 30; clearInterval(countdownTimer);
        countdownTimer = setInterval(() => {
            remaining--; roomRef.child('raceState').update({ timeLeft: remaining });
            if(remaining <= 0) { clearInterval(countdownTimer); evaluateRaceWinner(); }
        }, 1000);
    }
}
function runRaceSpawner(type) {
    spawnActive = true;
    const zone = document.getElementById(type === 'balloon' ? 'b-zone' : type === 'hearts' ? 'h-zone' : 'c-zone');
    zone.innerHTML = "";
    
    let emoji = "🎈";
    if(type === 'hearts') emoji = "❤️";
    if(type === 'coins') emoji = "🪙";

    spawnInterval = setInterval(() => {
        if(activeGame !== type) { clearInterval(spawnInterval); return; }
        const item = document.createElement('div');
        item.className = 'spawn-item';
        item.innerText = emoji;
        item.style.left = Math.random() * (zone.clientWidth - 50) + "px";

        if(type === 'coins') {
            // Coins spawn randomly anywhere inside the field
            item.style.top = Math.random() * (zone.clientHeight - 50) + "px";
            setTimeout(() => { item.remove(); }, 1200); // disappearing factor
        } else {
            // Balloons and Hearts float vertically
            let currentY = (type === 'balloon') ? 350 : -50;
            item.style.top = currentY + "px";
            let flight = setInterval(() => {
                currentY += (type === 'balloon') ? -4 : 4; // up or down speed
                item.style.top = currentY + "px";
                if(currentY < -60 || currentY > 360) { clearInterval(flight); item.remove(); }
            }, 16);
            item.flightTrigger = flight;
        }

        item.addEventListener('pointerdown', () => {
            if(item.flightTrigger) clearInterval(item.flightTrigger);
            item.remove();
            playerRef.child('score').set((players[playerId]?.score || 0) + 1);
        });
        zone.appendChild(item);
    }, type === 'coins' ? 600 : 450);
}
function evaluateRaceWinner() {
    const keys = Object.keys(players);
    const p1 = players[keys[0]], p2 = players[keys[1]];
    let w = "It's a Tie Game! 🤝";
    if(p1.score > p2.score) w = `${p1.name} Wins the Battle! 👑❤️`;
    if(p2.score > p1.score) w = `${p2.name} Wins the Battle! 👑❤️`;
    roomRef.child('raceState').update({ status: "ended", winnerName: w });
}
function stopRaceEngine(type, wName) {
    clearInterval(spawnInterval); spawnActive = false;
    document.getElementById(`${type}-zone`).innerHTML = "";
    document.getElementById(`${type}-status`).innerHTML = `🏁 <span style="color:#ffeaa7;">${wName}</span>`;
    document.getElementById(`${type}-start-btn`).classList.remove('hidden');
    document.getElementById(`${type}-start-btn`).innerText = "Play Again 🔄";
}