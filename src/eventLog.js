// Event log formatting and logging utilities
import { updateActionLog } from './script.js';

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

export { formatEventLog, logEventUnified };

