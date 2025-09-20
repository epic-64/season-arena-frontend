import {
    animateBuffApplied,
    animateDamageDealt,
    animateHeal,
    animateResourceDrained,
    animateSkillUsed
} from './animations.js';

import {statusEmojis} from './emojiMappings.js';
import {ActorClass, CombatEventType} from './types.js';
import {createElement} from './utils.js';
import {createPlayback} from './playback.js';

async function loadLog() {
    try {
        const response = await fetch('examples/battle.json');
        return await response.json();
    } catch (error) {
        console.error('Error loading log:', error);
    }
}

// === Actor Setup ===
function getPortraitSrc(actorClass)
{
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
    const file = classToFile[actorClass] || `${lowerName}.png`; // default to lowercase name

    return `assets/images/portraits/${file}`;
}

function initializeActors(snapshot)
{
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

/**
 * @param {HTMLElement} container
 * @param {StatBuffSnapshot[]|ResourceTickSnapshot[]} effects
 * @param {(effect: StatBuffSnapshot|ResourceTickSnapshot) => string | undefined } getTitle
 */
function renderStatusEffects(container, effects, getTitle) {
    effects.forEach(effect => renderStatusEffect(container, effect, getTitle));
}

/**
 * @param {HTMLElement} container
 * @param {StatBuffSnapshot|ResourceTickSnapshot} effect
 * @param {(effect: StatBuffSnapshot|ResourceTickSnapshot) => string | undefined } getTitle
 */
function renderStatusEffect(container, effect, getTitle) {
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
}

/**
 * @param {BattleSnapshot} snapshot
 * @return {void}
 */
function updateAllActorDisplays(snapshot) {
    snapshot.actors.forEach(updateActorDisplay);
}

/**
 * @param {ActorSnapshot} actor
 * @return {void}
 */
function updateActorDisplay(actor)
{
    const actorDiv = document.getElementById(`actor-${actor.name}`);
    if (!actorDiv) {
        console.error(`Actor display update: element not found (actor-${actor.name})`);
        return;
    }

    // Update health bar
    const healthBar = actorDiv.querySelector('.health-bar');
    if (!healthBar) {
        console.error('Health bar element not found');
        return;
    }

    const percent = actor.maxHp > 0 ? (actor.hp / actor.maxHp) : 0;
    healthBar.style.width = `${percent * 100}%`;

    // Remove previous color classes
    healthBar.classList.remove('health-bar-yellow', 'health-bar-red');
    if (percent < 0.33) {
        healthBar.classList.add('health-bar-red');
    } else if (percent < 0.66) {
        healthBar.classList.add('health-bar-yellow');
    }
    // else: default green/blue

    // Update status effects
    const statusEffects = actorDiv.querySelector('.status-effects');
    if (!statusEffects) {
        console.error('Status effects container not found');
        return;
    }

    statusEffects.innerHTML = '';
    renderStatusEffects(statusEffects, actor.statBuffs, buff => buff.statChanges ? `+${JSON.stringify(buff.statChanges)} (${buff.duration || 0}t)` : undefined);
    renderStatusEffects(statusEffects, actor.resourceTicks, tick => tick.resourceChanges ? `${JSON.stringify(tick.resourceChanges)} (${tick.duration || 0}t)` : undefined);
    renderStatusEffects(statusEffects, actor.statOverrides, override => override.stats ? `=${JSON.stringify(override.stats)}` : undefined);
}

const playback = createPlayback();

// Helper: update play/pause toggle button label/state
function updatePlayToggleButton()
{
    const btn = document.getElementById('btn-toggle-play');
    if (!btn) {
        return;
    }

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

/**
 * @param {Object} event
 */
function animateEvent(event) {
    switch (event.type) {
        case CombatEventType.TurnStart:
            // No special animation for turn start
            break;
        case CombatEventType.SkillUsed:
            animateSkillUsed(event);
            break;
        case CombatEventType.DamageDealt:
            animateDamageDealt(event);
            break;
        case CombatEventType.ResourceDrained:
            animateResourceDrained(event);
            break;
        case CombatEventType.Healed:
            animateHeal(event);
            break;
        case CombatEventType.BuffApplied:
            animateBuffApplied(event);
            break;
        default:
            console.error('Unhandled event type', event);
            break;
    }
}

// === Main Runner ===
async function runBattleApplication() {
    const logData = await loadLog();

    const initialSnapshotEvent = logData.find(e => e.type === CombatEventType.TurnStart);
    if (!initialSnapshotEvent?.snapshot) {
        console.error("Initial snapshot not found in log.");
        return;
    }
    playback.initialSnapshot = initialSnapshotEvent.snapshot;
    playback.currentSnapshot = JSON.parse(JSON.stringify(playback.initialSnapshot));
    initializeActors(playback.initialSnapshot);
    updateAllActorDisplays(playback.initialSnapshot);
    playback.init(logData);
    wireControls();
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

export { runBattleApplication, updateAllActorDisplays, updatePlayToggleButton, animateEvent, initializeActors };
