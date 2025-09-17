// Playback controller module for battle log playback
// Handles play, pause, step, and state rebuild

function createPlayback({
    initializeActors,
    updateAllActorDisplays,
    logEventUnified,
    executeEvent,
    updatePlayToggleButton
}) {
    return {
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
                return;
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
                if (this.playing) this.pause();
            }
        },

        stepBack() {
            if (this.index < 0) return;
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

        setSpeed(multiplier) {
            this.speed = multiplier;
            if (this.playing) {
                this.pause();
                this.play();
            }
        }
    };
}

export { createPlayback };

