import { useState, useMemo, memo, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { sounds } from './sounds';

type SectorType = 'empty' | 'used' | 'locked';
type DifficultyMode = 'Easy' | 'Hard' | 'Nightmare';

interface Sector {
  id: string;
  type: SectorType;
  fileId?: string;
}

interface DifficultyConfig {
  size: number;
  cols: number;
  lockedRatio: number;
  usedRatio: number;
  sectorSize: number;
  gap: number;
}

const DIFFICULTY_SETTINGS: Record<DifficultyMode, DifficultyConfig> = {
  Easy: { size: 100, cols: 10, lockedRatio: 0.1, usedRatio: 0.4, sectorSize: 42, gap: 4 },
  Hard: { size: 400, cols: 20, lockedRatio: 0.15, usedRatio: 0.5, sectorSize: 22, gap: 3 },
  Nightmare: { size: 900, cols: 30, lockedRatio: 0.2, usedRatio: 0.6, sectorSize: 15, gap: 2 },
};

const GRID_PADDING = 8;

const generateInitialSectors = (config: DifficultyConfig): Sector[] => {
  const sectors: Sector[] = Array(config.size).fill(null).map((_, i) => ({
    id: `slot-${i}`,
    type: 'empty'
  }));

  let lockedCount = Math.floor(config.size * config.lockedRatio);
  while (lockedCount > 0) {
    const safeIdx = Math.floor(Math.random() * config.size);
    if (sectors[safeIdx].type === 'empty') {
      sectors[safeIdx].type = 'locked';
      lockedCount--;
    }
  }

  let usedCount = 0;
  const targetUsed = Math.floor(config.size * config.usedRatio);
  let fileCounter = 0;

  while (usedCount < targetUsed) {
    const fileSize = Math.floor(Math.random() * 4) + 1;
    const startIdx = Math.floor(Math.random() * (config.size - fileSize));
    let canPlace = true;
    for (let i = 0; i < fileSize; i++) {
      if (sectors[startIdx + i].type !== 'empty') {
        canPlace = false;
        break;
      }
    }
    if (canPlace) {
      const fileId = `file-${fileCounter++}`;
      for (let i = 0; i < fileSize; i++) {
        sectors[startIdx + i].type = 'used';
        sectors[startIdx + i].fileId = fileId;
      }
      usedCount += fileSize;
    }
    if (fileCounter > config.size) break;
  }
  return sectors;
};

const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
};

