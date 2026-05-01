/**
 * Wumpus World Grid & Game Logic
 * Manages the environment: grid state, hazard placement, percept generation
 */

class WumpusGrid {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.grid = [];       // The actual hidden world
        this.init();
    }

    init() {
        // Each cell: { pit: bool, wumpus: bool, gold: bool, visited: bool, safe: bool }
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = {
                    pit: false,
                    wumpus: false,
                    gold: false,
                    visited: false,
                    safe: null,    // null=unknown, true=proven safe, false=proven dangerous
                    percepts: { breeze: false, stench: false }
                };
            }
        }
    }

    /**
     * Randomly place hazards (pits + wumpus)
     * Start cell (0,0) is always safe
     */
    placeHazards(pitProbability = 0.15) {
        let wumpusPlaced = false;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (r === 0 && c === 0) continue; // Start is always safe

                // Place pit with given probability
                if (Math.random() < pitProbability) {
                    this.grid[r][c].pit = true;
                }

                // Place wumpus in exactly one cell (not start, not pit)
                if (!wumpusPlaced && r > 0 && !this.grid[r][c].pit && Math.random() < 0.3) {
                    this.grid[r][c].wumpus = true;
                    wumpusPlaced = true;
                }
            }
        }

        // If no wumpus was placed, force-place it somewhere valid
        if (!wumpusPlaced) {
            let placed = false;
            while (!placed) {
                const r = Math.floor(Math.random() * this.rows);
                const c = Math.floor(Math.random() * this.cols);
                if ((r !== 0 || c !== 0) && !this.grid[r][c].pit) {
                    this.grid[r][c].wumpus = true;
                    placed = true;
                }
            }
        }

        // Place gold somewhere
        let goldPlaced = false;
        while (!goldPlaced) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);
            if ((r !== 0 || c !== 0) && !this.grid[r][c].pit && !this.grid[r][c].wumpus) {
                this.grid[r][c].gold = true;
                goldPlaced = true;
            }
        }

        // Calculate percepts for all cells
        this.calculatePercepts();
    }

    calculatePercepts() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const adj = this.getAdjacent(r, c);
                let breeze = false, stench = false;

                for (const [ar, ac] of adj) {
                    if (this.grid[ar][ac].pit) breeze = true;
                    if (this.grid[ar][ac].wumpus) stench = true;
                }

                this.grid[r][c].percepts = { breeze, stench };
            }
        }
    }

    /**
     * Get percepts for a specific cell (what the agent "feels")
     */
    getPercepts(r, c) {
        const cell = this.grid[r][c];
        return {
            breeze: cell.percepts.breeze,
            stench: cell.percepts.stench,
            glitter: cell.gold,
            bump: false,
            scream: false
        };
    }

    /**
     * Check if agent dies at this cell
     */
    isDangerous(r, c) {
        return this.grid[r][c].pit || this.grid[r][c].wumpus;
    }

    getAdjacent(r, c) {
        const adj = [];
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                adj.push([nr, nc]);
            }
        }
        return adj;
    }

    /**
     * Get a serializable copy of the grid state for display
     */
    getCellInfo(r, c) {
        return { ...this.grid[r][c] };
    }

    getSize() {
        return { rows: this.rows, cols: this.cols };
    }
}

// ============================================================
// Agent Class
// ============================================================
class WumpusAgent {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.kb = new KnowledgeBase();
        this.position = { r: 0, c: 0 };
        this.visited = new Set();
        this.safeKnown = new Set(['0_0']);  // Start is known safe
        this.unsafeKnown = new Set();
        this.frontier = [];   // Cells to explore
        this.path = [];       // Movement history
        this.alive = true;
        this.foundGold = false;
        this.gameOver = false;
        this.gameOverReason = '';
        this.moveCount = 0;
        this.totalInferenceSteps = 0;
        this.actionLog = [];

