// --- APNA FIREBASE CONFIG YAHAN SET HAI ---
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

document.getElementById('joinBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('playerName').value.trim();
    const roomInput = document.getElementById('roomCode').value.trim();

    if(!nameInput || !roomInput) {
        alert("Naam aur Room Code dono enter karein!");
        return;
    }

    myName = nameInput;
    currentRoom = roomInput;
    document.getElementById('lobby-ui').classList.add('hidden');
    startMultiplayer();
});

function startMultiplayer() {
    playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    roomRef = database.ref(`rooms/${currentRoom}`);
    playerRef = database.ref(`rooms/${currentRoom}/players/${playerId}`);

    playerRef.set({
        id: playerId,
        name: myName,
        x: 400,
        y: 300,
        color: Math.random() * 0xffffff
    });

    playerRef.onDisconnect().remove();

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

    initGameEngine();
}

function initGameEngine() {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'game-container',
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: { prepend: {}, create: create, update: update }
    };
    new Phaser.Game(config);
}

function create() {
    this.cameras.main.setBackgroundColor('#34495e');
    this.cursors = this.input.keyboard.createCursorKeys();
    this.add.text(20, 20, `Room: ${currentRoom} ❤️ Connected`, { fontSize: '16px', fill: '#fff' });
    
    // Mobile touch controls support
    this.input.on('pointerdown', (pointer) => {
        playerRef.update({ x: pointer.x, y: pointer.y });
    });
}

function update() {
    if (!playerId || !playerSprites) return;

    Object.keys(players).forEach((id) => {
        const playerData = players[id];

        if (!playerSprites[id]) {
            const circle = this.add.circle(playerData.x, playerData.y, 20, playerData.color);
            const nameTag = this.add.text(playerData.x, playerData.y - 35, playerData.name, { fontSize: '14px', fill: '#ffffff' }).setOrigin(0.5);
            playerSprites[id] = this.add.container(0, 0, [circle, nameTag]);
            this.physics.add.existing(playerSprites[id]);
        } else {
            playerSprites[id].x = Phaser.Math.Linear(playerSprites[id].x, playerData.x, 0.2);
            playerSprites[id].y = Phaser.Math.Linear(playerSprites[id].y, playerData.y, 0.2);
        }
    });

    let speed = 4;
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