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
let myCoins = 0;
let currentWorldLevel = 1;

// World definitions roadmap array configurations
const worldsConfig = [
    { name: "World 1 – Green Forest 🌲", color: "#27ae60", platform: "#1e824c" },
    { name: "World 2 – Snow Mountain ❄️", color: "#ecf0f1", platform: "#bdc3c7" },
    { name: "World 3 – Desert 🏜️", color: "#f1c40f", platform: "#d35400" },
    { name: "World 4 – Candy Land 🍭", color: "#fd79a8", platform: "#e84393" },
    { name: "World 5 – Space 🌌", color: "#2c3e50", platform: "#130f40" },
    { name: "World 6 – Love Castle ❤️", color: "#ff7675", platform: "#d63031" }
];

document.getElementById('connect-action-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('playerName').value.trim();
    const roomInput = document.getElementById('roomCode').value.trim();

    if(!nameInput || !roomInput) {
        alert("Naam aur Room Code enter karein!");
        return;
    }

    myName = nameInput;
    currentRoom = roomInput;

    document.getElementById('setup-panel').classList.add('hidden');
    document.getElementById('connection-panel').classList.remove('hidden');

    startMultiplayer();
});

function startMultiplayer() {
    playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    roomRef = database.ref(`rooms/${currentRoom}`);
    playerRef = database.ref(`rooms/${currentRoom}/players/${playerId}`);

    let chosenEmoji = window.selectedEmoji || "👦";

    playerRef.set({
        id: playerId,
        name: myName,
        character: chosenEmoji,
        hat: "",
        chatBubble: "",
        x: 100,
        y: 450
    });

    playerRef.onDisconnect().remove();

    // Setup initial clean sync listener for global room updates
    roomRef.on('value', (snapshot) => {
        const data = snapshot.val() || {};
        players = data.players || {};
        if (data.level && data.level !== currentWorldLevel) {
            currentWorldLevel = data.level;
            window.triggerLevelLoad();
        }
    });

    roomRef.child('players').on('child_removed', (snapshot) => {
        const id = snapshot.key;
        if(playerSprites[id]) { playerSprites[id].destroy(); delete playerSprites[id]; }
    });

    setTimeout(() => {
        document.getElementById('connection-status').innerText = "Connection Successful ❤️";
        setTimeout(() => {
            document.getElementById('welcome-screen').classList.add('hidden');
            runStoryIntroCutscene();
        }, 1000);
    }, 1500);
}

// --- STORY INTRO CUTSCENE HANDLER ---
function runStoryIntroCutscene() {
    const overlay = document.getElementById('story-overlay');
    const txt = document.getElementById('story-text');
    const btn = document.getElementById('story-next-btn');
    overlay.classList.remove('hidden');

    let clickCount = 0;
    btn.addEventListener('click', () => {
        clickCount++;
        if (clickCount === 1) {
            txt.innerText = "Sirf Sacha Teamwork hi tum dono ko wapas mila sakta hai! Sabhi puzzles hal karo aur aage barho. Go! 🚀";
        } else {
            overlay.classList.add('hidden');
            // Unhide Gameplay Overlays
            document.getElementById('game-hud').classList.remove('hidden');
            document.getElementById('chat-trigger').classList.remove('hidden');
            document.getElementById('shop-trigger').classList.remove('hidden');
            initGameEngine();
        }
    });
}

// --- CORE PHASER GAME SYSTEMS ---
let gameSceneContext;
function initGameEngine() {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'game-container',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default: 'arcade', arcade: { gravity: { y: 800 }, debug: false } },
        scene: { create: create, update: update }
    };
    new Phaser.Game(config);
}

let groundGroup, doorObject, buttonPlate, coinItem, enemyMonster;
let buttonPressedState = false;

function create() {
    gameSceneContext = this;
    window.triggerLevelLoad = () => { buildLevelLayout(gameSceneContext); };
    
    this.cursors = this.input.keyboard.createCursorKeys();
    buildLevelLayout(this);

    // Interactive Tap to Move support for mobile configurations
    this.input.on('pointerdown', (pointer) => {
        let currentX = players[playerId]?.x || 100;
        if (pointer.worldX > currentX) playerRef.update({ x: currentX + 40 });
        else playerRef.update({ x: currentX - 40 });
    });

    // Wire HTML UI Chat buttons directly into data push stream
    const chatBtns = document.querySelectorAll('.chat-btn');
    chatBtns.forEach(b => {
        b.addEventListener('click', () => {
            playerRef.update({ chatBubble: b.innerText });
            document.getElementById('chat-modal').classList.add('hidden');
            setTimeout(() => { playerRef.update({ chatBubble: "" }); }, 3000);
        });
    });

    // Wire Shop Buttons
    const shopBtns = document.querySelectorAll('.buy-btn');
    shopBtns.forEach(sb => {
        sb.addEventListener('click', () => {
            let cost = parseInt(sb.getAttribute('data-cost'));
            let cosmetic = sb.getAttribute('data-item');
            if(myCoins >= cost) {
                myCoins -= cost;
                document.getElementById('hud-coins').innerText = `🪙 Coins: ${myCoins}`;
                playerRef.update({ hat: cosmetic });
                alert("Purchased successfully! Apke avatar par cheez active ho gayi.");
                document.getElementById('shop-modal').classList.add('hidden');
            } else {
                alert("Coins kam hain! Aur levels clear karo.");
            }
        });
    });
}