const DiskCanvas = memo(({ 
  sectors, 
  config, 
  defraggedIndices 
}: { 
  sectors: Sector[]; 
  config: DifficultyConfig; 
  defraggedIndices: Set<number>;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const visualStates = useRef<{ [key: number]: { factor: number } }>({});
  const lastTimeRef = useRef<number>(performance.now());

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const now = performance.now();
    const dt = now - lastTimeRef.current;
    lastTimeRef.current = now;

    const dpr = window.devicePixelRatio || 1;
    const rootStyle = getComputedStyle(document.documentElement);
    const size = parseFloat(rootStyle.getPropertyValue('--actual-sector-size')) || config.sectorSize;
    const gap = parseFloat(rootStyle.getPropertyValue('--actual-grid-gap')) || config.gap;
    const padding = GRID_PADDING;
    const radius = size * 0.15;

    const width = config.cols * size + (config.cols - 1) * gap + padding * 2;
    const height = Math.ceil(config.size / config.cols) * size + (Math.ceil(config.size / config.cols) - 1) * gap + padding * 2;

    if (canvas.width !== width * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    }

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const blue = hexToRgb('#2563eb');
    const green = hexToRgb('#10b981');

    let needsMoreFrames = false;

    sectors.forEach((s, i) => {
      const row = Math.floor(i / config.cols);
      const col = i % config.cols;
      const x = padding + col * (size + gap);
      const y = padding + row * (size + gap);

      if (!visualStates.current[i]) visualStates.current[i] = { factor: defraggedIndices.has(i) ? 1 : 0 };
      const vs = visualStates.current[i];
      const target = defraggedIndices.has(i) ? 1 : 0;
      
      if (Math.abs(vs.factor - target) > 0.01) {
        const speed = 0.005 * dt;
        if (vs.factor < target) vs.factor = Math.min(target, vs.factor + speed);
        else vs.factor = Math.max(target, vs.factor - speed);
        needsMoreFrames = true;
      } else { vs.factor = target; }

      let fill = '#0f172a';
      let border = 'rgba(255, 255, 255, 0.02)';
      
      if (s.type === 'locked') {
        fill = '#7f1d1d';
        border = '#b91c1c';
      } else if (s.type === 'used') {
        const r = Math.round(blue.r + (green.r - blue.r) * vs.factor);
        const g = Math.round(blue.g + (green.g - blue.g) * vs.factor);
        const b = Math.round(blue.b + (green.b - blue.b) * vs.factor);
        fill = `rgb(${r},${g},${b})`;
        border = 'rgba(255, 255, 255, 0.1)';
      }

      ctx.fillStyle = fill;
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, radius);
      ctx.fill();
      ctx.stroke();

      if (s.type === 'locked') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(x + size * 0.3, y + size * 0.3);
        ctx.lineTo(x + size * 0.7, y + size * 0.7);
        ctx.moveTo(x + size * 0.7, y + size * 0.3);
        ctx.lineTo(x + size * 0.3, y + size * 0.7);
        ctx.stroke();
      }

      if (s.fileId && i < sectors.length - 1 && sectors[i + 1].fileId === s.fileId && col < config.cols - 1) {
        ctx.fillStyle = fill;
        ctx.fillRect(x + size - 1, y + size * 0.3, gap + 2, size * 0.4);
      }
    });

    if (needsMoreFrames) animRef.current = requestAnimationFrame(draw);
    else animRef.current = null;
  }, [sectors, config, defraggedIndices]);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  return <canvas ref={canvasRef} className="disk-canvas" />;
});

