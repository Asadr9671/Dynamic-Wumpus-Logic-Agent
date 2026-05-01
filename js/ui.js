/**
 * UI Controller — handles rendering, animations, and user interaction
 */

class WumpusUI {
    constructor() {
        this.world = null;
        this.agent = null;
        this.simulationInterval = null;
        this.isRunning = false;
        this.speed = 600; // ms per step
        this.currentState = null;
        this.showWorld = false; // Toggle to reveal hidden world

        this.initEventListeners();
        this.renderEmptyGrid(4, 4); // default grid preview
    }

    initEventListeners() {
        document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());
        document.getElementById('btn-step').addEventListener('click', () => this.stepAgent());
        document.getElementById('btn-run').addEventListener('click', () => this.toggleRun());
        document.getElementById('btn-reveal').addEventListener('click', () => this.toggleReveal());
        document.getElementById('btn-reset').addEventListener('click', () => this.reset());

        const speedSlider = document.getElementById('speed-slider');
        speedSlider.addEventListener('input', (e) => {
            this.speed = 1100 - parseInt(e.target.value);
            document.getElementById('speed-label').textContent = `${Math.round(1000/this.speed)} steps/s`;
        });

        document.getElementById('rows-input').addEventListener('input', () => this.previewGrid());
        document.getElementById('cols-input').addEventListener('input', () => this.previewGrid());
    }

    previewGrid() {
        const r = parseInt(document.getElementById('rows-input').value) || 4;
        const c = parseInt(document.getElementById('cols-input').value) || 4;
        this.renderEmptyGrid(r, c);
    }

    newGame() {
        const rows = Math.min(10, Math.max(2, parseInt(document.getElementById('rows-input').value) || 4));
        const cols = Math.min(10, Math.max(2, parseInt(document.getElementById('cols-input').value) || 4));
        const pitProb = parseFloat(document.getElementById('pit-prob').value) || 0.15;

        // Stop any running simulation
        this.stopSimulation();

        // Create new world and agent
        this.world = new WumpusGrid(rows, cols);
        this.world.placeHazards(pitProb);
        this.agent = new WumpusAgent(rows, cols);
        this.showWorld = false;
        this.currentState = null;

        this.updateControls(true);
        this.renderGrid();
        this.updateMetrics(null);
        this.updateLog([]);
        this.updateKBLog([]);

        this.setStatus('New game started! Click Step or Run to begin.', 'info');
        document.getElementById('btn-reveal').textContent = '🔍 Reveal World';
        document.getElementById('game-over-banner').style.display = 'none';
    }

    stepAgent() {
        if (!this.agent || !this.world) {
            this.setStatus('Start a new game first!', 'warning');
            return;
        }
        if (this.agent.gameOver) {
            this.setStatus('Game is over. Start a new game!', 'warning');
            return;
        }

        const state = this.agent.step(this.world);
        this.currentState = state;
        this.renderGrid();
        this.updateMetrics(state);
        this.updateLog(state.actionLog);
        this.updateKBLog(state.kbLog);

        if (state.gameOver) {
            this.stopSimulation();
            this.showGameOver(state);
        }
    }

    toggleRun() {
        if (this.isRunning) {
            this.stopSimulation();
        } else {
            this.startSimulation();
        }
    }

    startSimulation() {
        if (!this.agent || !this.world || this.agent.gameOver) return;

        this.isRunning = true;
        document.getElementById('btn-run').textContent = '⏸ Pause';
        document.getElementById('btn-run').classList.add('btn-pause');

        this.simulationInterval = setInterval(() => {
            this.stepAgent();
            if (this.agent.gameOver) {
                this.stopSimulation();
            }
        }, this.speed);
    }

    stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
        this.isRunning = false;
        document.getElementById('btn-run').textContent = '▶ Run Auto';
        document.getElementById('btn-run').classList.remove('btn-pause');
    }

    toggleReveal() {
        this.showWorld = !this.showWorld;
        document.getElementById('btn-reveal').textContent = this.showWorld ? '🙈 Hide World' : '🔍 Reveal World';
        this.renderGrid();
    }

    reset() {
        this.stopSimulation();
        this.world = null;
        this.agent = null;
        this.currentState = null;
        this.renderEmptyGrid(4, 4);
        this.updateMetrics(null);
        this.updateLog([]);
        this.updateKBLog([]);
        document.getElementById('game-over-banner').style.display = 'none';
        this.setStatus('Reset. Configure and start a new game.', 'info');
        this.updateControls(false);
    }

    // =========================================================
    // RENDERING
    // =========================================================

    renderEmptyGrid(rows, cols) {
        const container = document.getElementById('grid-container');
        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell unknown';
                cell.id = `cell-${r}-${c}`;
                if (r === 0 && c === 0) {
                    cell.classList.add('start');
                    cell.innerHTML = '<span class="cell-icon">🏠</span>';
                } else {
                    cell.innerHTML = '<span class="cell-icon">?</span>';
                }
                container.appendChild(cell);
            }
        }

        document.getElementById('grid-size-label').textContent = `${rows} × ${cols}`;
    }

    renderGrid() {
        if (!this.world || !this.agent) return;

        const { rows, cols } = this.world.getSize();
        const container = document.getElementById('grid-container');
        container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

        // Clear & rebuild if needed
        if (container.children.length !== rows * cols) {
            container.innerHTML = '';
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cell = document.createElement('div');
                    cell.id = `cell-${r}-${c}`;
                    container.appendChild(cell);
                }
            }
        }

        const agentPos = this.agent.position;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cellEl = document.getElementById(`cell-${r}-${c}`);
                const worldCell = this.world.getCellInfo(r, c);
                const key = `${r}_${c}`;

                const isAgent = (agentPos.r === r && agentPos.c === c);
                const isVisited = this.agent.visited.has(key);
                const isSafe = this.agent.safeKnown.has(key);
                const isUnsafe = this.agent.unsafeKnown.has(key);

                // Determine class
                cellEl.className = 'grid-cell';

                let icon = '';
                let tooltip = `(${r},${c})`;

                if (isAgent) {
                    cellEl.classList.add('agent');
                    icon = '🤖';
                    tooltip += ' - Agent';
                } else if (this.showWorld) {
                    // Reveal mode
                    if (worldCell.wumpus) {
                        cellEl.classList.add('wumpus');
                        icon = '👹';
                        tooltip += ' - WUMPUS';
                    } else if (worldCell.pit) {
                        cellEl.classList.add('pit');
                        icon = '🕳️';
                        tooltip += ' - PIT';
                    } else if (worldCell.gold) {
                        cellEl.classList.add('gold');
                        icon = '🏆';
                        tooltip += ' - GOLD';
                    } else if (isVisited) {
                        cellEl.classList.add('visited');
                        icon = this.getPerceptIcon(worldCell.percepts);
                        tooltip += ' - Visited';
                    } else if (isSafe) {
                        cellEl.classList.add('safe');
                        icon = '✓';
                        tooltip += ' - Proven Safe';
                    } else {
                        cellEl.classList.add('unknown');
                        icon = '?';
                    }
                } else {
                    // Agent perspective
                    if (isVisited) {
                        if (isUnsafe) {
                            cellEl.classList.add('danger');
                            icon = '💀';
                            tooltip += ' - DANGER';
                        } else {
                            cellEl.classList.add('visited');
                            icon = this.getPerceptIcon(worldCell.percepts);
                            tooltip += ' - Visited';
                        }
                    } else if (isUnsafe) {
                        cellEl.classList.add('danger');
                        icon = '⚠️';
                        tooltip += ' - Confirmed Danger';
                    } else if (isSafe) {
                        cellEl.classList.add('safe');
                        icon = '✓';
                        tooltip += ' - Proven Safe';
                    } else {
                        cellEl.classList.add('unknown');
                        icon = '?';
                        tooltip += ' - Unknown';
                    }
                }

                // Add percept indicators for visited cells
                let perceptBadges = '';
                if (isVisited && !isAgent) {
                    if (worldCell.percepts.breeze) perceptBadges += '<span class="percept-badge breeze-badge">💨</span>';
                    if (worldCell.percepts.stench) perceptBadges += '<span class="percept-badge stench-badge">💀</span>';
                    if (worldCell.gold && this.showWorld) perceptBadges += '<span class="percept-badge gold-badge">✨</span>';
                }

                cellEl.innerHTML = `<span class="cell-icon">${icon}</span>${perceptBadges}<span class="cell-coord">${r},${c}</span>`;
                cellEl.title = tooltip;

                // Highlight start
                if (r === 0 && c === 0 && !isAgent) {
                    cellEl.classList.add('start');
                }
            }
        }

        document.getElementById('grid-size-label').textContent = `${rows} × ${cols}`;
    }

    getPerceptIcon(percepts) {
        if (percepts.breeze && percepts.stench) return '💨💀';
        if (percepts.breeze) return '💨';
        if (percepts.stench) return '💀';
        return '🟢';
    }

    updateMetrics(state) {
        if (!state) {
            document.getElementById('metric-moves').textContent = '0';
            document.getElementById('metric-visited').textContent = '0';
            document.getElementById('metric-safe').textContent = '0';
            document.getElementById('metric-inference').textContent = '0';
            document.getElementById('metric-clauses').textContent = '0';
            document.getElementById('metric-status').textContent = 'Idle';
            document.getElementById('percept-display').textContent = '—';
            return;
        }

        document.getElementById('metric-moves').textContent = state.moveCount;
        document.getElementById('metric-visited').textContent = state.visited.size;
        document.getElementById('metric-safe').textContent = state.safeKnown.size;
        document.getElementById('metric-inference').textContent = state.totalInferenceSteps;
        document.getElementById('metric-clauses').textContent = state.kbStats.clauses;

        const statusMap = {
            GOLD_FOUND: '🏆 Gold Found!',
            FELL_IN_PIT: '💀 Fell in Pit',
            EATEN_BY_WUMPUS: '👹 Eaten by Wumpus',
            STUCK: '😵 Stuck',
            ALL_EXPLORED: '🔍 All Explored'
        };

        if (state.gameOver) {
            document.getElementById('metric-status').textContent = statusMap[state.gameOverReason] || 'Game Over';
        } else {
            document.getElementById('metric-status').textContent = state.alive ? '🤖 Exploring...' : 'Dead';
        }

        // Update current percepts
        const p = state.percepts;
        const perceptList = [];
        if (p.breeze) perceptList.push('💨 Breeze');
        if (p.stench) perceptList.push('💀 Stench');
        if (p.glitter) perceptList.push('✨ Glitter');
        document.getElementById('percept-display').textContent = perceptList.length > 0 ? perceptList.join(', ') : 'None';
        document.getElementById('agent-pos-display').textContent = `(${state.position.r}, ${state.position.c})`;
    }

    updateLog(log) {
        const logEl = document.getElementById('agent-log');
        const last20 = log.slice(-30);
        logEl.innerHTML = last20.map((entry, i) => {
            let cls = 'log-entry';
            if (entry.includes('DEAD') || entry.includes('PIT') || entry.includes('WUMPUS')) cls += ' log-danger';
            else if (entry.includes('SAFE') || entry.includes('GOLD') || entry.includes('proven')) cls += ' log-safe';
            else if (entry.includes('KB')) cls += ' log-kb';
            return `<div class="${cls}">${entry}</div>`;
        }).join('');
        logEl.scrollTop = logEl.scrollHeight;
    }

    updateKBLog(log) {
        const logEl = document.getElementById('kb-log');
        const last30 = log.slice(-40);
        logEl.innerHTML = last30.map(entry => {
            let cls = 'log-entry';
            if (entry.includes('YES') || entry.includes('safe')) cls += ' log-safe';
            else if (entry.includes('NO') || entry.includes('contradiction')) cls += ' log-danger';
            return `<div class="${cls}">${entry}</div>`;
        }).join('');
        logEl.scrollTop = logEl.scrollHeight;
    }

    showGameOver(state) {
        const banner = document.getElementById('game-over-banner');
        const title = document.getElementById('game-over-title');
        const detail = document.getElementById('game-over-detail');

        const messages = {
            GOLD_FOUND: { title: '🏆 SUCCESS — Gold Found!', detail: `Agent found the gold in ${state.moveCount} moves using ${state.totalInferenceSteps} inference steps!`, cls: 'success' },
            FELL_IN_PIT: { title: '💀 FAILURE — Fell into a Pit!', detail: `Agent fell into a pit at (${state.position.r},${state.position.c}) after ${state.moveCount} moves.`, cls: 'failure' },
            EATEN_BY_WUMPUS: { title: '👹 FAILURE — Eaten by Wumpus!', detail: `Agent was eaten by the Wumpus at (${state.position.r},${state.position.c}) after ${state.moveCount} moves.`, cls: 'failure' },
            STUCK: { title: '😵 STUCK — No Safe Moves!', detail: `Agent explored ${state.visited.size} cells but could not proceed safely.`, cls: 'warning' },
            ALL_EXPLORED: { title: '🔍 Complete — All Explored!', detail: `Agent safely explored all reachable cells in ${state.moveCount} moves.`, cls: 'success' }
        };

        const msg = messages[state.gameOverReason] || { title: 'Game Over', detail: '', cls: 'info' };

        title.textContent = msg.title;
        detail.textContent = msg.detail;
        banner.className = `game-over-banner ${msg.cls}`;
        banner.style.display = 'flex';
        this.showWorld = true;
        document.getElementById('btn-reveal').textContent = '🙈 Hide World';
        this.renderGrid();
    }

    setStatus(msg, type = 'info') {
        const el = document.getElementById('status-bar');
        el.textContent = msg;
        el.className = `status-bar status-${type}`;
    }

    updateControls(gameActive) {
        document.getElementById('btn-step').disabled = !gameActive;
        document.getElementById('btn-run').disabled = !gameActive;
        document.getElementById('btn-reveal').disabled = !gameActive;
    }
}

// Initialize UI on load
window.addEventListener('DOMContentLoaded', () => {
    window.ui = new WumpusUI();
});