        // Initialize KB with start cell axioms
        this.kb.markSafe(0, 0);
        this.addLog('Agent initialized at (0,0). KB seeded with start-cell safety.');
    }

    addLog(msg) {
        const entry = `[Move ${this.moveCount}] ${msg}`;
        this.actionLog.push(entry);
        if (this.actionLog.length > 300) this.actionLog.shift();
    }

    /**
     * Process percepts at current location and update KB
     */
    perceive(percepts, grid) {
        const { r, c } = this.position;
        const key = `${r}_${c}`;

        if (!this.visited.has(key)) {
            this.visited.add(key);
            this.kb.markSafe(r, c);
            this.safeKnown.add(key);

            const desc = [];
            if (percepts.breeze) desc.push('Breeze');
            if (percepts.stench) desc.push('Stench');
            if (percepts.glitter) desc.push('Glitter (GOLD!)');
            if (desc.length === 0) desc.push('None');

            this.addLog(`At (${r},${c}): Percepts = ${desc.join(', ')}`);

            // Update KB with percepts
            this.kb.addBreezePercept(r, c, percepts.breeze, this.rows, this.cols);
            this.kb.addStenchPercept(r, c, percepts.stench, this.rows, this.cols);

            if (percepts.glitter) {
                this.foundGold = true;
                this.addLog('GOLD FOUND! Agent wins!');
            }
        }
    }

    /**
     * Decide next move using KB inference
     * Returns { r, c } of next cell or null if no safe move available
     */
    decideNextMove() {
        const { r, c } = this.position;
        const adjacent = this.getAdjacent(r, c);
        const safeUnvisited = [];
        const unknownCells = [];

        // Check all adjacent cells
        for (const [ar, ac] of adjacent) {
            const key = `${ar}_${ac}`;
            if (this.unsafeKnown.has(key)) continue;

            if (this.visited.has(key)) continue;

            if (this.safeKnown.has(key)) {
                safeUnvisited.push([ar, ac]);
            } else {
                // Ask KB if this cell is safe
                this.addLog(`Querying KB for safety of (${ar},${ac})...`);
                const result = this.kb.isSafe(ar, ac);
                this.totalInferenceSteps += result.steps;

                if (result.safe) {
                    this.addLog(`KB proves (${ar},${ac}) is SAFE in ${result.steps} steps`);
                    this.safeKnown.add(key);
                    safeUnvisited.push([ar, ac]);
                } else {
                    this.addLog(`KB cannot prove (${ar},${ac}) safe (${result.steps} steps)`);
                    unknownCells.push([ar, ac]);
                }
            }
        }

        // Prefer safe unvisited adjacent cells
        if (safeUnvisited.length > 0) {
            // Pick cell closest to unexplored area
            const next = safeUnvisited[0];
            this.addLog(`Moving to proven-safe cell (${next[0]},${next[1]})`);
            return { r: next[0], c: next[1] };
        }

        // If no safe adjacent, try to backtrack to a safe visited cell with unknown neighbors
        const backtrackTarget = this.findBacktrackTarget();
        if (backtrackTarget) {
            this.addLog(`Backtracking toward (${backtrackTarget.r},${backtrackTarget.c})`);
            return backtrackTarget;
        }

        // Last resort: try an unknown cell (risky)
        if (unknownCells.length > 0) {
            const next = unknownCells[0];
            this.addLog(`Taking calculated risk on unknown cell (${next[0]},${next[1]})`);
            return { r: next[0], c: next[1] };
        }

        this.addLog('No valid moves found. Agent is stuck.');
        return null;
    }

    findBacktrackTarget() {
        // BFS from current position through visited cells
        // to find a visited cell with safe unvisited neighbors
        const queue = [[this.position.r, this.position.c]];
        const visitedBFS = new Set([`${this.position.r}_${this.position.c}`]);

        while (queue.length > 0) {
            const [cr, cc] = queue.shift();
            const adj = this.getAdjacent(cr, cc);

            for (const [ar, ac] of adj) {
                const key = `${ar}_${ac}`;

                if (visitedBFS.has(key)) continue;

                if (this.visited.has(key)) {
                    visitedBFS.add(key);
                    queue.push([ar, ac]);

                    // Check if this visited cell has safe unvisited neighbors
                    const neighbors = this.getAdjacent(ar, ac);
                    for (const [nr, nc] of neighbors) {
                        const nKey = `${nr}_${nc}`;
                        if (!this.visited.has(nKey) && this.safeKnown.has(nKey)) {
                            // Move toward this backtrack target
                            return this.nextStepToward(ar, ac);
                        }
                    }
                }
            }
        }

        return null;
    }

    nextStepToward(targetR, targetC) {
        // Simple BFS to find next step from current position toward target
        const { r, c } = this.position;
        if (r === targetR && c === targetC) return { r, c };

        const queue = [[r, c, null]];
        const visitedBFS = new Set([`${r}_${c}`]);

        while (queue.length > 0) {
            const [cr, cc, firstStep] = queue.shift();
            const adj = this.getAdjacent(cr, cc);

            for (const [ar, ac] of adj) {
                const key = `${ar}_${ac}`;
                if (visitedBFS.has(key) || this.unsafeKnown.has(key)) continue;
                if (!this.visited.has(key) && !this.safeKnown.has(key)) continue;

                visitedBFS.add(key);
                const step = firstStep || { r: ar, c: ac };

                if (ar === targetR && ac === targetC) return step;
                queue.push([ar, ac, step]);
            }
        }

        return null;
    }

    getAdjacent(r, c) {
        const adj = [];
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                adj.push([nr, nc]);
            }
        }
        return adj;
    }

    /**
     * Execute one step of the agent
     * Returns state update object
     */
    step(world) {
        if (this.gameOver || !this.alive) return null;

        this.moveCount++;

        // Get percepts at current position
        const percepts = world.getPercepts(this.position.r, this.position.c);

        // Process percepts and update KB
        this.perceive(percepts, world);

        if (this.foundGold) {
            this.gameOver = true;
            this.gameOverReason = 'GOLD_FOUND';
            return this.getState(percepts);
        }

        // Decide next move
        const next = this.decideNextMove();

        if (!next) {
            this.gameOver = true;
            this.gameOverReason = 'STUCK';
            this.addLog('Agent is stuck — no safe moves available.');
            return this.getState(percepts);
        }

        // Check if all cells have been explored or no new moves possible
        const allVisited = this.visited.size >= this.rows * this.cols;
        if (allVisited) {
            this.gameOver = true;
            this.gameOverReason = 'ALL_EXPLORED';
            return this.getState(percepts);
        }

        // Move to next cell
        this.path.push({ ...this.position });
        this.position = { r: next.r, c: next.c };
        this.addLog(`Moved to (${next.r},${next.c})`);

        // Check if agent dies
        if (world.isDangerous(next.r, next.c)) {
            const cell = world.getCellInfo(next.r, next.c);
            this.alive = false;
            this.gameOver = true;
            if (cell.pit) {
                this.gameOverReason = 'FELL_IN_PIT';
                this.addLog(`DEAD! Agent fell into pit at (${next.r},${next.c})!`);
                this.unsafeKnown.add(`${next.r}_${next.c}`);
            } else if (cell.wumpus) {
                this.gameOverReason = 'EATEN_BY_WUMPUS';
                this.addLog(`DEAD! Agent eaten by Wumpus at (${next.r},${next.c})!`);
                this.unsafeKnown.add(`${next.r}_${next.c}`);
            }
        }

        return this.getState(percepts);
    }

    getState(percepts) {
        return {
            position: { ...this.position },
            percepts,
            alive: this.alive,
            foundGold: this.foundGold,
            gameOver: this.gameOver,
            gameOverReason: this.gameOverReason,
            visited: new Set(this.visited),
            safeKnown: new Set(this.safeKnown),
            unsafeKnown: new Set(this.unsafeKnown),
            moveCount: this.moveCount,
            kbStats: this.kb.getStats(),
            totalInferenceSteps: this.totalInferenceSteps,
            actionLog: [...this.actionLog],
            kbLog: [...this.kb.log]
        };
    }
}

window.WumpusGrid = WumpusGrid;
window.WumpusAgent = WumpusAgent;
