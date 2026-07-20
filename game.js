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
let selectedCharacter = "Casual Boy"; 
let activeWorldTheme = "#2c3e50"; // Default background color
let phaserGameInstance = null;
let storyStep = 0;

// --- UI NAVIGATION LOGIC ---
document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
});

function selectChar(charName) {
    selectedCharacter = charName;
    document.querySelectorAll('.char-option').forEach(el => el.classList.remove('selected'));
    event.target.classList.add('selected');
}

document.getElementById('readyBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('playerName').value.trim();
    if (!nameInput) {
        alert("Pehle apna naam likhein! 🥰");
        return;
    }
    myName = nameInput;
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('room-screen').classList.remove('hidden');
});

document.getElementById('joinBtn').addEventListener('click', () => {
    const roomInput = document.getElementById('roomCode').value.trim();
    if (!roomInput) {
        alert("Room Code enter karein!");
        return;
    }
    currentRoom = roomInput;
    document.getElementById('room-screen').classList.add('hidden');
    
    // Trigger Chapter 4 Story Cutscene first!
    document.getElementById('story-overlay').classList.remove('hidden');
});

// Chapter 4 Dialogue Sequencing Logic
document.getElementById('storyNextBtn').addEventListener('click', () => {
    storyStep++;
    const textElement = document.getElementById('story-text');
    
    if (storyStep === 1) {
        textElement.innerHTML = "Sirf teamwork aur sachi mohabbat se hi tum dono mil sakte ho! 🧩🤝";
    } else if (storyStep === 2) {
        // Close Story and launch Map Choice View
        document.getElementById('story-overlay').classList.add('hidden');
        document.getElementById('world-map-overlay').classList.remove('hidden');
    }
});

// World Selection triggers backend sync execution
function selectWorld(worldName, themeColor) {
    activeWorldTheme = themeColor;
    document.getElementById('world-map-overlay').classList.add('hidden');
    
    // Connect to Firebase and Launch Game Loop
    startMultiplayerEngine();
}

function startMultiplayerEngine() {
    playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    roomRef = database.ref('rooms/' + currentRoom);
    playerRef = database.ref('rooms/' + currentRoom + '/players/' + playerId);

    playerRef.set({
        id: playerId,
        name: myName,
        character: selectedCharacter,
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
        if (playerSprites[id]) {
            playerSprites[id].destroy();
            delete playerSprites[id];
        }
    });

    launchPhaserGraphicsView();
}

function launchPhaserGraphicsView() {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'game-container',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: { create: gameCreate, update: gameUpdate }
    };
    phaserGameInstance = new Phaser.Game(config);
}

let cloudLayer;

function gameCreate() {
    // Dynamic theme mapping assigned by World Choice View selection buttons
    this.cameras.main.setBackgroundColor(activeWorldTheme);
    
    // Clouds system setup
    cloudLayer = this.add.group();
    for (let i = 0; i < 5; i++) {
        let cloud = this.add.circle(Phaser.Math.Between(0, 800), Phaser.Math.Between(50, 200), Phaser.Math.Between(30, 60), 0xffffff, 0.4);
        this.physics.add.existing(cloud);
        cloudLayer.add(cloud);
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    
    this.add.text(25, 25, "Room: " + currentRoom + " ❤️ Teamwork Active", { 
        fontSize: '18px', fill: '#ffffff', fontStyle: 'bold'
    });

    this.input.on('pointerdown', (pointer) => {
        playerRef.update({ x: pointer.worldX, y: pointer.worldY });
    });
}

function gameUpdate() {
    // Soft animate clouds loop background view
    cloudLayer.getChildren().forEach(cloud => {
        cloud.x += 0.5;
        if (cloud.x > 850) {
            cloud.x = -50;
            cloud.y = Phaser.Math.Between(50, 200);
        }
    });

    if (!playerId || !playerSprites) return;

    Object.keys(players).forEach((id) => {
        const data = players[id];

        if (!playerSprites[id]) {
            const circle = this.add.circle(0, 0, 22, data.color);
            const labelStr = data.name + "\n(" + data.character + ")";
            const nameTag = this.add.text(0, -45, labelStr, { 
                fontSize: '12px', fill: '#ffffff', fontStyle: 'bold', align: 'center', backgroundColor: '#00000088', padding: 4 
            }).setOrigin(0.5);
            
            playerSprites[id] = this.add.container(data.x, data.y, [circle, nameTag]);
            this.physics.add.existing(playerSprites[id]);
        } else {
            playerSprites[id].x = data.x;
            playerSprites[id].y = data.y;
        }
    });

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