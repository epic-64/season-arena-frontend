import {
    animateBuffApplied,
    animateDamageDealt,
    animateHeal,
    animateResourceDrained,
    animateSkillUsed
} from './animations.js';

import {statusEmojis} from './emojiMappings.js';
import {ActorClass} from './types.js';
import {createElement} from './utils.js';
import {logEventUnified} from './eventLog.js';

// === Utility Functions ===
async function loadLog() {
    try {
        const response = await fetch('src/log2.json');
        return await response.json();
    } catch (error) {
        console.error('Error loading log:', error);
    }
}

function updateActionLog(message) {
    const logContainer = document.getElementById('action-log');

    // Determine if user is currently at (or very near) the bottom BEFORE appending
    // Using a small threshold to account for fractional pixels / rounding.
    const threshold = 8;
    const distanceFromBottom = logContainer.scrollHeight - logContainer.scrollTop - logContainer.clientHeight;
    const wasAtBottom = distanceFromBottom <= threshold;

    const newMessage = createElement('div', { text: message });
    logContainer.appendChild(newMessage);

    // Keep only last 50 messages
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.firstChild);
    }

    // Auto-scroll only if the user had not scrolled up
    if (wasAtBottom) {
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}

// === Actor Setup ===
function getPortraitSrc(actorClass) {
    // Map ActorClass values to portrait filenames
    const classToFile = {
        [ActorClass.Mage]: 'mage.png',
        [ActorClass.Cleric]: 'druid.png',
        [ActorClass.Hunter]: 'hunter2.png',
        [ActorClass.Paladin]: 'paladin.png',
        [ActorClass.Bard]: 'bard.png',
        [ActorClass.Fishman]: 'fishman.png',
        [ActorClass.AbyssalDragon]: 'abyss_dragon.png',
    };

    const lowerName = actorClass.toLowerCase();

    // Generic containment lookup
    let file = 'cleric.png'; // default
    for (const key in classToFile) {
        if (lowerName.includes(key.toLowerCase())) {
            file = classToFile[key];
            break;
        }
    }
    return `assets/images/portraits/${file}`;
}

function initializeActors(snapshot) {
    const heroes = document.getElementById('heroes');
    const enemies = document.getElementById('enemies');
    // Clear previous actors to avoid duplicate portraits when rebuilding state
    heroes.innerHTML = '';
    enemies.innerHTML = '';
    snapshot.actors.forEach(actor => {
        const actorDiv = createElement('div', {
            id: `actor-${actor.name}`,
            classes: ['actor']
        });

        // Portrait image
        const portraitImg = createElement('img', {
            classes: ['portrait'],
        });
        portraitImg.src = getPortraitSrc(actor.actorClass);
        portraitImg.alt = actor.actorClass;

        // Name plate (new)
        const namePlate = createElement('div', {
            text: actor.name,
            classes: ['actor-name']
        });

        const healthBar = createElement('div', {
            classes: ['health-bar'],
            styles: { width: `${(actor.hp / actor.maxHp) * 100}%` }
        });
        const statusEffects = createElement('div', { classes: ['status-effects'] });
        const healthBarContainer = createElement('div', { classes: ['health-bar-container'] });
        healthBarContainer.append(healthBar); // keep only bar inside to avoid hiding effects
        actorDiv.appendChild(namePlate);
        actorDiv.appendChild(portraitImg);
        actorDiv.appendChild(healthBarContainer);
        actorDiv.appendChild(statusEffects); // below bar, visible (container has overflow hidden)

        (actor.team === 0 ? heroes : enemies).appendChild(actorDiv);
    });
}

function renderStatusEffects(container, effects, getTitle) {
    if (!Array.isArray(effects)) return;
    effects.forEach(effect => {
        const symbol = statusEmojis[effect.id] || '✨';
        const effectEmoji = createElement('span', {
            classes: ['status-effect']
        });
        effectEmoji.textContent = symbol;

        // value indicator (top left)
        const value = 0; // todo: parse actual value from statusEffect
        if (value) {
            const valueSpan = createElement('span', {
                classes: ['effect-value']
            });
            valueSpan.textContent = value;
            effectEmoji.appendChild(valueSpan);
        }

        // Duration indicator (bottom right)
        if (effect.duration) {
            const durationSpan = createElement('span', {
                classes: ['effect-duration']
            });
            durationSpan.textContent = effect.duration;
            effectEmoji.appendChild(durationSpan);
        }

        try {
            if (getTitle) {
                effectEmoji.title = getTitle(effect);
            }
        } catch (e) {
            console.error('Error generating effect title:', e);
        }
        container.appendChild(effectEmoji);
    });
}

function updateAllActorDisplays(snapshot) {
    if (!snapshot || !snapshot.actors) return;
    snapshot.actors.forEach(actor => {
        const actorDiv = document.getElementById(`actor-${actor.name}`);
        if (!actorDiv) return;
        // Update health bar
        const healthBar = actorDiv.querySelector('.health-bar');
        if (healthBar && typeof actor.hp === 'number' && typeof actor.maxHp === 'number') {
            healthBar.style.width = `${(actor.hp / actor.maxHp) * 100}%`;
        }
        // Update status effects
        const statusEffects = actorDiv.querySelector('.status-effects');
        if (statusEffects) {
            statusEffects.innerHTML = '';
            renderStatusEffects(statusEffects, actor.statBuffs, buff => buff.statChanges ? `+${JSON.stringify(buff.statChanges)} (${buff.duration || 0}t)` : undefined);
            renderStatusEffects(statusEffects, actor.resourceTicks, tick => tick.resourceChanges ? `${JSON.stringify(tick.resourceChanges)} (${tick.duration || 0}t)` : undefined);
        }
        // You can add more updates here (e.g., cooldowns, buffs, etc.)
    });
}

