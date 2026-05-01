# 🧠 Wumpus Logic Agent — Dynamic KB Pathfinder

---

## 📌 Overview

A **Web-based Knowledge-Based Agent** that navigates a dynamic Wumpus World grid using **Propositional Logic** and **Resolution Refutation**. The agent perceives its environment, updates a KB in CNF, and uses automated theorem proving to deduce safe cells before moving.

---

## 🚀 Live Demo

Open `index.html` directly in any modern browser — **no server or build step required**.

---

## ⚙️ Features

| Feature | Details |
|---|---|
| Dynamic Grid | User-configurable N×M grid (2–10 rows/cols) |
| Dynamic Hazards | Pits & Wumpus randomly placed each game |
| Percept System | Breeze (pit nearby) · Stench (wumpus nearby) · Glitter (gold) |
| Knowledge Base | Propositional Logic stored as CNF clauses |
| Inference Engine | Resolution Refutation — proof by contradiction |
| Safe-cell deduction | Agent only moves to KB-proven safe cells |
| Real-time Metrics | Moves · Visited · Safe Proved · KB Clauses · Inference Steps |
| Grid Visualization | Green=Safe · Blue=Visited · Gray=Unknown · Red=Danger |
| Reveal Mode | Toggle to see the hidden world (pits, wumpus, gold) |

---

## 🔬 Algorithm Details

### Knowledge Base (CNF)
Every percept is encoded as propositional sentences and stored in **Conjunctive Normal Form (CNF)**:

- `Breeze(r,c)` → `P(r±1,c) ∨ P(r,c±1)` (at least one adjacent pit)
- `¬Breeze(r,c)` → `¬P(adj)` for all adjacent cells
- `Stench(r,c)` → `W(adj1) ∨ W(adj2) ∨ ...`
- `Safe(r,c)` → `¬P(r,c) ∧ ¬W(r,c)`

### Resolution Refutation
To check if cell `(r,c)` is safe, the agent **asks** the KB:

1. Negate the query: add `¬(¬P_r_c)` = `P_r_c` to working set
2. Apply resolution rule: resolve complementary literals between clause pairs
3. If **empty clause** is derived → contradiction → query is **entailed** (cell proven safe)
4. If no new clauses can be derived → query **not** entailed

### Agent Strategy
1. **Perceive** current cell → update KB
2. **Query KB** for all adjacent unvisited cells
3. **Move** to a proven-safe adjacent cell
4. **Backtrack** via BFS if no safe adjacent cell available
5. **Risk move** as last resort on unknown cells

---

## 📁 Project Structure

```
22F-3390_AI-Ass-6_Q6-code/
├── index.html          # Main application page
├── style.css           # Dark-theme styling & animations
├── js/
│   ├── kb.js           # KnowledgeBase + Clause + Resolution engine
│   ├── agent.js        # WumpusGrid + WumpusAgent logic
│   └── ui.js           # UI Controller (rendering, events, metrics)
└── README.md
```

---

## 🎮 How to Use

1. Open `index.html` in Chrome/Firefox/Edge
2. Set **Rows**, **Cols**, and **Pit Probability**
3. Click **New Game** to generate a random world
4. Use **Step** (single move) or **Run Auto** (continuous)
5. Watch the agent deduce safe cells using Resolution
6. Click **Reveal World** to see hidden pits/wumpus
7. Check real-time KB stats in the right panel

---

## 🔑 CNF Example

If agent perceives **Breeze** at `(0,0)` on a 4×4 grid:

```
KB.tell: B_0_0
KB.tell: [P_0_1 ∨ P_1_0]        ← at least one adjacent pit
KB.tell: [~P_0_1 ∨ B_0_0]       ← biconditional (converse)
KB.tell: [~P_1_0 ∨ B_0_0]
```

To prove `~P_0_1` (no pit at (0,1)):
- Add `P_0_1` (negation of query)
- Resolve `[P_0_1]` with `[~P_0_1 ∨ B_0_0]` → `[B_0_0]`
- Resolve with `[~B_0_0]` → **empty clause** → contradiction → **SAFE** ✓

---

## 📊 Metrics Explained

| Metric | Meaning |
|---|---|
| **Moves** | Total agent steps taken |
| **Visited** | Cells the agent has entered |
| **Safe Proved** | Cells KB has proven safe via resolution |
| **KB Clauses** | Number of CNF clauses in Knowledge Base |
| **Inference Steps** | Total resolution rule applications |

---

## 👤 Author

**Student ID:** 22F-3390  
**Course:** Artificial Intelligence — Assignment 6, Question 6  
**Institution:** FAST-NUCES, Chiniot-Faisalabad Campus
