// === Emoji Mappings ===
const skillEmojis = {
    "Strike": "🗡️",
    "Double Strike": "⚔️",
    "Poison Strike": "🗡️🧪",
    "Whirlwind": "🌪️",
    "Fireball": "☄️🔥",
    "Explode": "☀️",
    "Spark": "✨",
    "Regeneration": "💞",
    "Flash Heal": "💊",
    "Group Heal": "💞",
    "Ice Shot": "❄️🏹",
    "Black Hole": "💫",
};

const statusEmojis = {
    "Poison": "🧪",
    "Burn": "🔥",
    "Burning": "🔥",
    "Shock": "🌩️",
    "Shocked": "🌩️",
    "Bleeding": "🩸",
    "Stunned": "💫",
    "Chill": "🧊",
    "Chilled": "🧊",
    "Frozen": "❄️",
    "Regen": "💖",
    "Protection": "🛡️",
    "Boost": "⏫",
    "Weaken": "⏬",
    "Slow": "🐢",
    "Amplify": "🔺",
    "Aimed": "🔺",
};

// === Utility Functions ===
async function loadLog() {
    try {
        const response = await fetch('src/log2.json');
        return await response.json();
    } catch (error) {
        console.error('Error loading log:', error);
    }
}

function createElement(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.text) el.textContent = options.text;
    if (options.classes) el.classList.add(...options.classes);
    if (options.id) el.id = options.id;
    if (options.styles) Object.assign(el.style, options.styles);
    return el;
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

// === Unified Event Log Formatting ===
function formatEventLog(event) {
    try {
        const type = event.type;
        const snap = event.snapshot;
        const findActorData = (name) => snap?.actors?.find(a => a.name === name);
        const getMaxHp = (name) => findActorData(name)?.maxHp;
        const getAmount = (fields, obj) => {
            for (const f of fields) {
                if (Object.prototype.hasOwnProperty.call(obj, f) && typeof obj[f] === 'number') return obj[f];
            }
            return undefined;
        };
        switch (type) {
            case "playground.engine_v1.CombatEvent.TurnStart": {
                return `--- Turn ${event.turn} ---`;
            }
            case "playground.engine_v1.CombatEvent.SkillUsed": {
                const actor = event.actor || 'Unknown';
                const skill = event.skill || 'Skill';
                const targets = Array.isArray(event.targets) ? event.targets.join(', ') : (event.targets || 'Unknown');
                return `${actor} uses ${skill} on ${targets}`;
            }
            case "playground.engine_v1.CombatEvent.BuffApplied": {
                // source, target, buffId
                const source = event.source;
                const target = event.target;
                const buff = event.buffId;
                return `${source} applies ${buff} to ${target}`;
            }
            case "playground.engine_v1.CombatEvent.DamageDealt": {
                const source = event.actor || event.source || 'Unknown';
                const target = event.target || 'Unknown';
                let amount = getAmount(['amount','damage','value','delta','deltaHp','hpChange'], event);
                if (typeof amount === 'number') amount = Math.abs(amount);
                const newHp = typeof event.targetHp === 'number' ? event.targetHp : undefined;
                const maxHp = getMaxHp(target);
                let msg = `${source} hits ${target}`;
                if (typeof amount === 'number') msg += ` for ${amount} dmg`;
                if (typeof newHp === 'number' && typeof maxHp === 'number') msg += ` (HP ${newHp}/${maxHp})`;
                return msg;
            }
            case "playground.engine_v1.CombatEvent.Healed": {
                const source = event.source || event.actor || 'Unknown';
                const target = event.target || (Array.isArray(event.targets) ? event.targets.join(', ') : 'Unknown');
                let amount = getAmount(['heal','healed','amount','value','delta','deltaHp','hpChange'], event);
                if (typeof amount === 'number') amount = Math.abs(amount);
                const newHp = typeof event.targetHp === 'number' ? event.targetHp : undefined;
                const maxHp = getMaxHp(target);
                let msg = `${source} heals ${target}`;
                if (typeof amount === 'number') msg += ` for ${amount}`;
                if (typeof newHp === 'number' && typeof maxHp === 'number') msg += ` (HP ${newHp}/${maxHp})`;
                return msg;
            }
            case "playground.engine_v1.CombatEvent.ResourceDrained": {
                const target = event.target || 'Unknown';
                const buff = event.buffId || 'Effect';
                let amount = getAmount(['amount','value','delta','deltaHp','hpChange'], event);
                if (amount === undefined && event.resourceChanges && typeof event.resourceChanges === 'object') {
                    if (typeof event.resourceChanges.hp === 'number') amount = event.resourceChanges.hp;
                }
                const newHp = typeof event.targetHp === 'number' ? event.targetHp : undefined;
                const maxHp = getMaxHp(target);
                let msg;
                if (typeof amount === 'number') {
                    if (amount < 0) {
                        msg = `${target} takes ${Math.abs(amount)} from ${buff}`;
                    } else if (amount > 0) {
                        msg = `${target} gains ${amount} from ${buff}`;
                    } else {
                        msg = `${target} affected by ${buff}`;
                    }
                } else {
                    msg = `${target} affected by ${buff}`;
                }
                if (typeof newHp === 'number' && typeof maxHp === 'number') msg += ` (HP ${newHp}/${maxHp})`;
                return msg;
            }
            default:
                return type;
        }
    } catch (e) {
        return event.type || 'Event';
    }
}

