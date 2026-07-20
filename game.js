// --- FIREBASE SETTINGS CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDK7KDuxzivTm6SskJkzzsWIe2ATqKg28A",
    authDomain: "togetherquest-9f3b7.firebaseapp.com",
    databaseURL: "https://togetherquest-9f3b7-default-rtdb.firebaseio.com/",
    projectId: "togetherquest-9f3b7",
    storageBucket: "togetherquest-9f3b7.firebasestorage.app",
    messagingSenderId: "113517858109",
    appId: "1:113517858109:web:f59b1787dbf7bce85e8954"
};

// Global Systems Initialization
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let playerId, playerRef, roomRef;
let players = {};
let playerSprites = {};
let currentRoom = "";
let myName = "";

// UI Connections Logic
document.getElementById('joinBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('playerName').value.trim();
    const roomInput = document.getElementById('roomCode').value.trim();

    if (!nameInput || !roomInput) {
        alert("Naam aur Room Code dono daalna zaroori hai! ❤️");
        return;
    }

    myName = nameInput;
    currentRoom = roomInput;
    
    // Hide UI Overlay window
    document.getElementById('lobby-ui').classList.add('hidden');
    
    // Connect to Cloud Database Network
    startMultiplayerEngine();
});

function startMultiplayerEngine() {
    // Generate Unique Device Key ID
    playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    
    roomRef = database.ref('rooms/' + currentRoom);
    playerRef = database.ref('rooms/' + currentRoom + '/players/' + playerId);

    // Save initial configuration on Firebase
    playerRef.set({
        id: playerId,
        name: myName,
        x: 400,
        y: 300,
        color: Math.random() * 0xffffff
    });

    // Auto delete loop hook if user leaves or close browser window tab
    playerRef.onDisconnect().remove();

    // Data Sync Watcher Loop
    roomRef.child('players').on('value', (snapshot) => {
        players = snapshot.val() || {};
    });

    // Handle character cleanup when a player goes offline
    roomRef.child('players').on('child_removed', (snapshot) => {
        const id = snapshot.key;
        if (playerSprites[id]) {
            playerSprites[id].destroy();
            delete playerSprites[id];
        }
    });

    // Trigger Phaser Game Canvas View Framework Execution
    launchPhaserGraphicsView();
}

function launchPhaserGraphicsView() {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'game-container',
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false }
        },
        scene: { create: gameCreate, update: gameUpdate }
    };
    new Phaser.Game(config);
}

function gameCreate() {
    // Setup Dark Aesthetic Background Grid System Canvas
    this.cameras.main.setBackgroundColor('#2c3e50');
    
    // Bind Keyboard standard arrows interface mappings
    this.cursors = this.input.keyboard.createCursorKeys();
    
    // Output Active Connection Success Status Message
    this.add.text(25, 25, "Room: " + currentRoom + " | Status: Connected ❤️", { 
        fontSize: '18px', 
        fill: '#2ecc71',
        fontStyle: 'bold'
    });

    // Track Mobile Pointer Taps Anywhere on Display Area
    this.input.on('pointerdown', (pointer) => {
        playerRef.update({ x: pointer.worldX, y: pointer.worldY });
    });
}

function gameUpdate() {
    if (!playerId || !playerSprites) return;

    // Loop through the data to render character bubbles dynamically
    Object.keys(players).forEach((id) => {
        const data = players[id];

        if (!playerSprites[id]) {
            const circle = this.add.circle(0, 0, 22, data.color);
            const textStyle = { fontSize: '14px', fill: '#ffffff', fontStyle: 'bold', backgroundColor: '#00000055', padding: 4 };
            const nameTag = this.add.text(0, -38, data.name, textStyle).setOrigin(0.5);
            
            playerSprites[id] = this.add.container(data.x, data.y, [circle, nameTag]);
            this.physics.add.existing(playerSprites[id]);
        } else {
            // Update positioning values instantly match coordinates mirror exact
            playerSprites[id].x = data.x;
            playerSprites[id].y = data.y;
        }
    });

    // Keyboard Key Action Processing Loops
    let walkSpeed = 5;
    let localX = players[playerId]?.x || 400;
    let localY = players[playerId]?.y || 300;
    let didMove = false;

    if (this.cursors.left.isDown) { localX -= walkSpeed; didMove = true; }
    if (this.cursors.right.isDown) { localX += walkSpeed; didMove = true; }
    if (this.cursors.up.isDown) { localY -= walkSpeed; didMove = true; }
    if (this.cursors.down.isDown) { localY += walkSpeed; didMove = true; }

    if (didMove) {
        playerRef.update({ x: localX, y: localY });
    }
}