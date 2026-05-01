/**
 * Knowledge Base (KB) - Propositional Logic Engine
 * Wumpus World Knowledge-Based Agent
 * 
 * Implements:
 * - Propositional Logic KB storage
 * - CNF (Conjunctive Normal Form) conversion
 * - Resolution Refutation for entailment checking
 */

class Clause {
    constructor(literals) {
        // A clause is a disjunction of literals
        // literals: Set of strings like "P_1_2", "~W_2_3"
        this.literals = new Set(literals);
    }

    // Check if this clause is empty (contradiction)
    isEmpty() {
        return this.literals.size === 0;
    }

    // Check if this is a unit clause
    isUnit() {
        return this.literals.size === 1;
    }

    // Get string representation
    toString() {
        if (this.isEmpty()) return '⊥ (empty/contradiction)';
        return '[' + Array.from(this.literals).join(' ∨ ') + ']';
    }

    // Check equality with another clause
    equals(other) {
        if (this.literals.size !== other.literals.size) return false;
        for (const lit of this.literals) {
            if (!other.literals.has(lit)) return false;
        }
        return true;
    }

    // Clone
    clone() {
        return new Clause(new Set(this.literals));
    }
}

class KnowledgeBase {
    constructor() {
        this.clauses = [];       // CNF clauses
        this.rawSentences = [];  // Human-readable sentences for logging
        this.inferenceSteps = 0;
        this.log = [];
    }

    reset() {
        this.clauses = [];
        this.rawSentences = [];
        this.inferenceSteps = 0;
        this.log = [];
    }

    addLog(message) {
        this.log.push(message);
        if (this.log.length > 200) this.log.shift();
    }

    /**
     * Add a sentence to the KB in CNF form.
     * sentence: array of arrays (outer = AND of clauses, inner = OR of literals)
     * Example: [["P_1_2"], ["~B_1_1", "P_1_2", "P_2_1"]]
     */
    tell(cnfClauses, rawDescription = '') {
        if (rawDescription) {
            this.rawSentences.push(rawDescription);
            this.addLog(`KB.tell: ${rawDescription}`);
        }
        for (const clauseLiterals of cnfClauses) {
            const clause = new Clause(clauseLiterals);
            if (!this.clauseExists(clause)) {
                this.clauses.push(clause);
            }
        }
    }

    clauseExists(clause) {
        return this.clauses.some(c => c.equals(clause));
    }

    /**
     * Resolution Refutation: Ask if KB |= alpha
     * Returns { entailed: bool, steps: int, proof: string[] }
     */
    ask(alpha, description = '') {
        this.addLog(`KB.ask: Is "${description || alpha}" entailed?`);
        const result = this.resolution(alpha);
        this.addLog(`  → Result: ${result.entailed ? 'YES (safe)' : 'NO (not proved safe)'} in ${result.steps} steps`);
        this.inferenceSteps += result.steps;
        return result;
    }

    /**
     * Resolution algorithm (proof by refutation)
     * To prove alpha, we add ~alpha to KB and try to derive empty clause (contradiction)
     */
    resolution(alpha) {
        // Negate alpha to form clauses for refutation
        const negAlphaClauses = this.negateLiteral(alpha);

        // Combine KB clauses + negated alpha
        const workingClauses = this.clauses.map(c => c.clone());
        for (const clauseLits of negAlphaClauses) {
            workingClauses.push(new Clause(clauseLits));
        }

        const proofSteps = [];
        let steps = 0;
        const maxSteps = 500;

        // Resolution loop
        let newClauses = [];
        const seen = new Set(workingClauses.map(c => this.clauseKey(c)));

        while (steps < maxSteps) {
            let foundNew = false;

            for (let i = 0; i < workingClauses.length; i++) {
                for (let j = i + 1; j < workingClauses.length; j++) {
                    steps++;
                    const resolvents = this.resolve(workingClauses[i], workingClauses[j]);

                    for (const resolvent of resolvents) {
                        if (resolvent.isEmpty()) {
                            // Found contradiction → alpha is entailed
                            proofSteps.push(`Contradiction found between ${workingClauses[i].toString()} and ${workingClauses[j].toString()}`);
                            proofSteps.push('→ Empty clause derived → KB |= alpha');
                            return { entailed: true, steps, proof: proofSteps };
                        }

                        const key = this.clauseKey(resolvent);
                        if (!seen.has(key)) {
                            seen.add(key);
                            newClauses.push(resolvent);
                            foundNew = true;
                            proofSteps.push(`Resolved: ${workingClauses[i].toString()} + ${workingClauses[j].toString()} → ${resolvent.toString()}`);
                        }
                    }
                }
            }

            if (!foundNew) {
                // No new clauses → alpha is NOT entailed
                proofSteps.push('No new clauses derivable → KB does not entail alpha');
                return { entailed: false, steps, proof: proofSteps };
            }

            workingClauses.push(...newClauses);
            newClauses = [];
        }

        return { entailed: false, steps, proof: proofSteps };
    }

