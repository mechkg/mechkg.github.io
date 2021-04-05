"use strict";
const CAGE_WIDTH = 10;
const CAGE_HEIGHT = 10;
const TRIGGER_WIDTH = 5;
const TRIGGER_HEIGHT = 1;
class Cage {
    constructor(cagePosX, cagePosY, triggerPosX, triggerPosY, worldMove) {
        this.cagePosX = cagePosX;
        this.cagePosY = cagePosY;
        this.triggerPosX = triggerPosX;
        this.triggerPosY = triggerPosY;
        this.worldMove = worldMove;
        this.ground = false;
        this.triggerDown = false;
        this.cageVelY = 0;
        this.released = false;
    }
    release() {
        this.released = true;
    }
    triggerPressed() {
        if (!this.triggerDown) {
            this.triggerPosY += TRIGGER_HEIGHT * 0.4;
            this.triggerDown = true;
            this.release();
            this.updateSprites();
        }
    }
    isTriggerDown() {
        return this.triggerDown;
    }
    triggerReleased() {
        if (this.triggerDown) {
            this.triggerPosY -= TRIGGER_HEIGHT * 0.4;
            this.triggerDown = false;
            this.updateSprites();
        }
    }
    updateSprites() {
        const scale = window.innerWidth / WORLD_WIDTH;
        const windowCenterX = window.innerWidth / 2;
        const windowCenterY = window.innerHeight / 2;
        if (this.cageSprite) {
            this.cageSprite.style.width = `${CAGE_WIDTH * scale}px`;
            this.cageSprite.style.height = `${CAGE_HEIGHT * scale}px`;
            this.cageSprite.style.left = `${this.cagePosX * scale + windowCenterX}px`;
            this.cageSprite.style.top = `${this.cagePosY * scale + windowCenterY}px`;
        }
        if (this.triggerSprite) {
            this.triggerSprite.style.width = `${TRIGGER_WIDTH * scale}px`;
            this.triggerSprite.style.height = `${TRIGGER_HEIGHT * scale}px`;
            this.triggerSprite.style.left = `${this.triggerPosX * scale + windowCenterX}px`;
            this.triggerSprite.style.top = `${this.triggerPosY * scale + windowCenterY}px`;
        }
    }
    createSprites() {
        this.cageSprite = document.createElement('div');
        this.cageSprite.classList.add('cage');
        this.triggerSprite = document.createElement('div');
        this.triggerSprite.classList.add('trigger');
        this.updateSprites();
        document.body.insertBefore(this.cageSprite, null);
        document.body.insertBefore(this.triggerSprite, null);
    }
    onLoad() {
        this.createSprites();
    }
    onWindowResize() {
        this.updateSprites();
    }
    update(dt) {
        if (this.released && !this.ground) {
            this.cageVelY += GRAVITY * dt;
            const moveResult = this.worldMove(new Rect(this.cagePosX, this.cagePosY, CAGE_WIDTH, CAGE_HEIGHT), 0, this.cageVelY * dt);
            this.cagePosY = moveResult.y;
            if (moveResult.hitGround) {
                this.cageVelY = 0;
                this.ground = true;
            }
            this.updateSprites();
        }
    }
    getTrapRect() {
        return new Rect(this.cagePosX, this.cagePosY, CAGE_WIDTH, CAGE_HEIGHT);
    }
    getTriggerRect() {
        return new Rect(this.triggerPosX, this.triggerPosY, TRIGGER_WIDTH, TRIGGER_HEIGHT);
    }
    isActive() {
        return this.released && !this.ground;
    }
    isUsed() {
        return this.ground;
    }
}
const WORLD_WIDTH = 200;
const CAGE_CATCH_THRESHOLD = 2;
class Rect {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
}
const actors = [];
const traps = [];
const domClients = [];
const monsters = [];
let platforms;
let player;
let lastFrameTime;
let gameInProgress = true;
let currentLevel = 0;
const MAX_LEVEL = 0;
function loadLevel(level) {
    let url = window.location.href;
    if (url.indexOf('?') > -1) {
        url = url.substr(0, url.indexOf('?'));
    }
    window.location.href = url + `?level=${level}`;
}
function gameLost(message) {
    if (!gameInProgress)
        return;
    gameInProgress = false;
    const announcement = document.getElementById('announcement');
    if (announcement) {
        announcement.classList.add('lost');
        announcement.style.display = 'inherit';
        announcement.innerHTML = `${message}<br><span style="font-size: 50%">Press Space to try again!</span>`;
    }
    window.addEventListener('keydown', (event) => {
        if (event.code == 'Space' && !event.repeat) {
            loadLevel(currentLevel);
        }
    });
}
function gameWon(message) {
    if (!gameInProgress)
        return;
    gameInProgress = false;
    const announcement = document.getElementById('announcement');
    if (announcement) {
        announcement.classList.add('won');
        announcement.style.display = 'inherit';
        if (currentLevel < MAX_LEVEL)
            announcement.innerHTML = `${message}<br><span style="font-size: 50%">Press Space to advance to the next level</span>`;
        else
            announcement.innerHTML = `${message}<br><span style="font-size: 50%">You beat the game!</span>`;
    }
    window.addEventListener('keydown', (event) => {
        if (event.code == 'Space' && !event.repeat) {
            loadLevel(currentLevel + 1);
        }
    });
}
function nextFrame(time) {
    if (lastFrameTime === undefined)
        lastFrameTime = time;
    else {
        const dtSec = (time - lastFrameTime) / 1000.0;
        for (let i = 0; i < actors.length; ++i) {
            actors[i].update(dtSec);
        }
        for (let i = 0; i < traps.length; ++i) {
            let overlap = false;
            if (rectsOverlap(traps[i].getTriggerRect(), player.getRect()))
                overlap = true;
            for (let j = 0; j < monsters.length; ++j) {
                if (rectsOverlap(traps[i].getTriggerRect(), monsters[j].getRect()))
                    overlap = true;
            }
            if (overlap)
                traps[i].triggerPressed();
            else if (traps[i].isTriggerDown())
                traps[i].triggerReleased();
            const trapRect = adjustRect(traps[i].getTrapRect(), CAGE_CATCH_THRESHOLD, 0);
            if (rectsOverlap(trapRect, player.getRect()) && cageCheckX(player.getRect(), trapRect) && traps[i].isActive()) {
                player.trapped = true;
                player.posX = trapRect.x + trapRect.width / 2 - PLAYER_WIDTH / 2;
                player.posY = trapRect.y + trapRect.height - PLAYER_HEIGHT;
                gameLost('You trapped yourself 🤦');
            }
            for (let j = 0; j < monsters.length; ++j) {
                if (rectsOverlap(trapRect, monsters[j].getRect()) && cageCheckX(monsters[j].getRect(), trapRect) && traps[i].isActive()) {
                    monsters[j].trapped = true;
                    monsters[j].posX = trapRect.x + trapRect.width / 2 - MONSTER_WIDTH / 2;
                    monsters[j].posY = trapRect.y + trapRect.height - MONSTER_HEIGHT;
                }
            }
        }
        let allMonstersTrapped = true;
        for (let i = 0; i < monsters.length; ++i) {
            if (!monsters[i].triggered && Math.sqrt(Math.pow(monsters[i].posX - player.posX, 2) + Math.pow(monsters[i].posY - player.posY, 2)) < MONSTER_TRIGGER_RANGE) {
                monsters[i].trigger();
            }
            let monsterRect = adjustRect(monsters[i].getRect(), 1, 1);
            if (rectsOverlap(monsterRect, player.getRect())) {
                player.trapped = true;
                gameLost('Om nom nom nom 👹');
            }
            if (!monsters[i].trapped)
                allMonstersTrapped = false;
        }
        if (allMonstersTrapped)
            gameWon('Well done! 👏');
        let allTrapsUsed = !traps.some((trap) => !trap.isUsed());
        if (allTrapsUsed)
            gameLost('All the traps are gone 😖');
        lastFrameTime = time;
    }
    requestAnimationFrame(nextFrame);
}
function cageCheckX(rect1, rect2) {
    const leftEdge = (rect1.x < rect2.x) && (((rect1.x + rect1.width) - rect2.x) > CAGE_CATCH_THRESHOLD);
    const rightEdge = (rect1.x + rect1.width > rect2.x + rect2.width) && (((rect2.x + rect2.width) - rect1.x) > CAGE_CATCH_THRESHOLD);
    const inside = (rect1.x > rect2.x && rect1.x + rect1.width < rect2.x + rect2.width);
    return leftEdge || rightEdge || inside;
}
function adjustRect(rect, x, y) {
    return {
        x: rect.x + x,
        y: rect.y + y,
        width: rect.width - 2 * x,
        height: rect.height - 2 * y
    };
}
function rectsOverlap(rect1, rect2) {
    return ((rect1.x + rect1.width) > rect2.x &&
        rect1.x < (rect2.x + rect2.width) &&
        (rect1.y + rect1.height) > rect2.y &&
        rect1.y < (rect2.y + rect2.height));
}
function worldMoveY(rect, offsetY) {
    const targetRect = {
        x: rect.x,
        y: rect.y + offsetY,
        width: rect.width,
        height: rect.height
    };
    for (let i = 0; i < platforms.rects.length; ++i) {
        if (rectsOverlap(targetRect, platforms.rects[i]))
            return {
                y: offsetY > 0 ? platforms.rects[i].y - targetRect.height : platforms.rects[i].y + platforms.rects[i].height,
                hitGround: offsetY > 0,
                hitCeiling: offsetY <= 0
            };
    }
    for (let i = 0; i < traps.length; ++i) {
        const trapRect = traps[i].getTrapRect();
        if (rectsOverlap(targetRect, trapRect))
            return {
                y: offsetY > 0 ? trapRect.y - targetRect.height : trapRect.y + trapRect.height,
                hitGround: offsetY > 0,
                hitCeiling: offsetY <= 0
            };
    }
    return {
        y: targetRect.y,
        hitGround: false,
        hitCeiling: false
    };
}
function worldMoveX(rect, offsetX) {
    const targetRect = {
        x: rect.x + offsetX,
        y: rect.y,
        width: rect.width,
        height: rect.height
    };
    if (offsetX < 0 && targetRect.x < -WORLD_WIDTH / 2)
        return {
            x: -WORLD_WIDTH / 2,
            hitWall: true
        };
    if (offsetX > 0 && (targetRect.x + targetRect.width) > WORLD_WIDTH / 2)
        return {
            x: WORLD_WIDTH / 2 - targetRect.width,
            hitWall: true
        };
    for (let i = 0; i < platforms.rects.length; ++i) {
        if (rectsOverlap(targetRect, platforms.rects[i]))
            return {
                x: (offsetX > 0) ? platforms.rects[i].x - rect.width : platforms.rects[i].x + platforms.rects[i].width,
                hitWall: true
            };
    }
    for (let i = 0; i < traps.length; ++i) {
        const trapRect = traps[i].getTrapRect();
        if (rectsOverlap(targetRect, trapRect))
            return {
                x: (offsetX > 0) ? trapRect.x - rect.width : trapRect.x + trapRect.width,
                hitWall: true
            };
    }
    return {
        x: targetRect.x,
        hitWall: false
    };
}
function worldMove(rect, offsetX, offsetY) {
    const moveXResult = worldMoveX(rect, offsetX);
    const moveYResult = worldMoveY(new Rect(moveXResult.x, rect.y, rect.width, rect.height), offsetY);
    return {
        x: moveXResult.x,
        y: moveYResult.y,
        hitGround: moveYResult.hitGround,
        hitCeiling: moveYResult.hitCeiling,
        hitWall: moveXResult.hitWall
    };
}
function setupLevel0() {
    const platformRects = [
        new Rect(-100, 20, 200, 5),
    ];
    platforms = new Platforms(platformRects);
    player = new Player(0, 0, worldMove);
    const monster = new Monster(-60, 0, worldMove, player);
    const cage = new Cage(20, -7, 12, 19.5, worldMove);
    domClients.push(player);
    domClients.push(monster);
    domClients.push(platforms);
    domClients.push(cage);
    actors.push(player);
    actors.push(monster);
    actors.push(cage);
    traps.push(cage);
    monsters.push(monster);
}
window.onload = () => {
    const url = window.location.href;
    if (url.indexOf('?') > -1) {
        let levelStr = url.substr(url.indexOf('level=') + 6);
        currentLevel = parseInt(levelStr);
        if (isNaN(currentLevel) || currentLevel > MAX_LEVEL)
            currentLevel = 0;
    }
    switch (currentLevel) {
        case 0:
            setupLevel0();
            break;
    }
    domClients.forEach((c) => c.onLoad());
    requestAnimationFrame(nextFrame);
};
window.onresize = () => {
    domClients.forEach((c) => c.onWindowResize());
};
const MONSTER_WIDTH = 7 / 1.09;
const MONSTER_HEIGHT = 7;
const MONSTER_ACCELERATION_GROUND = 200;
const MONSTER_FRICTION_COEFF = 6;
const MONSTER_JUMP_IMPULSE = 60;
const MONSTER_ROAM_PERIOD = 0.5;
const MONSTER_TRIGGER_RANGE = 15;
class Monster {
    constructor(x, y, worldMove, player) {
        this.posX = x;
        this.posY = y;
        this.worldMove = worldMove;
        this.ground = false;
        this.velX = 0;
        this.velY = 0;
        this.time = 0;
        this.triggered = false;
        this.roamTime = 0;
        this.trapped = false;
        this.runInput = 1;
        this.jumpInput = false;
    }
    trigger() {
        this.triggered = true;
    }
    update(dt) {
        if (this.trapped) {
            if (this.sprite)
                this.sprite.style.transform = '';
            this.updateSprite();
            return;
        }
        this.time += dt;
        this.roamTime += dt;
        if (this.triggered) {
            if (Math.abs(this.posX - player.posX) < MONSTER_WIDTH / 2)
                this.runInput = 0;
            else if (this.posX < player.posX)
                this.runInput = 1;
            else if (this.posX > player.posX)
                this.runInput = -1;
        }
        else {
            if (this.roamTime > MONSTER_ROAM_PERIOD) {
                this.roamTime = 0;
                this.runInput = -this.runInput;
            }
        }
        this.velX += this.runInput * MONSTER_ACCELERATION_GROUND * dt;
        this.velX -= this.velX * MONSTER_FRICTION_COEFF * dt;
        if (this.ground && this.jumpInput) {
            this.velY -= MONSTER_JUMP_IMPULSE;
            this.ground = false;
        }
        this.velY += GRAVITY * dt;
        const moveResult = this.worldMove(new Rect(this.posX, this.posY, MONSTER_WIDTH, MONSTER_HEIGHT), this.velX * dt, this.velY * dt);
        if (moveResult.hitGround || moveResult.hitCeiling) {
            this.velY = 0;
        }
        if (moveResult.hitWall) {
            this.velX = 0;
        }
        this.posX = moveResult.x;
        this.posY = moveResult.y;
        this.ground = moveResult.hitGround;
        const scale = window.innerWidth / WORLD_WIDTH;
        const windowCenterX = window.innerWidth / 2;
        const windowCenterY = window.innerHeight / 2;
        if (this.sprite) {
            this.sprite.style.left = `${this.posX * scale + windowCenterX}px`;
            this.sprite.style.top = `${this.posY * scale + windowCenterY}px`;
            const scaleT = this.velX > 0 ? 'scaleX(-1)' : 'scaleX(1)';
            const rotateT = (Math.abs(this.velX) > 1.5) ? `rotate(${Math.sin(this.time * 20) * (this.triggered ? 15 : 5)}deg)` : '';
            this.sprite.style.transform = `${scaleT} ${rotateT}`;
        }
    }
    getRect() {
        return new Rect(this.posX, this.posY, MONSTER_WIDTH, MONSTER_HEIGHT);
    }
    updateSprite() {
        const scale = window.innerWidth / WORLD_WIDTH;
        const windowCenterX = window.innerWidth / 2;
        const windowCenterY = window.innerHeight / 2;
        if (this.sprite) {
            this.sprite.style.width = `${MONSTER_WIDTH * scale}px`;
            this.sprite.style.height = `${MONSTER_HEIGHT * scale}px`;
            this.sprite.style.left = `${this.posX * scale + windowCenterX}px`;
            this.sprite.style.top = `${this.posY * scale + windowCenterY}px`;
        }
    }
    createSprite() {
        this.sprite = document.createElement('div');
        this.sprite.classList.add('monster');
        this.updateSprite();
        document.body.insertBefore(this.sprite, null);
    }
    deleteSprite() {
        if (this.sprite) {
            document.body.removeChild(this.sprite);
            this.sprite = undefined;
        }
    }
    onLoad() {
        this.createSprite();
    }
    onWindowResize() {
        this.updateSprite();
    }
}
class Platforms {
    constructor(platforms) {
        this.rects = platforms;
        this.divs = [];
    }
    onLoad() {
        const scale = window.innerWidth / WORLD_WIDTH;
        const windowCenterX = window.innerWidth / 2;
        const windowCenterY = window.innerHeight / 2;
        for (let i = 0; i < this.rects.length; ++i) {
            const el = document.createElement('div');
            el.classList.add('platform');
            el.style.width = `${this.rects[i].width * scale}px`;
            el.style.height = `${this.rects[i].height * scale}px`;
            el.style.left = `${this.rects[i].x * scale + windowCenterX}px`;
            el.style.top = `${this.rects[i].y * scale + windowCenterY}px`;
            this.divs.push(el);
            document.body.insertBefore(el, null);
        }
    }
    onWindowResize() {
        const scale = window.innerWidth / WORLD_WIDTH;
        const windowCenterX = window.innerWidth / 2;
        const windowCenterY = window.innerHeight / 2;
        for (let i = 0; i < this.rects.length; ++i) {
            if (this.divs[i]) {
                this.divs[i].style.width = `${this.rects[i].width * scale}px`;
                this.divs[i].style.height = `${this.rects[i].height * scale}px`;
                this.divs[i].style.left = `${this.rects[i].x * scale + windowCenterX}px`;
                this.divs[i].style.top = `${this.rects[i].y * scale + windowCenterY}px`;
            }
        }
    }
}
const KEY_CODE_LEFT = 'KeyA';
const KEY_CODE_RIGHT = 'KeyD';
const KEY_CODE_JUMP = 'Space';
const PLAYER_WIDTH = 5 / 1.275;
const PLAYER_HEIGHT = 5;
const PLAYER_ACCELERATION_GROUND = 200;
const PLAYER_FRICTION_COEFF = 5;
const PLAYER_MAX_SPEED = 10;
const PLAYER_JUMP_IMPULSE = 60;
const GRAVITY = 100;
class Player {
    constructor(x, y, worldMove) {
        this.posX = x;
        this.posY = y;
        this.worldMove = worldMove;
        this.ground = false;
        this.velX = 0;
        this.velY = 0;
        this.time = 0;
        this.trapped = false;
        this.runInput = 0;
        this.jumpInput = false;
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
    }
    getRect() {
        return new Rect(this.posX, this.posY, PLAYER_WIDTH, PLAYER_HEIGHT);
    }
    onKeyDown(event) {
        if (event.code == KEY_CODE_LEFT && !event.repeat) {
            this.runInput -= 1;
        }
        if (event.code == KEY_CODE_RIGHT && !event.repeat) {
            this.runInput += 1;
        }
        if (event.code == KEY_CODE_JUMP && !event.repeat) {
            this.jumpInput = true;
        }
    }
    onKeyUp(event) {
        if (event.code == KEY_CODE_LEFT) {
            this.runInput += 1;
        }
        if (event.code == KEY_CODE_RIGHT) {
            this.runInput -= 1;
        }
        if (event.code == KEY_CODE_JUMP) {
            this.jumpInput = false;
        }
    }
    update(dt) {
        if (this.trapped) {
            this.updateSprite();
            return;
        }
        this.time += dt;
        this.velX += this.runInput * PLAYER_ACCELERATION_GROUND * dt;
        this.velX -= this.velX * PLAYER_FRICTION_COEFF * dt;
        if (this.ground && this.jumpInput) {
            this.velY -= PLAYER_JUMP_IMPULSE;
            this.ground = false;
        }
        this.velY += GRAVITY * dt;
        const moveResult = this.worldMove(new Rect(this.posX, this.posY, PLAYER_WIDTH, PLAYER_HEIGHT), this.velX * dt, this.velY * dt);
        if (moveResult.hitGround || moveResult.hitCeiling) {
            this.velY = 0;
        }
        if (moveResult.hitWall) {
            this.velX = 0;
        }
        this.posX = moveResult.x;
        this.posY = moveResult.y;
        this.ground = moveResult.hitGround;
        const scale = window.innerWidth / WORLD_WIDTH;
        const windowCenterX = window.innerWidth / 2;
        const windowCenterY = window.innerHeight / 2;
        if (this.sprite) {
            this.sprite.style.left = `${this.posX * scale + windowCenterX}px`;
            this.sprite.style.top = `${this.posY * scale + windowCenterY}px`;
            const scaleT = this.velX > 0 ? 'scaleX(-1)' : 'scaleX(1)';
            const rotateT = (Math.abs(this.velX) > 4 && this.ground) ? `rotate(${Math.sin(this.time * 40) * 10}deg)` : '';
            this.sprite.style.transform = `${scaleT} ${rotateT}`;
        }
    }
    updateSprite() {
        const scale = window.innerWidth / WORLD_WIDTH;
        const windowCenterX = window.innerWidth / 2;
        const windowCenterY = window.innerHeight / 2;
        if (this.sprite) {
            this.sprite.style.width = `${PLAYER_WIDTH * scale}px`;
            this.sprite.style.height = `${PLAYER_HEIGHT * scale}px`;
            this.sprite.style.left = `${this.posX * scale + windowCenterX}px`;
            this.sprite.style.top = `${this.posY * scale + windowCenterY}px`;
        }
    }
    createSprite() {
        this.sprite = document.createElement('div');
        this.sprite.classList.add('player');
        this.updateSprite();
        document.body.insertBefore(this.sprite, null);
    }
    deleteSprite() {
        if (this.sprite) {
            document.body.removeChild(this.sprite);
            this.sprite = undefined;
        }
    }
    onLoad() {
        this.createSprite();
    }
    onWindowResize() {
        this.updateSprite();
    }
}