function buildLevelLayout(scene) {
    let currentConfig = worldsConfig[currentWorldLevel - 1] || worldsConfig[0];
    document.getElementById('hud-world').innerText = currentConfig.name;

    scene.cameras.main.setBackgroundColor(currentConfig.color);

    // Reset old items if existing safely
    if (groundGroup) groundGroup.clear(true, true);
    if (doorObject) doorObject.destroy();
    if (buttonPlate) buttonPlate.destroy();
    if (coinItem) coinItem.destroy();
    if (enemyMonster) enemyMonster.destroy();

    groundGroup = scene.physics.add.staticGroup();

    // Create Platforms matching chosen world theme blocks
    let r1 = scene.add.rectangle(400, 570, 800, 60, Phaser.Display.Color.HexStringToColor(currentConfig.platform).color);
    let r2 = scene.add.rectangle(400, 380, 350, 30, Phaser.Display.Color.HexStringToColor(currentConfig.platform).color);
    groundGroup.add(r1);
    groundGroup.add(r2);
    scene.physics.add.existing(r1, true);
    scene.physics.add.existing(r2, true);

    // Puzzle Trigger Button Plate (Placed on upper platform balcony floor)
    buttonPlate = scene.add.rectangle(300, 355, 50, 10, 0xe74c3c);
    scene.physics.add.existing(buttonPlate, true);

    // Locked Door Gate blocking right pathway finish zone
    doorObject = scene.add.rectangle(750, 500, 30, 90, 0x95a5a6);
    scene.physics.add.existing(doorObject, true);

    // Collectible reward token item
    coinItem = scene.add.text(400, 300, "🪙", { fontSize: '32px' }).setOrigin(0.5);
    scene.physics.add.existing(coinItem, true);

    // Cute AI pacing security threat obstacle 
    let monsterEmoji = "👾";
    if (currentWorldLevel === 1) monsterEmoji = "🍏";
    if (currentWorldLevel === 2) monsterEmoji = "⛄";
    if (currentWorldLevel === 6) monsterEmoji = "🐉";

    enemyMonster = scene.add.text(450, 515, monsterEmoji, { fontSize: '32px' }).setOrigin(0.5);
    scene.physics.add.existing(enemyMonster, false);
    enemyMonster.body.setAllowGravity(false);
}