function App() {
  const [mode, setMode] = useState<DifficultyMode>('Easy');
  const config = DIFFICULTY_SETTINGS[mode];
  
  // LOGIC SOURCE OF TRUTH (Accurate Counters)
  const sectorsRef = useRef<Sector[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  
  const [isWon, setIsWon] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [solveSpeed, setSolveSpeed] = useState(0.5); 
  const [isMuted, setIsMuted] = useState(false);

  const [activeFileData, setActiveFileData] = useState<{ fileId: string; size: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragInfo = useRef({ currentOverIndex: -1 });
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const solveTimerRef = useRef<number | null>(null);

  const [moveCount, setMoveCount] = useState(0);
  const [volumeMoved, setVolumeMoved] = useState(0);

  useEffect(() => { sounds.toggle(!isMuted); }, [isMuted]);
  useEffect(() => { if (isWon) sounds.playWin(); }, [isWon]);

  const defraggedIndices = useMemo(() => {
    const indices = new Set<number>();
    let foundEmpty = false;
    for (let i = 0; i < sectors.length; i++) {
      if (sectors[i].type === 'empty') foundEmpty = true;
      else if (sectors[i].type === 'used' && !foundEmpty) indices.add(i);
    }
    return indices;
  }, [sectors]);

  const defragPercentage = useMemo(() => {
    const totalUsed = sectors.filter(s => s.type === 'used').length;
    return totalUsed === 0 ? 100 : Math.floor((defraggedIndices.size / totalUsed) * 100);
  }, [sectors, defraggedIndices]);

  const initGame = useCallback((newConfig: DifficultyConfig) => {
    const initial = generateInitialSectors(newConfig);
    sectorsRef.current = initial;
    setSectors(initial);
    setIsWon(false);
    setIsSolving(false);
    setMoveCount(0);
    setVolumeMoved(0);
    setShowModal(false);
  }, []);

  useEffect(() => { initGame(config); }, [config, initGame]);

  const executeMove = useCallback((fileId: string, targetStartIdx: number) => {
    const prev = sectorsRef.current;
    const fileSectors = prev.filter(s => s.fileId === fileId);
    if (fileSectors.length === 0) return;
    const currentIdx = prev.indexOf(fileSectors[0]);
    if (currentIdx === targetStartIdx) return;
    const size = fileSectors.length;

    // Logic Update (Single source of truth)
    const newSectors = prev.map(s => ({ ...s }));
    prev.forEach((s, idx) => {
      if (s.fileId === fileId) {
        newSectors[idx].type = 'empty';
        delete newSectors[idx].fileId;
      }
    });
    for (let i = 0; i < size; i++) {
      newSectors[targetStartIdx + i].type = 'used';
      newSectors[targetStartIdx + i].fileId = fileId;
    }
    
    // Check Win
    let foundEmpty = false;
    let won = true;
    for (const s of newSectors) {
      if (s.type === 'empty') foundEmpty = true;
      else if (s.type === 'used' && foundEmpty) { won = false; break; }
    }

    // Single-shot state updates
    sectorsRef.current = newSectors;
    setSectors(newSectors);
    setMoveCount(m => m + 1);
    setVolumeMoved(v => v + size);
    if (won) setIsWon(true);
    sounds.playDrop();
  }, []);

  const getIndexFromPointer = (clientX: number, clientY: number) => {
    if (!gridRef.current) return -1;
    const rect = gridRef.current.getBoundingClientRect();
    const rootStyle = getComputedStyle(document.documentElement);
    const size = parseFloat(rootStyle.getPropertyValue('--actual-sector-size')) || config.sectorSize;
    const gap = parseFloat(rootStyle.getPropertyValue('--actual-grid-gap')) || config.gap;
    const padding = GRID_PADDING;

    const x = clientX - rect.left - padding;
    const y = clientY - rect.top - padding;

    const col = Math.floor(x / (size + gap));
    const row = Math.floor(y / (size + gap));
    
    if (col < 0 || col >= config.cols || x % (size + gap) > size || y % (size + gap) > size) return -1;
    const index = row * config.cols + col;
    if (index < 0 || index >= sectorsRef.current.length) return -1;
    return index;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isWon || isSolving) return;
    const index = getIndexFromPointer(e.clientX, e.clientY);
    if (index === -1) return;

    const sector = sectorsRef.current[index];
    if (sector.type !== 'used') return;

    const fileSectors = sectorsRef.current.filter(s => s.fileId === sector.fileId);
    const firstIdx = sectorsRef.current.indexOf(fileSectors[0]);

    setActiveFileData({ fileId: sector.fileId!, size: fileSectors.length });
    setDragOffset(index - firstIdx);
    setIsDragging(true);
    sounds.playPickup();

    if (overlayRef.current) {
      overlayRef.current.style.display = 'flex';
      overlayRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || !activeFileData) return;
      if (overlayRef.current) overlayRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;

      const overIndex = getIndexFromPointer(e.clientX, e.clientY);
      if (overIndex === dragInfo.current.currentOverIndex) return;
      dragInfo.current.currentOverIndex = overIndex;

      if (!highlightRef.current) return;
      if (overIndex === -1) { highlightRef.current.style.display = 'none'; return; }

      const targetStartIdx = overIndex - dragOffset;
      const endIdx = targetStartIdx + activeFileData.size - 1;
      
      let isValid = true;
      if (targetStartIdx < 0 || endIdx >= config.size) {
        isValid = false;
      } else {
        for (let i = targetStartIdx; i <= endIdx; i++) {
          if (sectorsRef.current[i].type !== 'empty') { isValid = false; break; }
        }
      }

      const hRow = Math.floor(targetStartIdx / config.cols);
      const hCol = targetStartIdx % config.cols;
      highlightRef.current.style.display = 'block';
      highlightRef.current.style.width = `calc(${activeFileData.size} * var(--actual-sector-size) + (${activeFileData.size - 1} * var(--actual-grid-gap)))`;
      highlightRef.current.className = `landing-highlight ${isValid ? 'valid' : 'invalid'}`;
      highlightRef.current.style.transform = `translate(
        calc(var(--actual-grid-padding) + ${hCol} * (var(--actual-sector-size) + var(--actual-grid-gap))),
        calc(var(--actual-grid-padding) + ${hRow} * (var(--actual-sector-size) + var(--actual-grid-gap)))
      )`;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging || !activeFileData) return;
      const overIndex = getIndexFromPointer(e.clientX, e.clientY);
      const targetIdx = overIndex === -1 ? -1 : overIndex - dragOffset;
      
      let isValid = false;
      if (targetIdx !== -1) {
        const endIdx = targetIdx + activeFileData.size - 1;
        if (targetIdx >= 0 && endIdx < config.size) {
          isValid = true;
          for (let i = targetIdx; i <= endIdx; i++) {
            if (sectorsRef.current[i].type !== 'empty') { isValid = false; break; }
          }
        }
      }
      if (isValid) executeMove(activeFileData.fileId, targetIdx);
      else if (overIndex !== -1) sounds.playError();

      setIsDragging(false);
      setActiveFileData(null);
      dragInfo.current.currentOverIndex = -1;
      if (overlayRef.current) overlayRef.current.style.display = 'none';
      if (highlightRef.current) highlightRef.current.style.display = 'none';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, activeFileData, dragOffset, config, executeMove]);

  const startAutoSolve = () => { if (!isWon) setIsSolving(true); sounds.playClick(); };

  useEffect(() => {
    if (!isSolving || isWon) {
      if (solveTimerRef.current) clearTimeout(solveTimerRef.current);
      if (isWon) setIsSolving(false);
      return;
    }
    const findNextMove = () => {
      const currentSectors = sectorsRef.current;
      const firstEmptyIdx = currentSectors.findIndex(s => s.type === 'empty');
      if (firstEmptyIdx === -1) return null;
      let gapSize = 0;
      for (let i = firstEmptyIdx; i < currentSectors.length; i++) {
        if (currentSectors[i].type === 'empty') gapSize++; else break;
      }
      const allFiles: { fileId: string; size: number; start: number }[] = [];
      const seenFiles = new Set<string>();
      currentSectors.forEach((s, index) => {
        if (s.type === 'used' && s.fileId && !seenFiles.has(s.fileId)) {
          seenFiles.add(s.fileId);
          const fileSectors = currentSectors.filter(item => item.fileId === s.fileId);
          allFiles.push({ fileId: s.fileId, size: fileSectors.length, start: index });
        }
      });
      const canFit = (size: number, targetIdx: number) => {
        for (let j = 0; j < size; j++) {
          if (targetIdx + j >= currentSectors.length || currentSectors[targetIdx + j].type !== 'empty') return false;
        }
        return true;
      };
      let bestFit = null;
      for (const file of allFiles) {
        if (file.start > firstEmptyIdx && file.size <= gapSize) {
          if (!bestFit || file.size > bestFit.size) bestFit = file;
        }
      }
      if (bestFit) return { fileId: bestFit.fileId, targetIdx: firstEmptyIdx };
      const blockerIdx = firstEmptyIdx + gapSize;
      const blocker = allFiles.find(f => f.start === blockerIdx);
      if (blocker) {
        for (let i = currentSectors.length - blocker.size; i > blocker.start; i--) {
          if (canFit(blocker.size, i)) return { fileId: blocker.fileId, targetIdx: i };
        }
      }
      const reversed = [...allFiles].reverse();
      for (const file of reversed) {
        for (let i = currentSectors.length - file.size; i >= 0; i--) {
          if (i !== file.start && canFit(file.size, i)) return { fileId: file.fileId, targetIdx: i };
        }
      }
      return null;
    };
    const nextMove = findNextMove();
    if (nextMove) {
      solveTimerRef.current = window.setTimeout(() => { executeMove(nextMove.fileId, nextMove.targetIdx); }, solveSpeed * 1000);
    } else {
      setIsSolving(false);
    }
    return () => { if (solveTimerRef.current) clearTimeout(solveTimerRef.current); };
  }, [isSolving, isWon, solveSpeed, executeMove, sectors]);

  const switchDifficulty = (newMode: DifficultyMode) => {
    setMode(newMode);
    sounds.playClick();
  };

  return (
    <div 
      className={`game-container ${isWon ? 'game-won' : ''} ${isDragging ? 'is-dragging' : ''} ${isSolving ? 'is-solving' : ''}`}
      style={{
        '--cols': config.cols,
        '--max-sector-size': `${config.sectorSize}px`,
        '--actual-grid-gap': `${config.gap}px`,
        '--actual-grid-padding': `${GRID_PADDING}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      } as React.CSSProperties}
    >
      <header>
        <div className="header-top">
          <h1 className="game-title">defragIt <small>v1.3</small></h1>
        </div>
      </header>
      <div className="stats-bar">
        <div className="stat-item"><span className="stat-label">Moves</span><span className="stat-value">{moveCount}</span></div>
        <div className="stat-item"><span className="stat-label">Volume</span><span className="stat-value">{volumeMoved}</span></div>
      </div>
      <div className={`status ${isWon ? 'won' : ''}`}>
        {isWon ? 'DISK OPTIMIZED!' : isSolving ? 'AUTO-SOLVING...' : `Optimization: ${defragPercentage}%`}
        <div className="progress-bar-container"><div className="progress-bar" style={{ width: `${defragPercentage}%` }}></div></div>
      </div>
      
      <div className="grid-wrapper" ref={gridRef} onPointerDown={handlePointerDown}>
        <DiskCanvas sectors={sectors} config={config} defraggedIndices={defraggedIndices} />
        <div ref={highlightRef} className="landing-highlight" style={{ display: 'none' }} />
      </div>

      <div className="main-actions-row">
        <button className="action-btn secondary" onClick={() => { setShowModal(true); sounds.playClick(); }}>New Disk</button>
        {!isWon && (
          <div className="solve-controls">
            <button className={`action-btn primary ${isSolving ? 'active' : ''}`} onClick={isSolving ? () => { setIsSolving(false); sounds.playClick(); } : startAutoSolve}>{isSolving ? 'Stop' : 'Auto-Solve'}</button>
            <div className="speed-group">
              <span className="speed-tag">{solveSpeed}s</span>
              <input type="range" min="0.1" max="1.0" step="0.1" value={solveSpeed} onChange={(e) => setSolveSpeed(parseFloat(e.target.value))} />
            </div>
          </div>
        )}
      </div>

      <footer>
        <div className="legend">
          <div className="legend-item"><div className="sector-swatch defragged" /> Defragged</div>
          <div className="legend-item"><div className="sector-swatch fragmented" /> Fragmented</div>
          <div className="legend-item"><div className="sector-swatch locked" /> Locked</div>
        </div>
        <button className="mute-btn-footer" onClick={() => setIsMuted(!isMuted)}>{isMuted ? '🔇' : '🔊'}</button>
      </footer>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Select Difficulty</h2>
            <div className="modal-actions">{(['Easy', 'Hard', 'Nightmare'] as DifficultyMode[]).map((m) => (<button key={m} className={`mode-btn ${mode === m ? 'active' : ''}`} onClick={() => switchDifficulty(m)}>{m}</button>))}</div>
            <button className="close-modal" onClick={() => initGame(config)}>Just Restart Level</button>
            <button className="close-modal" onClick={() => { setShowModal(false); sounds.playClick(); }}>Close</button>
          </div>
        </div>
      )}

      <div ref={overlayRef} className="custom-drag-overlay" style={{ display: 'none', cursor: 'grabbing' }}>
        {activeFileData && (
          <div style={{ marginLeft: `calc(-1 * ${dragOffset} * (var(--actual-sector-size) + var(--actual-grid-gap)))` }}>
            <div className="file-dragging-overlay" style={{ display: 'flex', gap: `var(--actual-grid-gap)`, width: `calc(${activeFileData.size} * var(--actual-sector-size) + (${activeFileData.size - 1} * var(--actual-grid-gap)))` }}>
              {Array(activeFileData.size).fill(0).map((_, i) => (<div key={i} className={`sector sector-used ${i === 0 ? 'file-start' : ''} ${i === activeFileData.size - 1 ? 'file-end' : ''}`} style={{ width: `var(--actual-sector-size)`, height: `var(--actual-sector-size)`, borderRadius: `calc(var(--actual-sector-size) * 0.15)` }} />))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
