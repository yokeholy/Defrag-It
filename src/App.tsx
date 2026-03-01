import { useState, useMemo, memo, useEffect, useRef } from 'react';
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import './App.css';

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

const SectorSlot = memo(({ 
  sector, 
  isDefragged, 
  connectivityClass,
  isGameWon,
  isSolving
}: { 
  sector: Sector; 
  isDefragged: boolean; 
  connectivityClass: string; 
  isGameWon: boolean; 
  isSolving: boolean; 
}) => {
  const { setNodeRef: setDraggableRef, attributes, listeners } = useDraggable({
    id: sector.id,
    disabled: sector.type !== 'used' || isGameWon || isSolving,
  });

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: sector.id,
    disabled: isGameWon,
  });

  const typeClass = `sector-${sector.type}`;
  const defraggedClass = (sector.type === 'used' && isDefragged) ? 'defragged' : '';

  return (
    <div
      ref={(node) => {
        setDraggableRef(node);
        setDroppableRef(node);
      }}
      className={`sector ${typeClass} ${defraggedClass} ${connectivityClass}`}
      {...(sector.type === 'used' && !isGameWon && !isSolving ? { ...attributes, ...listeners } : {})}
    />
  );
});

const DiskGrid = memo(({ 
  sectors, 
  sectorMetadata, 
  defraggedIndices, 
  isWon, 
  isSolving,
  config,
  landingIndices,
  isLandingValid
}: {
  sectors: Sector[];
  sectorMetadata: any[];
  defraggedIndices: Set<number>;
  isWon: boolean;
  isSolving: boolean;
  config: DifficultyConfig;
  landingIndices: Set<number>;
  isLandingValid: boolean;
}) => {
  return (
    <div 
      className={`disk-grid ${isWon ? 'locked-grid' : ''} ${isSolving ? 'solving-grid' : ''}`}
      style={{ 
        gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
        '--cols': config.cols,
        '--max-sector-size': `${config.sectorSize}px`,
        '--actual-grid-gap': `${config.gap}px`,
        '--actual-grid-padding': `${GRID_PADDING}px`
      } as React.CSSProperties}
    >
      {sectors.map((sector, index) => (
        <SectorSlot 
          key={sector.id} 
          sector={sector} 
          isDefragged={defraggedIndices.has(index)}
          connectivityClass={sectorMetadata[index].connectivityClass}
          isGameWon={isWon}
          isSolving={isSolving}
        />
      ))}
      
      {landingIndices.size > 0 && Array.from(landingIndices).map((idx) => {
        const row = Math.floor(idx / config.cols);
        const col = idx % config.cols;
        return (
          <div
            key={`highlight-${idx}`}
            className={`sector-highlight ${isLandingValid ? 'valid' : 'invalid'}`}
            style={{
              position: 'absolute',
              top: `calc(var(--padding) + ${row} * (var(--size) + var(--gap)))`,
              left: `calc(var(--padding) + ${col} * (var(--size) + var(--gap)))`,
              pointerEvents: 'none',
              zIndex: 10
            }}
          />
        );
      })}
    </div>
  );
});

