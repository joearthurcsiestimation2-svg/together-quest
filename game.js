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

// UI Trigger Events
document.getElementById('joinBtn').addEventListener('click', () => {
    myName = document.getElementById('playerName').value.trim();
    currentRoom = document.getElementById('roomCode').value.trim();

    if (!myName || !currentRoom) {
        alert("Naam aur Room Code enter karein! ❤️");
        return;
    }

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

    // Listen for Room Connections
    roomRef.child('players').on('value', (snapshot) => {
        players = snapshot.val() || {};
        const count = Object.keys(players).length;
        document.getElementById('hub-status').innerText = count === 2 ? "Dono Players Connected! Khelna Shuru Karein 🥰" : "Waiting for your partner to join...";
        
        if(activeGame === 'balloon') updateBalloonScoreboard();
        if(activeGame === 'rps') checkRPSResult();
    });

    // Sync Game Modes instantly across devices
    roomRef.child('activeScreen').on('value', (snapshot) => {
        const screen = snapshot.val();
        if (screen && screen !== activeGame) {
            showScreenLayout(screen);
        }
    });

    // Tic Tac Toe Move Listener
    roomRef.child('ttt/board').on('value', (snapshot) => {
        if(activeGame === 'ttt') renderTTTBoard(snapshot.val() || Array(9).fill(""));
    });
    roomRef.child('ttt/turn').on('value', (snapshot) => {
        if(activeGame === 'ttt') {
            const currentTurnId = snapshot.val();
            document.getElementById('ttt-status').innerText = currentTurnId === playerId ? "Your Turn! ⚡" : "Partner's Turn... 💭";
        }
    });
}

function switchGame(gameMode) {
    roomRef.update({ activeScreen: gameMode });
    if(gameMode === 'ttt') resetTicTacToe();
    if(gameMode === 'balloon') resetBalloonGame();
}

function backToHub() {
    roomRef.update({ activeScreen: "hub" });
}

function showScreenLayout(screen) {
    activeGame = screen;
    document.getElementById('hub-screen').classList.add('hidden');
    document.getElementById('game-ttt').classList.add('hidden');
    document.getElementById('game-rps').classList.add('hidden');
    document.getElementById('game-balloon').classList.add('hidden');

    if(screen === 'hub') document.getElementById('hub-screen').classList.remove('hidden');
    if(screen === 'ttt') document.getElementById('game-ttt').classList.remove('hidden');
    if(screen === 'rps') {
        document.getElementById('game-rps').classList.remove('hidden');
        document.getElementById('rps-result').innerText = "";
        playerRef.update({ currentMove: "" });
    }
    if(screen === 'balloon') {
        document.getElementById('game-balloon').classList.remove('hidden');
        startBalloonSpawner();
    }
}

// ==================== [1] TIC TAC TOE LOGIC ====================
function resetTicTacToe() {
    const playerKeys = Object.keys(players);
    roomRef.child('ttt').set({
        board: Array(9).fill(""),
        turn: playerKeys[0] || playerId
    });
}

function playTTT(index) {
    roomRef.child('ttt').once('value', (snapshot) => {
        const tttData = snapshot.val() || {};
        if (tttData.turn !== playerId) return; // Check turn
        
        let board = tttData.board || Array(9).fill("");
        if (board[index] !== "") return; // Cell already filled

        const playerKeys = Object.keys(players);
        const marker = playerKeys[0] === playerId ? "❌" : "⭕";
        board[index] = marker;

        const nextTurn = playerKeys[0] === playerId ? playerKeys[1] : playerKeys[0];
        roomRef.child('ttt').update({ board: board, turn: nextTurn });
    });
}

function renderTTTBoard(board) {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, idx) => {
        cell.innerText = board[idx] || "";
    });
}

// ==================== [2] ROCK PAPER SCISSORS LOGIC ====================
function playRPS(move) {
    playerRef.update({ currentMove: move });
    document.getElementById('rps-status').innerText = "Move Locked! Waiting for partner... 🔒";
}

function checkRPSResult() {
    const pKeys = Object.keys(players);
    if(pKeys.length < 2) return;
    
    const p1 = players[pKeys[0]];
    const p2 = players[pKeys[1]];

    if(p1.currentMove && p2.currentMove) {
        let resStr = `${p1.name}: ${p1.currentMove} vs ${p2.name}: ${p2.currentMove}<br><br>`;
        if(p1.currentMove === p2.currentMove) resStr += "It's a Tie! 🤝";
        else if (
            (p1.currentMove === '✊' && p2.currentMove === '✌️') ||
            (p1.currentMove === '✋' && p2.currentMove === '✊') ||
            (p1.currentMove === '✌️' && p2.currentMove === '✋')
        ) {
            resStr += `👑 ${p1.name} Wins! ❤️`;
        } else {
            resStr += `👑 ${p2.name} Wins! ❤️`;
        }
        document.getElementById('rps-result').innerHTML = resStr;
        document.getElementById('rps-status').innerText = "Round Finished!";
    }
}

// ==================== [3] BALLOON POP LOGIC ====================
let spawnInterval;
function resetBalloonGame() {
    playerRef.update({ score: 0 });
}

function startBalloonSpawner() {
    const zone = document.getElementById('b-zone');
    zone.innerHTML = "";
    clearInterval(spawnInterval);
    
    if(Object.keys(players).length < 2) return;

    spawnInterval = setInterval(() => {
        if(activeGame !== 'balloon') { clearInterval(spawnInterval); return; }
        
        const b = document.createElement('div');
        b.className = 'balloon';
        b.style.left = Math.random() * (zone.clientWidth - 60) + "px";
        b.style.top = "240px";
        
        // Random cute color assignment
        const colors = ['#ff4757', '#74b9ff', '#2ecc71', '#eccc68', '#a55eea'];
        b.style.background = colors[Math.floor(Math.random() * colors.length)];
        
        let currentPos = 240;
        let flight = setInterval(() => {
            currentPos -= 2;
            b.style.top = currentPos + "px";
            if(currentPos < -60) { clearInterval(flight); b.remove(); }
        }, 20);

        b.addEventListener('click', () => {
            clearInterval(flight);
            b.remove();
            playerRef.child('score').set((players[playerId]?.score || 0) + 1);
        });

        zone.appendChild(b);
    }, 1200);
}

function updateBalloonScoreboard() {
    const pKeys = Object.keys(players);
    if(pKeys.length === 2) {
        const me = players[playerId];
        const partnerId = pKeys[0] === playerId ? pKeys[1] : pKeys[0];
        const partner = players[partnerId];
        
        document.getElementById('my-pop-score').innerText = `You: ${me?.score || 0}`;
        document.getElementById('partner-pop-score').innerText = `${partner?.name || 'Partner'}: ${partner?.score || 0}`;
    }
}