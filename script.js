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

// Function to load JSON log
async function loadLog() {
    try {
        const response = await fetch('log.json'); // Ensure this path is correct
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error loading log:', error);
    }
}

// Function to initialize actors on the battlefield
function initializeActors(snapshot) {
    const heroesContainer = document.getElementById('heroes');
    const enemiesContainer = document.getElementById('enemies');

    snapshot.actors.forEach(actor => {
        const actorDiv = document.createElement('div');

        // Actor emoji
        if (actor.name === 'EpicHero') actorDiv.textContent = '😇';
        else if (actor.name === 'EpicVillain') actorDiv.textContent = '😈';
        else actorDiv.textContent = '🙂';

        actorDiv.id = `actor-${actor.name}`; // Unique ID for each actor
        actorDiv.classList.add('actor');

        // Health bar container
        const healthBarContainer = document.createElement('div');
        healthBarContainer.classList.add('health-bar-container');

        // Health bar
        const healthBar = document.createElement('div');
        healthBar.classList.add('health-bar');

        // Set initial width based on current hp/maxHp
        healthBar.style.width = `${(actor.hp / actor.maxHp) * 100}%`;

        // Status effects container
        const statusEffectsContainer = document.createElement('div');
        statusEffectsContainer.classList.add('status-effects');

        // Append health bar and status effects container to the health bar container
        healthBarContainer.appendChild(healthBar);
        healthBarContainer.appendChild(statusEffectsContainer);

        // Append elements to the actor div
        actorDiv.appendChild(healthBarContainer);

        // Add actors to their respective teams
        if (actor.team === 0) heroesContainer.appendChild(actorDiv);
        else enemiesContainer.appendChild(actorDiv);
    });
}

// Function to update persistent status effects display
function updateStatusEffectsDisplay(actorName, resourceTicks) {
    const statusEffectsContainer = document.getElementById(`actor-${actorName}`).querySelector('.status-effects');

    // Clear current displayed status effects
    statusEffectsContainer.innerHTML = '';

    resourceTicks.forEach(tick => {
        const effectEmoji = document.createElement('span');
        effectEmoji.textContent = statusEmojis[tick.id];
        effectEmoji.classList.add('status-effect');

        // Append each active effect emoji to the container
        statusEffectsContainer.appendChild(effectEmoji);
    });
}

// Function to update the action log
function updateActionLog(message) {
    const logContainer = document.getElementById('action-log');

    // Create a new message element
    const newMessage = document.createElement('div');
    newMessage.textContent = message;

    // Append the new message to the log container
    logContainer.appendChild(newMessage);

    // Remove oldest message if there are more than three
    if (logContainer.children.length > 3) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// Function to animate actions from the log
function animateActions(log) {
    log.forEach((event, index) => {

        setTimeout(() => {

            if (event.type === "playground.engine_v1.CombatEvent.SkillUsed") {
                const actorElement = document.getElementById(`actor-${event.actor}`);
                const skillEmoji = document.createElement('div');
                skillEmoji.textContent = skillEmojis[event.skill];
                skillEmoji.style.position = 'absolute';
                skillEmoji.style.fontSize = '2em';
                skillEmoji.style.transition = 'transform 0.5s, opacity 0.5s';
                skillEmoji.style.opacity = 1;

                const actorElementRect = actorElement.getBoundingClientRect();
                const targetElementRect = document.getElementById(`actor-${event.targets[0]}`).getBoundingClientRect();

                document.body.appendChild(skillEmoji);

                // Position emoji at the actor's position
                skillEmoji.style.left = `${actorElementRect.left + window.scrollX}px`;
                skillEmoji.style.top = `${actorElementRect.top + window.scrollY}px`;

                // Move emoji to target's position
                setTimeout(() => {
                    skillEmoji.style.transform = `translate(${targetElementRect.left - actorElementRect.left}px, ${targetElementRect.top - actorElementRect.top}px)`;
                }, 0);

                // Fade out and remove emoji after animation
                setTimeout(() => {
                    skillEmoji.style.opacity = 0;
                    document.body.removeChild(skillEmoji);
                }, 1000);

                // Animate actor movement
                actorElement.classList.add('strike');
                setTimeout(() => actorElement.classList.remove('strike'), 500);

                // Update action log with skill usage
                const targetName = event.targets.join(', ');
                updateActionLog(`${event.actor} uses ${event.skill} on ${targetName}`);

            } else if (event.type === "playground.engine_v1.CombatEvent.DamageDealt") {

                const targetElement = document.getElementById(`actor-${event.target}`);

                // Flicker effect on damage received
                targetElement.classList.add('flicker');
                setTimeout(() => targetElement.classList.remove('flicker'), 500);

                // Update health bar based on new targetHp value
                const targetActorHpPercentage = (event.targetHp / event.snapshot.actors.find(a => a.name === event.target).maxHp) * 100;

                const targetHealthBar = targetElement.querySelector('.health-bar');
                targetHealthBar.style.width = `${targetActorHpPercentage}%`;

            } else if (event.type === "playground.engine_v1.CombatEvent.ResourceDrained") {

                const statusEffectDiv = document.createElement('div');
                statusEffectDiv.textContent = statusEmojis[event.buffId];
                statusEffectDiv.style.fontSize = '1.5em';
                statusEffectDiv.style.position = 'absolute';
                statusEffectDiv.style.transition = 'opacity 0.5s';
                statusEffectDiv.style.opacity = 1;

                const targetHealthBarContainer = document.getElementById(`actor-${event.target}`).querySelector('.health-bar-container');
                const targetHealthBarContainerRect = targetHealthBarContainer.getBoundingClientRect();

                document.body.appendChild(statusEffectDiv);

                // Position emoji next to the health bar
                statusEffectDiv.style.left = `${targetHealthBarContainerRect.right + window.scrollX + 10}px`;
                statusEffectDiv.style.top = `${targetHealthBarContainerRect.top + window.scrollY}px`;

                // Fade out and remove status effect emoji after brief display
                setTimeout(() => {
                    statusEffectDiv.style.opacity= 0;
                    document.body.removeChild(statusEffectDiv);
                }, 1000);

                // Update action log with resource tick info
                updateActionLog(`${event.target} affected by ${event.buffId}`);
            }

            // Update persistent display of all actors' status effects after each event.
            event.snapshot.actors.forEach(actor => {
                updateStatusEffectsDisplay(actor.name, actor.resourceTicks);
            });

        }, index * 400); // Delay each action by 1 second

    });
}

// Main function to run the animation
async function runAnimation() {
    const logData = await loadLog();

    // Find initial snapshot from TurnStart event for setup
    const initialSnapshotEvent = logData.find(event => event.type === "playground.engine_v1.CombatEvent.TurnStart");

    if (initialSnapshotEvent && initialSnapshotEvent.snapshot) {
        initializeActors(initialSnapshotEvent.snapshot);
        animateActions(logData);
    } else {
        console.error("Initial snapshot not found in log.");
    }
}

// Start animation sequence
runAnimation();