// === Animations ===
// (moved to animations.js)

// === Playback Controller ===
const playback = {
    rawLog: [],
    events: [],
    index: -1,          // last executed index
    playing: false,
    timer: null,
    baseInterval: 400,
    speed: 1,
    initialSnapshot: null,

    init(log) {
        this.rawLog = log;
        // this.events = log.filter(e =>
        //     [
        //         "playground.engine_v1.CombatEvent.SkillUsed",
        //         "playground.engine_v1.CombatEvent.DamageDealt",
        //         "playground.engine_v1.CombatEvent.ResourceDrained",
        //         "playground.engine_v1.CombatEvent.Healed"
        //     ].includes(e.type)
        // );
        this.events = log; // Use full log for context
    },

    play() {
        if (this.playing) return;
        this.playing = true;
        updatePlayToggleButton();
        this.scheduleNext();
    },

    pause() {
        this.playing = false;
        if (this.timer) clearTimeout(this.timer);
        updatePlayToggleButton();
    },

    toggle() {
        if (this.playing) {
            this.pause();
        } else {
            // If at end, reset to allow replay
            if (this.index >= this.events.length - 1) {
                this.reset();
            }
            this.play();
        }
    },

    reset() {
        this.pause();
        this.index = -1;
        this.rebuildState();
    },

    scheduleNext() {
        if (!this.playing) return;
        if (this.index >= this.events.length - 1) {
            this.pause();
            return; // updatePlayToggleButton already called in pause
        }
        this.stepForward();
        this.timer = setTimeout(() => this.scheduleNext(), this.baseInterval / this.speed);
    },

    stepForward() {
        if (this.index >= this.events.length - 1) return;
        this.index++;
        const evt = this.events[this.index];
        logEventUnified(evt);
        executeEvent(evt);
        if (evt.snapshot) {
            updateAllActorDisplays(evt.snapshot);
        }
        if (this.index >= this.events.length - 1) {
            // If playing and reached end, force pause to update button state
            if (this.playing) this.pause();
        }
    },

    stepBack() {
        if (this.index < 0) return;
        // Stepping back while auto-playing should pause
        if (this.playing) this.pause();
        this.index--;
        this.rebuildState();
    },

    rebuildState() {
        // Clear logs
        const logContainer = document.getElementById('action-log');
        logContainer.innerHTML = '';

        // Determine snapshot to use
        const snap = this.findSnapshotForIndex(this.index);
        if (snap) {
            initializeActors(snap);
            updateAllActorDisplays(snap);
        } else if (this.initialSnapshot) {
            initializeActors(this.initialSnapshot);
        }

        // Replay (log only, no animations) prior events for log context
        for (let i = 0; i <= this.index; i++) {
            const evt = this.events[i];
            logEventUnified(evt)
        }
        updatePlayToggleButton();
    },

    findSnapshotForIndex(i) {
        if (i < 0) return this.initialSnapshot;
        for (let k = i; k >= 0; k--) {
            if (this.events[k].snapshot) return this.events[k].snapshot;
        }
        return this.initialSnapshot;
    },

    setSpeed(mult) {
        this.speed = mult;
        if (this.playing) {
            this.pause();
            this.play();
        }
    }
};

// Helper: update play/pause toggle button label/state
function updatePlayToggleButton() {
    const btn = document.getElementById('btn-toggle-play');
    if (!btn) return;
    btn.classList.remove('is-playing', 'is-ended');
    if (playback.playing) {
        btn.textContent = 'Pause';
        btn.classList.add('is-playing');
    } else if (playback.index >= playback.events.length - 1 && playback.events.length > 0) {
        btn.textContent = 'Replay';
        btn.classList.add('is-ended');
    } else {
        btn.textContent = 'Play';
    }
}

function executeEvent(event) {
    switch (event.type) {
        case "playground.engine_v1.CombatEvent.SkillUsed":
            animateSkillUsed(event);
            break;
        case "playground.engine_v1.CombatEvent.DamageDealt":
            animateDamageDealt(event);
            break;
        case "playground.engine_v1.CombatEvent.ResourceDrained":
            animateResourceDrained(event);
            break;
        case "playground.engine_v1.CombatEvent.Healed":
            animateHeal(event);
            break;
        case "playground.engine_v1.CombatEvent.BuffApplied":
            animateBuffApplied(event);
            break;
        default:
            break;
    }
}

// === Main Runner ===
async function runBattleApplication() {
    const logData = await loadLog();
    const initialSnapshotEvent = logData.find(e => e.type === "playground.engine_v1.CombatEvent.TurnStart");
    if (!initialSnapshotEvent?.snapshot) {
        console.error("Initial snapshot not found in log.");
        return;
    }
    playback.initialSnapshot = initialSnapshotEvent.snapshot;
    initializeActors(playback.initialSnapshot);
    // Ensure status effects (statBuffs, resourceTicks) render immediately
    updateAllActorDisplays(playback.initialSnapshot);
    playback.init(logData);
    wireControls();
    // Auto-play by default
    playback.play();
}

function wireControls() {
    const btnToggle = document.getElementById('btn-toggle-play');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const speedSel = document.getElementById('play-speed');

    btnToggle.onclick = () => playback.toggle();
    btnPrev.onclick = () => playback.stepBack();
    btnNext.onclick = () => playback.stepForward();
    speedSel.onchange = e => playback.setSpeed(parseFloat(e.target.value));

    updatePlayToggleButton();
}

export { runBattleApplication, createElement, updateActionLog };
