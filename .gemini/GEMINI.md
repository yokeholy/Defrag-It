# Project Context: defragIt

## Overview
**defragIt** is a retro-inspired manual disk defragmentation puzzle game built with React, TypeScript, and Vite. The goal is to organize fragmented file blocks into contiguous sectors.

## Tech Stack
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **State/Drag & Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **Styling:** Vanilla CSS with CSS Variables for responsive scaling.
- **Deployment:** GitHub Pages (via `gh-pages`)

## Current State (v1.3.0)
The project is stable, deployed, and fully responsive.

### Core Features
1.  **Game Mechanics:**
    - **Grid:** A dynamic grid of sectors (Empty, Used, Locked).
    - **Files:** "Used" sectors are grouped into files (1-4 blocks). Moving one moves the whole file.
    - **Validation:** Files can only be dropped into *completely* empty space. No overlapping allowed.
    - **Connectivity:** Visual "bridges" connect sectors of the same file.

2.  **Difficulty Modes:**
    - **Easy:** 10x10 (100 sectors).
    - **Hard:** 20x20 (400 sectors).
    - **Nightmare:** 30x30 (900 sectors).

3.  **Auto-Solver (The "Pro" AI):**
    - **Strategy:** Uses a "Best Fit or Evacuate" deterministic algorithm.
    - **Logic:**
        1.  Try to fill the earliest gap with the best-fitting forward file.
        2.  If stuck, move the *blocker* (file after the gap) to the *end* of the disk to widen the gap.
        3.  Never overwrites locked sectors.
    - **Controls:** Adjustable speed slider (0.1s - 1.0s).

4.  **Responsiveness:**
    - Uses CSS variables (`--size`, `--gap`) calculated via `clamp()` and `calc()` to fit the grid into any viewport.
    - `touch-action: none` prevents scrolling interference on mobile.

### Recent Changes
- **Fixed:** `DndContext` syntax error.
- **Fixed:** Auto-solver infinite loops (switched to deterministic back-to-front evacuation).
- **Fixed:** Drag target highlight alignment (synchronized CSS variables).
- **Fixed:** Move/Volume counters (decoupled from render loop).

## Architecture Notes
- **App.tsx:** Contains all game logic, solver algorithms, and state management.
- **App.css:** Handles all visuals, including the 3D-style sectors, glow effects, and the responsive grid layout engine.
- **scripts/simulate_solver.js:** A Node.js script used to stress-test the auto-solver logic against thousands of random seeds.

## To-Do / Future Ideas
- [ ] Sound effects for dragging/dropping/winning.
- [ ] "Ultra" mode with moving locked sectors?
- [ ] Leaderboard (local or Firebase).