function update() {
    if (!playerId || !playerSprites || !gameSceneContext) return;

    let buttonTouchedThisFrame = false;

    Object.keys(players).forEach((id) => {
        const playerData = players[id];
        if (!playerData) return;

        if (!playerSprites[id]) {
            // Generate full graphical structure inside player container safely
            const emojiStr = playerData.character || "👦";
            const charText = gameSceneContext.add.text(0, 0, emojiStr, { fontSize: '38px' }).setOrigin(0.5);
            const nameTag = gameSceneContext.add.text(0, -35, playerData.name, { fontSize: '12px', fill: '#fff', backgroundColor: '#00000080', padding: 3 }).setOrigin(0.5);
            
            // Custom cosmetic accessories overlay text node placeholders
            const cosmeticNode = gameSceneContext.add.text(0, -55, playerData.hat || "", { fontSize: '24px' }).setOrigin(0.5);
            const chatBubbleNode = gameSceneContext.add.text(0, -80, playerData.chatBubble || "", { fontSize: '13px', fill: '#000', backgroundColor: '#fff', padding: 4 }).setOrigin(0.5);
            chatBubbleNode.alpha = playerData.chatBubble ? 1 : 0;

            playerSprites[id] = gameSceneContext.add.container(playerData.x, playerData.y, [charText, nameTag, cosmeticNode, chatBubbleNode]);
            gameSceneContext.physics.add.existing(playerSprites[id]);
            playerSprites[id].body.setCollideWorldBounds(true);
            
            // Apply standard platform colliders rule
            gameSceneContext.physics.add.collider(playerSprites[id], groundGroup);
        } else {
            // Sync adjustments
            if (id !== playerId) {
                playerSprites[id].x = Phaser.Math.Linear(playerSprites[id].x, playerData.x, 0.3);
                playerSprites[id].y = Phaser.Math.Linear(playerSprites[id].y, playerData.y, 0.3);
            }
            // Update cosmetic frames data values on fly dynamically
            playerSprites[id].list[2].text = playerData.hat || "";
            playerSprites[id].list[3].text = playerData.chatBubble || "";
            playerSprites[id].list[3].alpha = playerData.chatBubble ? 1 : 0;
        }

        // Check if anyone is standing on the pressure lever plate button
        if(buttonPlate && gameSceneContext.physics.overlap(playerSprites[id], buttonPlate)) {
            buttonTouchedThisFrame = true;
        }

        // Check if player runs into enemy monster hazard boundaries
        if(enemyMonster && gameSceneContext.physics.overlap(playerSprites[id], enemyMonster)) {
            if (id === playerId) {
                // Instantly hit reset backward safely
                playerRef.update({ x: 100, y: 450 });
            }
        }

        // Check if client overlaps and touches coin collector zone
        if(coinItem && gameSceneContext.physics.overlap(playerSprites[id], coinItem)) {
            coinItem.destroy();
            coinItem = null;
            if (id === playerId) {
                myCoins += 10;
                document.getElementById('hud-coins').innerText = `🪙 Coins: ${myCoins}`;
            }
        }

        // Trigger level complete transition win conditions if boundary reached
        if (playerData.x > 730 && currentWorldLevel <= 6) {
            if (id === playerId) {
                handleLevelWinAdvance();
            }
        }
    });

    // Control Lever Gates Door opening logic operations states via button weight checked
    if (buttonTouchedThisFrame !== buttonPressedState) {
        buttonPressedState = buttonTouchedThisFrame;
        if(buttonPressedState) {
            buttonPlate.setFillStyle(0x2ecc71);
            if(doorObject) doorObject.destroy();
            doorObject = null;
        } else {
            buttonPlate.setFillStyle(0xe74c3c);
            if(!doorObject) {
                doorObject = gameSceneContext.add.rectangle(750, 500, 30, 90, 0x95a5a6);
                gameSceneContext.physics.add.existing(doorObject, true);
            }
        }
    }

    // Pacing logic loop pattern for moving obstacle monster horizontally
    if(enemyMonster && enemyMonster.body) {
        let time = gameSceneContext.time.now * 0.002;
        enemyMonster.x = 500 + Math.sin(time) * 120;
    }

    // Local execution movement loop handling scripts for keyboard users
    let localBody = playerSprites[playerId];
    if (localBody && localBody.body) {
        let speedX = 0;
        if (gameSceneContext.cursors.left.isDown) speedX = -220;
        else if (gameSceneContext.cursors.right.isDown) speedX = 220;
        
        localBody.body.setVelocityX(speedX);

        if (gameSceneContext.cursors.up.isDown && localBody.body.touching.down) {
            localBody.body.setVelocityY(-450);
        }

        // Constantly stream raw vector outputs back into network nodes updates arrays
        playerRef.update({ x: localBody.x, y: localBody.y });
    }
}

function handleLevelWinAdvance() {
    if (currentWorldLevel < 6) {
        currentWorldLevel++;
        roomRef.update({ level: currentWorldLevel });
        playerRef.update({ x: 100, y: 450 });
    } else {
        // Trigger Love Castle Grand Finale Final Ending sequence screen state
        document.getElementById('game-hud').classList.add('hidden');
        document.getElementById('chat-trigger').classList.add('hidden');
        document.getElementById('shop-trigger').classList.add('hidden');
        
        // Wipe engine frames to cleanly load full display celebration panel cards
        if(gameSceneContext) gameSceneContext.game.destroy(true);

        const overlay = document.getElementById('story-overlay');
        overlay.classList.remove('hidden');
        overlay.style.background = "linear-gradient(45deg, #ff7675, #ef5777)";
        document.querySelector('.guide-avatar').innerText = "👑❤️🎉";
        document.querySelector('.story-box').style.borderColor = "#fff";
        document.getElementById('story-text').innerHTML = "<b style='font-size:24px;'>🎉 QUEST COMPLETED! 🎉</b><br><br>The greatest adventures are the ones completed together. ❤️<br><br>Bridge ban gaya hai aur aap dono mil chuke hain! 🏰🎇";
        document.getElementById('story-next-btn').innerText = "Play Again 🔄";
        document.getElementById('story-next-btn').onclick = () => { location.reload(); };
    }
}