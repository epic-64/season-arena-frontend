// === Emoji Mappings ===
const skillEmojis = {
    "Strike": "💫",
    "Double Strike": "💥",
    "Poison Strike": "🐟",
    "Whirlwind": "🌪️",
    "Fireball": "🔥",
    "Explode": "☀️",
    "Spark": "✨",
    "Regeneration": "🍎",
    "Flash Heal": "🍕",
    "Group Heal": "🍜🍎"
};

const statusEmojis = {
    "Poison": "🐟",
    "Burn": "🔥",
    "Regen": "🍎"
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

// === Animations ===
function animateSkillUsed(event) {
    const actorEl = document.getElementById(`actor-${event.actor}`);
    const targetEl = document.getElementById(`actor-${event.targets[0]}`);

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

    // Actor strike animation
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

    const actorData = event.snapshot.actors.find(a => a.name === event.target);
    const hpPercent = (event.targetHp / actorData.maxHp) * 100;

    const healthBar = targetEl.querySelector('.health-bar');
    healthBar.style.width = `${hpPercent}%`;

    // === Enhanced Logging (no derived calculations, only direct event fields) ===
    try {
        const sourceName = event.source || event.actor || 'Unknown';
        const targetName = event.target || 'Unknown';
        const maxHp = actorData?.maxHp;
        const newHp = typeof event.targetHp !== 'undefined' ? event.targetHp : undefined;

        // Attempt to locate a damage field without inferring or computing
        const candidateFields = ['damage', 'amount', 'value', 'delta', 'deltaHp', 'hpChange'];
        let damageVal = undefined;
        for (const f of candidateFields) {
            if (typeof event[f] !== 'undefined') { damageVal = event[f]; break; }
        }

        // Critical hit indicator if any boolean-like field present
        const critFlags = ['crit', 'critical', 'isCrit', 'isCritical'];
        let isCrit = false;
        for (const f of critFlags) {
            if (event[f]) { isCrit = true; break; }
        }

        let messageParts = [];
        if (damageVal !== undefined) {
            messageParts.push(`${sourceName} hits ${targetName} for ${damageVal} dmg`);
        } else {
            messageParts.push(`${sourceName} affects ${targetName}`);
        }
        if (isCrit) messageParts.push('(CRIT!)');
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
    const effectEmoji = createElement('div', {
        text: statusEmojis[event.buffId],
        styles: {
            fontSize: '1.5em',
            position: 'absolute',
            transition: 'opacity 0.5s',
            opacity: 1
        }
    });

    const targetContainer = document.querySelector(`#actor-${event.target} .health-bar-container`);
    const rect = targetContainer.getBoundingClientRect();

    document.body.appendChild(effectEmoji);
    effectEmoji.style.left = `${rect.right + window.scrollX + 10}px`;
    effectEmoji.style.top = `${rect.top + window.scrollY}px`;

    setTimeout(() => {
        effectEmoji.style.opacity = 0;
        effectEmoji.remove();
    }, 1000);

    updateActionLog(`${event.target} affected by ${event.buffId}`);
}

function animateHeal(event) {
    // Update target health bar if data present (no calculations beyond direct field usage)
    try {
        if (!event.target || typeof event.targetHp === 'undefined' || !event.snapshot) {
            // Still attempt to log if minimal fields exist
        } else {
            const targetEl = document.getElementById(`actor-${event.target}`);
            if (targetEl) {
                const actorData = event.snapshot.actors.find(a => a.name === event.target);
                if (actorData && actorData.maxHp) {
                    const hpPercent = (event.targetHp / actorData.maxHp) * 100;
                    const healthBar = targetEl.querySelector('.health-bar');
                    if (healthBar) healthBar.style.width = `${hpPercent}%`;
                }
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

function animateActions(log) {
    let relevantLog = log.filter(event => {
        return [
            "playground.engine_v1.CombatEvent.SkillUsed",
            "playground.engine_v1.CombatEvent.DamageDealt",
            "playground.engine_v1.CombatEvent.ResourceDrained",
            "playground.engine_v1.CombatEvent.Healed",
            // "playground.engine_v1.CombatEvent.BuffApplied",
            // "playground.engine_v1.CombatEvent.BuffExpired",
            // "playground.engine_v1.CombatEvent.TurnStart"
        ].includes(event.type);
    });

    relevantLog.forEach((event, index) => {
        setTimeout(() => {
            const type = event.type;

            updateActionLog(type);

            switch (type) {
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
                case "playground.engine_v1.CombatEvent.BuffExpired":
                case "playground.engine_v1.CombatEvent.TurnStart":
                default: // No action
                    break;
            }

            // Update all status effects
            if (event.snapshot && event.snapshot.actors) {
                event.snapshot.actors.forEach(actor =>
                    updateStatusEffectsDisplay(actor.name, actor.resourceTicks)
                );
            }

        }, index * 400);
    });
}

// === Main Runner ===
async function runAnimation() {
    const logData = await loadLog();
    const initialSnapshot = logData.find(e => e.type === "playground.engine_v1.CombatEvent.TurnStart");

    if (!initialSnapshot?.snapshot) {
        console.error("Initial snapshot not found in log.");
        return;
    }

    initializeActors(initialSnapshot.snapshot);
    animateActions(logData);
}

// Export createElement and updateActionLog for testing
if (typeof module !== 'undefined') {
    module.exports = {
        createElement,
        updateActionLog
    };
}