function logEventUnified(event) {
    let logMessage = formatEventLog(event);
    updateActionLog(logMessage);
}

// === Actor Setup ===
function getPortraitSrc(actorClass) {
    // Map actor names to portrait filenames
    const nameToFile = {
        'Mage': 'mage.png',
        'Cleric': 'druid.png',
        'Hunter': 'hunter2.png',
        'Paladin': 'paladin.png',
        'Bard': 'bard.png',
        'Ratman': 'ratman.png',
        'Fishman': 'fishman.png',
        'Scoundrel': 'scoundrel.png',
        'AbyssalDragon': 'abyss_dragon.png',
    };

    const lowerName = actorClass.toLowerCase();

    // Generic containment lookup
    let file = 'cleric.png'; // default
    for (const key in nameToFile) {
        if (lowerName.includes(key.toLowerCase())) {
            file = nameToFile[key];
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
function animateSkillUsed(event) {
    const actorEl = document.getElementById(`actor-${event.actor}`);
    if (!actorEl || !Array.isArray(event.targets) || event.targets.length === 0) return;

    // Animate skill emoji for each target
    event.targets.forEach(targetName => {
        const targetEl = document.getElementById(`actor-${targetName}`);
        if (!targetEl) return;

        const skillEmoji = createElement('div', {
            text: skillEmojis[event.skill],
            styles: {
                position: 'absolute',
                fontSize: '2em',
                transition: 'transform 0.5s, opacity 0.5s',
                opacity: 1
            }
        });

        const actorRect = actorEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        document.body.appendChild(skillEmoji);
        skillEmoji.style.left = `${actorRect.left + window.scrollX}px`;
        skillEmoji.style.top = `${actorRect.top + window.scrollY}px`;

        // Fly to target
        requestAnimationFrame(() => {
            skillEmoji.style.transform = `translate(${targetRect.left - actorRect.left}px, ${targetRect.top - actorRect.top}px)`;
        });

        // Fade + remove
        setTimeout(() => {
            skillEmoji.style.opacity = 0;
            skillEmoji.remove();
        }, 1000);
    });

    // Actor strike animation (only once)
    actorEl.classList.add('strike');
    setTimeout(() => actorEl.classList.remove('strike'), 500);
}

function animateDamageDealt(event) {
    const targetEl = document.getElementById(`actor-${event.target}`);

    // Restart animation if already active
    if (targetEl.classList.contains('flicker')) {
        targetEl.classList.remove('flicker');
        // Force reflow to allow animation restart
        void targetEl.offsetWidth;
    }
    targetEl.classList.add('flicker');
    setTimeout(() => targetEl.classList.remove('flicker'), 450);

    try {
        let damageVal = event['amount'];
        if (typeof damageVal !== 'number') {
            for (const f of ['damage','value','delta','deltaHp','hpChange']) {
                if (Object.prototype.hasOwnProperty.call(event, f) && typeof event[f] === 'number') { damageVal = event[f]; break; }
            }
        }
        if (typeof damageVal === 'number') {
            const shown = Math.abs(damageVal);
            showFloatingNumber(targetEl, shown, 'damage');
        }
    } catch (e) {
        console.debug('Damage log enhancement skipped:', e);
    }
}

function animateResourceDrained(event) {
    const targetEl = document.getElementById(`actor-${event.target}`);
    if (!targetEl) return;

    // Attempt to show numeric change if present
    try {
        let val;
        for (const f of ['amount','value','delta','deltaHp','hpChange']) {
            if (Object.prototype.hasOwnProperty.call(event, f) && typeof event[f] === 'number') { val = event[f]; break; }
        }
        // Some events might nest resource changes
        if (val === undefined && event.resourceChanges && typeof event.resourceChanges === 'object') {
            if (typeof event.resourceChanges.hp === 'number') val = event.resourceChanges.hp;
        }
        if (typeof val === 'number') {
            if (val < 0) {
                showFloatingNumber(targetEl, Math.abs(val), 'damage');
            } else if (val > 0) {
                showFloatingNumber(targetEl, val, 'heal');
            }
        }
    } catch (e) {
        console.debug('Resource change number failed:', e);
    }
}

function animateHeal(event) {
    try {
        let healAmount;
        for (const f of ['heal','healed','amount','value','delta','deltaHp','hpChange']) {
            if (Object.prototype.hasOwnProperty.call(event, f) && typeof event[f] === 'number') { healAmount = event[f]; break; }
        }
        if (typeof healAmount === 'number' && healAmount !== 0) {
            const targetEl2 = document.getElementById(`actor-${event.target}`);
            if (targetEl2) showFloatingNumber(targetEl2, Math.abs(healAmount), 'heal');
        }
    } catch (e) {
        console.debug('Heal log skipped:', e);
    }
}

function animateBuffApplied(event) {
    if (!event || !event.target || !event.buffId) return;
    const actorDiv = document.getElementById(`actor-${event.target}`);
    if (!actorDiv) return;
    const statusEffects = actorDiv.querySelector('.status-effects');
    if (!statusEffects) return;
    // Find all buff emoji elements matching the buff id
    const buffEmojis = Array.from(statusEffects.querySelectorAll('.status-effect'));
    let found = false;
    buffEmojis.forEach(el => {
        // Match by emoji symbol (since that's how they're rendered)
        if (el.textContent && el.textContent.includes(statusEmojis[event.buffId] || event.buffId)) {
            el.classList.add('buff-animate');
            found = true;
            console.log('Buff animation triggered for:', event.buffId, 'on', el);
            setTimeout(() => el.classList.remove('buff-animate'), 700);
        }
    });
    if (!found) {
        console.log('Buff emoji not found for:', event.buffId, 'in', statusEffects);
    }
}

// Helper to show floating numbers for damage / heal
function showFloatingNumber(actorEl, value, kind) {
    if (!actorEl) return;
    const num = createElement('div', {
        text: value,
        classes: ['floating-number', kind === 'damage' ? 'damage-number' : 'heal-number']
    });
    actorEl.appendChild(num);
    // remove after animation ends
    setTimeout(function() { if (num && num.parentNode) num.remove(); }, 1000);
}

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
        this.stepForward(true);
        this.timer = setTimeout(() => this.scheduleNext(), this.baseInterval / this.speed);
    },

    stepForward(withAnimation = true) {
        if (this.index >= this.events.length - 1) return;
        this.index++;
        const evt = this.events[this.index];
        logEventUnified(evt);
        executeEvent(evt, withAnimation);
        if (evt.snapshot) updateAllActorDisplays(evt.snapshot);
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

function executeEvent(event, animate = true) {
    if (!animate) return;
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
    btnNext.onclick = () => playback.stepForward(true);
    speedSel.onchange = e => playback.setSpeed(parseFloat(e.target.value));

    updatePlayToggleButton();
}

// Export for testing
if (typeof module !== 'undefined') {
    module.exports = {
        createElement,
        updateActionLog
    };
}

