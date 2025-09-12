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
    "Group Heal": "👥💞"
};

const statusEmojis = {
    "Poison": "🧪",
    "Burn": "🔥",
    "Regen": "💖",
    "Protection": "🛡️"
};

// === Utility Functions ===
async function loadLog() {
    try {
        const response = await fetch('src/log.json');
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

// === Actor Setup ===
function getPortraitSrc(actorName) {
    // Map actor names to portrait filenames
    const nameToFile = {
        'Cleric': 'cleric.png',
        'Fighter': 'fighter.png',
        'Fishman': 'fishman.png',
        'Mage': 'mage.png',
        'Ratman': 'ratman.png',
        'Scoundrel': 'scoundrel.png'
        // Removed fixed Villain mapping to allow randomization
    };

    const lowerName = actorName.toLowerCase();

    // Special case: any name containing 'villain' randomizes among monster portraits
    if (lowerName.includes('villain')) {
        const villainOptions = ['ratman.png', 'fishman.png', 'scoundrel.png'];
        const file = villainOptions[Math.floor(Math.random() * villainOptions.length)];
        return `assets/images/portraits/${file}`;
    }

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

    snapshot.actors.forEach(actor => {
        const actorDiv = createElement('div', {
            id: `actor-${actor.name}`,
            classes: ['actor']
        });

        // Portrait image
        const portraitImg = createElement('img', {
            classes: ['portrait'],
            styles: {
                // width/height controlled by CSS for responsiveness
                borderRadius: '8px',
                objectFit: 'cover',
                boxShadow: '0 0 8px #6e3a9e'
            }
        });
        portraitImg.src = getPortraitSrc(actor.name);
        portraitImg.alt = actor.name;

        const healthBar = createElement('div', {
            classes: ['health-bar'],
            styles: { width: `${(actor.hp / actor.maxHp) * 100}%` }
        });

        const statusEffects = createElement('div', { classes: ['status-effects'] });

        const healthBarContainer = createElement('div', { classes: ['health-bar-container'] });
        healthBarContainer.append(healthBar, statusEffects);

        actorDiv.appendChild(portraitImg);
        actorDiv.appendChild(healthBarContainer);

        (actor.team === 0 ? heroes : enemies).appendChild(actorDiv);
    });
}

function updateStatusEffectsDisplay(actorName, resourceTicks) {
    const container = document.querySelector(`#actor-${actorName} .status-effects`);
    container.innerHTML = '';

    resourceTicks.forEach(tick => {
        const effectEmoji = createElement('span', {
            text: statusEmojis[tick.id],
            classes: ['status-effect']
        });
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
            if (Array.isArray(actor.resourceTicks)) {
                actor.resourceTicks.forEach(tick => {
                    const effectEmoji = createElement('span', {
                        text: statusEmojis[tick.id],
                        classes: ['status-effect']
                    });
                    statusEffects.appendChild(effectEmoji);
                });
            }
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

    updateActionLog(`${event.actor} uses ${event.skill} on ${event.targets.join(', ')}`);
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

    // Show damage effect emoji above target
    const damageEmoji = createElement('div', {
        text: '💥',
        styles: {
            fontSize: '2em',
            position: 'absolute',
            left: `${targetEl.getBoundingClientRect().left + window.scrollX + 20}px`,
            top: `${targetEl.getBoundingClientRect().top + window.scrollY - 30}px`,
            transition: 'opacity 0.7s, transform 0.7s',
            opacity: 1,
            pointerEvents: 'none'
        }
    });
    document.body.appendChild(damageEmoji);
    setTimeout(() => {
        damageEmoji.style.transform = 'translateY(-30px)';
        damageEmoji.style.opacity = 0;
    }, 100);
    setTimeout(() => {
        damageEmoji.remove();
    }, 800);

    // === Enhanced Logging (no derived calculations, only direct event fields) ===
    try {
        const actorData = event.snapshot.actors.find(a => a.name === event.target);
        const sourceName = event.source || event.actor || 'Unknown';
        const targetName = event.target || 'Unknown';
        const maxHp = actorData?.maxHp;
        const newHp = typeof event.targetHp !== 'undefined' ? event.targetHp : undefined;

        // Attempt to locate a damage field without inferring or computing
        let damageVal = event['amount'];

        let messageParts = [];
        if (damageVal !== undefined) {
            messageParts.push(`${sourceName} hits ${targetName} for ${damageVal} dmg`);
        } else {
            messageParts.push(`${sourceName} affects ${targetName}`);
        }
        if (newHp !== undefined && maxHp !== undefined) {
            messageParts.push(`HP: ${newHp}/${maxHp}`);
        }
        updateActionLog(messageParts.join(' '));
    } catch (e) {
        // Fail silently to avoid breaking animation if unexpected shape
        console.debug('Damage log enhancement skipped:', e);
    }
}

function animateResourceDrained(event) {
    const targetEl = document.getElementById(`actor-${event.target}`);
    if (!targetEl) return;

    // Show effect emoji above target for resource drain, heal, or DoT
    let effectEmojiText = statusEmojis[event.buffId] || '✨';
    const effectEmoji = createElement('div', {
        text: effectEmojiText,
        styles: {
            fontSize: '2em',
            position: 'absolute',
            left: `${targetEl.getBoundingClientRect().left + window.scrollX + 20}px`,
            top: `${targetEl.getBoundingClientRect().top + window.scrollY - 30}px`,
            transition: 'opacity 0.7s, transform 0.7s',
            opacity: 1,
            pointerEvents: 'none'
        }
    });
    document.body.appendChild(effectEmoji);

    // Animate upward and fade out
    setTimeout(() => {
        effectEmoji.style.transform = 'translateY(-30px)';
        effectEmoji.style.opacity = 0;
    }, 100);

    setTimeout(() => {
        effectEmoji.remove();
    }, 800);

    updateActionLog(`${event.target} affected by ${event.buffId}`);
}

function animateHeal(event) {
    // Removed obsolete health bar update logic
    try {
        if (!event.target || typeof event.targetHp === 'undefined' || !event.snapshot) {
            // Still attempt to log if minimal fields exist
        } else {
            const targetEl = document.getElementById(`actor-${event.target}`);
            if (targetEl) {
                // Only show heal effect emoji above target
                const healEmoji = createElement('div', {
                    text: '🍎',
                    styles: {
                        fontSize: '2em',
                        position: 'absolute',
                        left: `${targetEl.getBoundingClientRect().left + window.scrollX + 20}px`,
                        top: `${targetEl.getBoundingClientRect().top + window.scrollY - 30}px`,
                        transition: 'opacity 0.7s, transform 0.7s',
                        opacity: 1,
                        pointerEvents: 'none'
                    }
                });
                document.body.appendChild(healEmoji);
                setTimeout(() => {
                    healEmoji.style.transform = 'translateY(-30px)';
                    healEmoji.style.opacity = 0;
                }, 100);
                setTimeout(() => {
                    healEmoji.remove();
                }, 800);
            }
        }

        const healer = event.source || event.actor || 'Unknown';
        const target = event.target || (Array.isArray(event.targets) ? event.targets.join(', ') : 'Unknown');
        let healAmount;
        for (const f of ['heal','healed','amount','value','delta','deltaHp','hpChange']) {
            if (Object.prototype.hasOwnProperty.call(event, f)) { healAmount = event[f]; break; }
        }
        let maxHp;
        if (event.snapshot && event.target) {
            const actorData = event.snapshot.actors.find(a => a.name === event.target);
            maxHp = actorData?.maxHp;
        }
        const newHp = typeof event.targetHp !== 'undefined' ? event.targetHp : undefined;
        const parts = [];
        if (healAmount !== undefined) {
            parts.push(`${healer} heals ${target} for ${healAmount}`);
        } else {
            parts.push(`${healer} heals ${target}`);
        }
        if (newHp !== undefined && maxHp !== undefined) {
            parts.push(`HP: ${newHp}/${maxHp}`);
        }
        updateActionLog(parts.join(' '));
    } catch (e) {
        console.debug('Heal log skipped:', e);
    }
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
        this.events = log.filter(e =>
            [
                "playground.engine_v1.CombatEvent.SkillUsed",
                "playground.engine_v1.CombatEvent.DamageDealt",
                "playground.engine_v1.CombatEvent.ResourceDrained",
                "playground.engine_v1.CombatEvent.Healed"
            ].includes(e.type)
        );
    },

    play() {
        if (this.playing) return;
        this.playing = true;
        this.scheduleNext();
    },

    pause() {
        this.playing = false;
        if (this.timer) clearTimeout(this.timer);
    },

    scheduleNext() {
        if (!this.playing) return;
        if (this.index >= this.events.length - 1) {
            this.pause();
            return;
        }
        this.stepForward(true);
        this.timer = setTimeout(() => this.scheduleNext(), this.baseInterval / this.speed);
    },

    stepForward(withAnimation = true) {
        if (this.index >= this.events.length - 1) return;
        this.index++;
        const evt = this.events[this.index];
        executeEvent(evt, withAnimation);
        if (evt.snapshot) updateAllActorDisplays(evt.snapshot);
    },

    stepBack() {
        if (this.index < 0) return;
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
            logEventSummary(evt);
        }
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

// === Event Execution ===
function logEventSummary(event) {
    // Minimal summary used when rebuilding
    switch (event.type) {
        case "playground.engine_v1.CombatEvent.SkillUsed":
            updateActionLog(`[Skill] ${event.actor} -> ${event.targets?.join(', ')}`);
            break;
        case "playground.engine_v1.CombatEvent.DamageDealt":
            updateActionLog(`[Damage] ${event.actor || event.source} -> ${event.target}`);
            break;
        case "playground.engine_v1.CombatEvent.ResourceDrained":
            updateActionLog(`[Effect] ${event.target} ${event.buffId}`);
            break;
        case "playground.engine_v1.CombatEvent.Healed":
            updateActionLog(`[Heal] ${event.source || event.actor} -> ${event.target || event.targets?.join(', ')}`);
            break;
        default:
            updateActionLog(event.type);
    }
}

function executeEvent(event, animate = true) {
    logEventSummary(event);
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
        default:
            break;
    }
}

// === Main Runner ===
async function runAnimation() {
    const logData = await loadLog();
    const initialSnapshotEvent = logData.find(e => e.type === "playground.engine_v1.CombatEvent.TurnStart");
    if (!initialSnapshotEvent?.snapshot) {
        console.error("Initial snapshot not found in log.");
        return;
    }
    playback.initialSnapshot = initialSnapshotEvent.snapshot;
    initializeActors(playback.initialSnapshot);
    playback.init(logData);
    wireControls();
}

function wireControls() {
    const btnPlay = document.getElementById('btn-play');
    const btnPause = document.getElementById('btn-pause');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const speedSel = document.getElementById('play-speed');

    btnPlay.onclick = () => playback.play();
    btnPause.onclick = () => playback.pause();
    btnPrev.onclick = () => playback.stepBack();
    btnNext.onclick = () => playback.stepForward(true);
    speedSel.onchange = e => playback.setSpeed(parseFloat(e.target.value));
}

// Export for testing
if (typeof module !== 'undefined') {
    module.exports = {
        createElement,
        updateActionLog
    };
}