    /**
     * Resolve two clauses
     * Returns list of new clauses produced by resolving complementary literals
     */
    resolve(c1, c2) {
        const resolvents = [];

        for (const lit of c1.literals) {
            const complement = this.negate(lit);
            if (c2.literals.has(complement)) {
                // Resolve on this literal
                const newLits = new Set([...c1.literals, ...c2.literals]);
                newLits.delete(lit);
                newLits.delete(complement);
                resolvents.push(new Clause(newLits));
            }
        }

        return resolvents;
    }

    /**
     * Negate a single literal string
     * "P_1_2" → "~P_1_2", "~P_1_2" → "P_1_2"
     */
    negate(literal) {
        if (literal.startsWith('~')) {
            return literal.substring(1);
        }
        return '~' + literal;
    }

    /**
     * Negate a query literal to form clauses for refutation
     * For a positive literal "alpha", returns [["~alpha"]]
     * For ~alpha, returns [["alpha"]]
     */
    negateLiteral(alpha) {
        return [[this.negate(alpha)]];
    }

    /**
     * Create a unique key for a clause (for deduplication)
     */
    clauseKey(clause) {
        return Array.from(clause.literals).sort().join('|');
    }

    /**
     * Add Wumpus World specific axioms for a given cell (r, c)
     * Breeze at (r,c) ↔ Pit in adjacent cells
     * Stench at (r,c) ↔ Wumpus in adjacent cell
     */
    addBreezePercept(r, c, hasBreeeze, gridRows, gridCols) {
        const cell = `${r}_${c}`;
        const adjacent = this.getAdjacent(r, c, gridRows, gridCols);

        if (hasBreeeze) {
            // B_r_c → (P_adj1 ∨ P_adj2 ∨ ...)
            this.tell([[`B_${cell}`]], `Breeze perceived at (${r},${c})`);

            // B_r_c → ∨(P_adj)  i.e., at least one adjacent has pit
            const adjPitLits = adjacent.map(([ar, ac]) => `P_${ar}_${ac}`);
            this.tell([adjPitLits], `Breeze at (${r},${c}) → Pit in adjacent ${adjPitLits.join(' or ')}`);

            // For each adjacent: P_adj → B_r_c (converse)
            for (const [ar, ac] of adjacent) {
                this.tell([[`~P_${ar}_${ac}`, `B_${cell}`]], `P(${ar},${ac}) → B(${r},${c})`);
            }
        } else {
            // ~B_r_c → ~P_adj for all adj
            this.tell([[`~B_${cell}`]], `No breeze at (${r},${c})`);
            for (const [ar, ac] of adjacent) {
                this.tell([[`~P_${ar}_${ac}`]], `No breeze at (${r},${c}) → No pit at (${ar},${ac})`);
            }
        }
    }

    addStenchPercept(r, c, hasStench, gridRows, gridCols) {
        const cell = `${r}_${c}`;
        const adjacent = this.getAdjacent(r, c, gridRows, gridCols);

        if (hasStench) {
            this.tell([[`S_${cell}`]], `Stench perceived at (${r},${c})`);

            const adjWumpusLits = adjacent.map(([ar, ac]) => `W_${ar}_${ac}`);
            this.tell([adjWumpusLits], `Stench at (${r},${c}) → Wumpus in adjacent`);
        } else {
            this.tell([[`~S_${cell}`]], `No stench at (${r},${c})`);
            for (const [ar, ac] of adjacent) {
                this.tell([[`~W_${ar}_${ac}`]], `No stench at (${r},${c}) → No Wumpus at (${ar},${ac})`);
            }
        }
    }

    /**
     * Mark a cell as definitely safe (visited without dying)
     */
    markSafe(r, c) {
        this.tell([[`~P_${r}_${c}`], [`~W_${r}_${c}`]], `Cell (${r},${c}) is safe (visited)`);
    }

    /**
     * Check if a cell is provably safe
     * Safe means: no pit (~P_r_c) AND no wumpus (~W_r_c)
     */
    isSafe(r, c) {
        const noPitResult = this.ask(`~P_${r}_${c}`, `No pit at (${r},${c})`);
        const noWumpusResult = this.ask(`~W_${r}_${c}`, `No Wumpus at (${r},${c})`);

        return {
            safe: noPitResult.entailed && noWumpusResult.entailed,
            noPit: noPitResult.entailed,
            noWumpus: noWumpusResult.entailed,
            steps: noPitResult.steps + noWumpusResult.steps
        };
    }

    /**
     * Get adjacent cells within grid bounds
     */
    getAdjacent(r, c, rows, cols) {
        const adj = [];
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                adj.push([nr, nc]);
            }
        }
        return adj;
    }

    getStats() {
        return {
            clauses: this.clauses.length,
            sentences: this.rawSentences.length,
            inferenceSteps: this.inferenceSteps
        };
    }
}

// Export for use
window.KnowledgeBase = KnowledgeBase;
window.Clause = Clause;