function App() {
  const [mode, setMode] = useState<DifficultyMode>('Easy');
  const config = DIFFICULTY_SETTINGS[mode];
  
  const [sectors, setSectors] = useState<Sector[]>(() => generateInitialSectors(config));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0); 
  const [isWon, setIsWon] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [solveSpeed, setSolveSpeed] = useState(0.5); 

  const [moveCount, setMoveCount] = useState(0);
  const [volumeMoved, setVolumeMoved] = useState(0);

  const solveTimerRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sectorMetadata = useMemo(() => {
    return sectors.map((sector, index) => {
      if (!sector.fileId) return { connectivityClass: '' };
      const isFirst = index === 0 || sectors[index - 1].fileId !== sector.fileId;
      const isLast = index === sectors.length - 1 || sectors[index + 1].fileId !== sector.fileId;
      return {
        connectivityClass: `file-member ${isFirst ? 'file-start' : ''} ${isLast ? 'file-end' : ''}`
      };
    });
  }, [sectors]);

  const activeFileData = useMemo(() => {
    if (!activeId) return null;
    const activeIdx = sectors.findIndex(s => s.id === activeId);
    const activeSector = sectors[activeIdx];
    if (!activeSector || !activeSector.fileId) return null;
    const fileSectors = sectors.filter(s => s.fileId === activeSector.fileId);
    return { fileId: activeSector.fileId, size: fileSectors.length, currentStartIdx: sectors.indexOf(fileSectors[0]) };
  }, [activeId, sectors]);

  const landingData = useMemo(() => {
    if (!activeFileData || !overId) return { indices: new Set<number>(), isValid: false };
    const targetIdx = sectors.findIndex(s => s.id === overId);
    const startIdx = targetIdx;
    const endIdx = startIdx + activeFileData.size - 1;
    if (startIdx < 0 || endIdx >= config.size) return { indices: new Set<number>(), isValid: false };
    
    const indices = new Set<number>();
    let isValid = true;
    for (let i = startIdx; i <= endIdx; i++) {
      indices.add(i);
      const s = sectors[i];
      if (s.type !== 'empty') isValid = false;
    }
    return { indices, isValid };
  }, [activeFileData, overId, sectors, config.size]);

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
    if (totalUsed === 0) return 100;
    return Math.floor((defraggedIndices.size / totalUsed) * 100);
  }, [sectors, defraggedIndices]);

  const checkWinCondition = (currentSectors: Sector[]) => {
    let foundEmpty = false;
    for (const s of currentSectors) {
      if (s.type === 'empty') foundEmpty = true;
      else if (s.type === 'used' && foundEmpty) return false;
    }
    return true;
  };

  const executeMove = (fileId: string, targetStartIdx: number) => {
    const fileSectors = sectors.filter(s => s.fileId === fileId);
    if (fileSectors.length === 0) return;
    const currentIdx = sectors.indexOf(fileSectors[0]);
    if (currentIdx === targetStartIdx) return;
    const size = fileSectors.length;

    setSectors((prev) => {
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
      if (checkWinCondition(newSectors)) setIsWon(true);
      return newSectors;
    });

    setMoveCount(m => m + 1);
    setVolumeMoved(v => v + size);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    const activeIdx = sectors.findIndex(s => s.id === id);
    const activeSector = sectors[activeIdx];
    const firstIdx = sectors.findIndex(s => s.fileId === activeSector.fileId);
    setDragOffset(activeIdx - firstIdx);
  };

  const handleDragOver = (event: any) => {
    setOverId(event.over?.id || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;
    const currentLanding = landingData;
    const movingFile = activeFileData;
    if (over && currentLanding.isValid && movingFile) {
      const targetStartIdx = sectors.findIndex(s => s.id === over.id);
      executeMove(movingFile.fileId, targetStartIdx);
    }
    setActiveId(null);
    setOverId(null);
    setDragOffset(0);
  };

  const startAutoSolve = () => {
    if (isWon) return;
    setIsSolving(true);
  };

  useEffect(() => {
    if (!isSolving || isWon) {
      if (solveTimerRef.current) clearTimeout(solveTimerRef.current);
      if (isWon) setIsSolving(false);
      return;
    }
    const findNextMove = () => {
      const firstEmptyIdx = sectors.findIndex(s => s.type === 'empty');
      if (firstEmptyIdx === -1) return null;
      let gapSize = 0;
      for (let i = firstEmptyIdx; i < sectors.length; i++) {
        if (sectors[i].type === 'empty') gapSize++; else break;
      }
      const allFiles: { fileId: string; size: number; start: number }[] = [];
      const seenFiles = new Set<string>();
      sectors.forEach((s, index) => {
        if (s.type === 'used' && s.fileId && !seenFiles.has(s.fileId)) {
          seenFiles.add(s.fileId);
          const fileSectors = sectors.filter(item => item.fileId === s.fileId);
          allFiles.push({ fileId: s.fileId, size: fileSectors.length, start: index });
        }
      });
      const canFit = (size: number, targetIdx: number) => {
        for (let j = 0; j < size; j++) {
          if (targetIdx + j >= sectors.length || sectors[targetIdx + j].type !== 'empty') return false;
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
        for (let i = sectors.length - blocker.size; i > blocker.start; i--) {
          if (canFit(blocker.size, i)) return { fileId: blocker.fileId, targetIdx: i };
        }
      }
      const reversed = [...allFiles].reverse();
      for (const file of reversed) {
        for (let i = sectors.length - file.size; i >= 0; i--) {
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
  }, [isSolving, sectors, isWon, solveSpeed, defraggedIndices]);

  const switchDifficulty = (newMode: DifficultyMode) => {
    const newConfig = DIFFICULTY_SETTINGS[newMode];
    setMode(newMode);
    setSectors(generateInitialSectors(newConfig));
    setIsWon(false);
    setIsSolving(false);
    setMoveCount(0);
    setVolumeMoved(0);
    setShowModal(false);
  };

  const resetAndShuffle = () => {
    setSectors(generateInitialSectors(config));
    setIsWon(false);
    setIsSolving(false);
    setMoveCount(0);
    setVolumeMoved(0);
    setShowModal(false);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`game-container ${isWon ? 'game-won' : ''} ${activeId ? 'is-dragging' : ''} ${isSolving ? 'is-solving' : ''}`}>
        <header><h1>defragIt <small>v1.3</small></h1></header>
        <div className="stats-bar">
          <div className="stat-item"><span className="stat-label">Moves</span><span className="stat-value">{moveCount}</span></div>
          <div className="stat-item"><span className="stat-label">Volume</span><span className="stat-value">{volumeMoved}</span></div>
        </div>
        <div className={`status ${isWon ? 'won' : ''}`}>
          {isWon ? 'DISK OPTIMIZED!' : isSolving ? 'AUTO-SOLVING...' : `Optimization: ${defragPercentage}%`}
          <div className="progress-bar-container"><div className="progress-bar" style={{ width: `${defragPercentage}%` }}></div></div>
        </div>
        
        <DiskGrid 
          sectors={sectors} 
          sectorMetadata={sectorMetadata} 
          defraggedIndices={defraggedIndices} 
          isWon={isWon} 
          isSolving={isSolving} 
          config={config} 
          landingIndices={landingData.indices} 
          isLandingValid={landingData.isValid} 
        />

        <div className="main-actions">
          <button className="reset-btn" onClick={() => setShowModal(true)}>New Disk</button>
          {!isWon && (
            <div className="solve-group">
              <button className={`solve-btn ${isSolving ? 'active' : ''}`} onClick={isSolving ? () => setIsSolving(false) : startAutoSolve}>
                {isSolving ? 'Stop' : 'Auto-Solve'}
              </button>
              <div className="speed-control">
                <span className="speed-label">{solveSpeed}s</span>
                <input type="range" min="0.1" max="1.0" step="0.1" value={solveSpeed} onChange={(e) => setSolveSpeed(parseFloat(e.target.value))} />
              </div>
            </div>
          )}
        </div>
        <footer>
          <div className="legend">
            <div className="legend-item"><div className="sector sector-used defragged" style={{ width: 14, height: 14 }} /> Defragged</div>
            <div className="legend-item"><div className="sector sector-used" style={{ width: 14, height: 14 }} /> Fragmented</div>
            <div className="legend-item"><div className="sector sector-locked" style={{ width: 14, height: 14 }} /> Locked</div>
          </div>
        </footer>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Select Difficulty</h2>
            <div className="modal-actions">{(['Easy', 'Hard', 'Nightmare'] as DifficultyMode[]).map((m) => (<button key={m} className={`mode-btn ${mode === m ? 'active' : ''}`} onClick={() => switchDifficulty(m)}>{m}</button>))}</div>
            <button className="close-modal" onClick={resetAndShuffle}>Just Restart Level</button>
            <button className="close-modal" onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}

      <DragOverlay dropAnimation={null}>
        {activeId && !isWon && activeFileData ? (
          <div style={{ marginLeft: `calc(-1 * ${dragOffset} * (var(--size) + var(--gap)))`, pointerEvents: 'none' }}>
            <div className="file-dragging-overlay" style={{ display: 'flex', flexWrap: 'wrap', gap: `var(--gap)`, width: `calc(${activeFileData.size} * (var(--size) + var(--gap)))` }}>
              {Array(activeFileData.size).fill(0).map((_, i) => (<div key={i} className={`sector sector-used ${i === 0 ? 'file-start' : ''} ${i === activeFileData.size - 1 ? 'file-end' : ''}`} style={{ opacity: 0.8, width: `var(--size)`, height: `var(--size)` }} />))}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
