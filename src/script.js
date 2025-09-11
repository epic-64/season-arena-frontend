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
    const newMessage = createElement('div', { text: message });
    logContainer.appendChild(newMessage);

    // Keep only last 50 messages
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.firstChild);
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

function animateActions(log) {
    log.forEach((event, index) => {
        setTimeout(() => {
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
            }

            // Update all status effects
            event.snapshot.actors.forEach(actor =>
                updateStatusEffectsDisplay(actor.name, actor.resourceTicks)
            );

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
