# defragIt

A vibrant, retro-inspired manual disk defragmentation game built with React, TypeScript, and Vite. Inspired by the classic Windows Defrag tool, this game challenges you to optimize your disk by manually relocating fragmented files into contiguous blocks.

## 🚀 Version 1.3 - Current Features

### 🧩 Game Mechanics
- **Manual Defragmentation**: Drag fragmented (blue) files into empty (grey) spaces to defragment them.
- **Multi-Sector Files**: Files vary in size (1 to 4 contiguous sectors). Dragging any part of a file moves the entire block.
- **Strict Validation**: Files can only be placed in completely free contiguous space. No overlaps allowed!
- **Dynamic Visuals**: Sectors turn green once they are part of a contiguous defragmented block at the front of the disk.
- **Visual Connectivity**: Connected sectors are visually linked with data "bridges" to show file integrity.

### 🎮 Difficulty Modes
Choose your challenge via the **New Disk** modal:
- **Easy**: 10x10 grid (100 sectors). Perfect for learning the mechanics.
- **Hard**: 20x20 grid (400 sectors). Increased fragmentation and tighter space.
- **Nightmare**: 30x30 grid (900 sectors). A high-density matrix for true optimization experts.

### 🤖 Professional Auto-Solver
Get stuck? Use the AI auto-solver:
- **Sequential Visualization**: Watch the computer solve the disk step-by-step.
- **100% Success Strategy**: Uses advanced "Best Fit" and "Blocker Evacuation" logic to ensure every disk can be optimized without loops.
- **Adjustable Speed**: Real-time speed control slider ranging from 0.1s to 1.0s per step.

### 📊 Real-time Statistics
- **Optimization Percentage**: Track your progress with a real-time defrag percentage and progress bar.
- **Move Counter**: Tracks total successful file relocations.
- **Volume Counter**: Tracks the total number of sectors moved.

## 🛠️ Tech Stack
- **Framework**: React 19
- **Language**: TypeScript
- **Drag & Drop**: `@dnd-kit/core`
- **Build Tool**: Vite
- **Styling**: Vanilla CSS (Vibrant Dark Mode)

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone git@github.com:yokeholy/Defrag-It.git
   cd Defrag-It
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Building for Production
```bash
npm run build
```

## 📜 License
MIT
