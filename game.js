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

let playerId, playerRef, roomRef;
let players = {};
let playerSprites = {};
let currentRoom = "";
let myName = "";

document.getElementById('connect-action-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('playerName').value.trim();
    const roomInput = document.getElementById('roomCode').value.trim();

    if(!nameInput || !roomInput) {
        alert("Naam aur Room Code dono enter karein!");
        return;
    }

    myName = nameInput;
    currentRoom = roomInput;
    
    // Switch to Connection animation screen
    document.getElementById('setup-panel').classList.add('hidden');
    document.getElementById('connection-panel').classList.remove('hidden');
    
    startMultiplayer();
});

function startMultiplayer() {
    playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    roomRef = database.ref(`rooms/${currentRoom}`);
    playerRef = database.ref(`rooms/${currentRoom}/players/${playerId}`);

    // Read global variable from script overlay safely
    let chosenEmoji = window.selectedEmoji || "👦";

    playerRef.set({
        id: playerId,
        name: myName,
        character: chosenEmoji,
        x: 400,
        y: 300
    });

    playerRef.onDisconnect().remove();

    // Trigger Connection Status animation screen update
    setTimeout(() => {
        document.getElementById('connection-status').innerText = "Connection Successful ❤️";
        setTimeout(() => {
            document.getElementById('welcome-screen').classList.add('hidden');
            initGameEngine();
        }, 1200);
    }, 1500);

    roomRef.child('players').on('value', (snapshot) => {
        players = snapshot.val() || {};
    });

    roomRef.child('players').on('child_removed', (snapshot) => {
        const id = snapshot.key;
        if(playerSprites[id]) {
            playerSprites[id].destroy();
            delete playerSprites[id];
        }
    });
}

function initGameEngine() {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'game-container',
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: { prepend: {}, create: create, update: update }
    };
    new Phaser.Game(config);
}

function create() {
    this.cameras.main.setBackgroundColor('#2c3e50');
    this.cursors = this.input.keyboard.createCursorKeys();
    this.add.text(20, 20, `Room: ${currentRoom} ❤️ Together Quest Map`, { fontSize: '16px', fill: '#fff' });
    
    this.input.on('pointerdown', (pointer) => {
        playerRef.update({ x: pointer.worldX, y: pointer.worldY });
    });
}

function update() {
    if (!playerId || !playerSprites) return;

    Object.keys(players).forEach((id) => {
        const playerData = players[id];

        if (!playerSprites[id]) {
            // Draw character emoji inside text graphic format directly inside canvas
            const charText = this.add.text(0, 0, playerData.character || "👦", { fontSize: '38px' }).setOrigin(0.5);
            const nameTag = this.add.text(0, -35, playerData.name, { fontSize: '14px', fill: '#ffffff', backgroundColor: '#000000a0', padding: {x:4, y:2} }).setOrigin(0.5);
            
            playerSprites[id] = this.add.container(playerData.x, playerData.y, [charText, nameTag]);
            this.physics.add.existing(playerSprites[id]);
        } else {
            playerSprites[id].x = playerData.x;
            playerSprites[id].y = playerData.y;
        }
    });

    let speed = 5;
    let localX = players[playerId]?.x || 400;
    let localY = players[playerId]?.y || 300;
    let moved = false;

    if (this.cursors.left.isDown) { localX -= speed; moved = true; }
    if (this.cursors.right.isDown) { localX += speed; moved = true; }
    if (this.cursors.up.isDown) { localY -= speed; moved = true; }
    if (this.cursors.down.isDown) { localY += speed; moved = true; }

    if (moved) {
        playerRef.update({ x: localX, y: localY });
    }
}