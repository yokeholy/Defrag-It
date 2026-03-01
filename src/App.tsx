import React, { useState, useMemo, memo } from 'react';
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
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
}

const DIFFICULTY_SETTINGS: Record<DifficultyMode, DifficultyConfig> = {
  Easy: { size: 100, cols: 10, lockedRatio: 0.1, usedRatio: 0.4, sectorSize: 42 },
  Hard: { size: 400, cols: 20, lockedRatio: 0.15, usedRatio: 0.5, sectorSize: 24 },
  Nightmare: { size: 900, cols: 30, lockedRatio: 0.2, usedRatio: 0.6, sectorSize: 18 },
};

const GRID_GAP = 4;
const GRID_PADDING = 8;

const generateInitialSectors = (config: DifficultyConfig): Sector[] => {
  const sectors: Sector[] = Array(config.size).fill(null).map((_, i) => ({
    id: `slot-${i}`,
    type: 'empty'
  }));

  let lockedCount = Math.floor(config.size * config.lockedRatio);
  while (lockedCount > 0) {
    const idx = Math.floor(Math.random() * config.size);
    if (sectors[idx].type === 'empty') {
      sectors[idx].type = 'locked';
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
  size
}: { 
  sector: Sector; 
  isDefragged: boolean; 
  connectivityClass: string;
  isGameWon: boolean;
  size: number;
}) => {
  const { setNodeRef: setDraggableRef, attributes, listeners } = useDraggable({
    id: sector.id,
    disabled: sector.type !== 'used' || isGameWon,
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
      style={{ width: `${size}px`, height: `${size}px` }}
      {...(sector.type === 'used' && !isGameWon ? { ...attributes, ...listeners } : {})}
    />
  );
});

const DiskGrid = memo(({ 
  sectors, 
  sectorMetadata, 
  defraggedIndices, 
  isWon, 
  config,
  landingIndices,
  isLandingValid
}: {
  sectors: Sector[];
  sectorMetadata: any[];
  defraggedIndices: Set<number>;
  isWon: boolean;
  config: DifficultyConfig;
  landingIndices: Set<number>;
  isLandingValid: boolean;
}) => {
  return (
    <div 
      className={`disk-grid ${isWon ? 'locked-grid' : ''}`}
      style={{ 
        gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
        position: 'relative',
        padding: `${GRID_PADDING}px`,
        gap: `${GRID_GAP}px`
      }}
    >
      {sectors.map((sector, index) => (
        <SectorSlot 
          key={sector.id} 
          sector={sector} 
          isDefragged={defraggedIndices.has(index)}
          connectivityClass={sectorMetadata[index].connectivityClass}
          isGameWon={isWon}
          size={config.sectorSize}
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
              width: `${config.sectorSize}px`,
              height: `${config.sectorSize}px`,
              top: `${GRID_PADDING + row * (config.sectorSize + GRID_GAP)}px`,
              left: `${GRID_PADDING + col * (config.sectorSize + GRID_GAP)}px`,
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

  const [moveCount, setMoveCount] = useState(0);
  const [volumeMoved, setVolumeMoved] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
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
    return { fileId: activeSector.fileId, size: fileSectors.length };
  }, [activeId, sectors]);

  const landingData = useMemo(() => {
    if (!activeFileData || !overId) return { indices: new Set<number>(), isValid: false };
    
    const targetIdx = sectors.findIndex(s => s.id === overId);
    const startIdx = targetIdx;
    const endIdx = startIdx + activeFileData.size - 1;

    // Boundary check
    if (startIdx < 0 || endIdx >= config.size) return { indices: new Set<number>(), isValid: false };

    const indices = new Set<number>();
    let isValid = true;

    for (let i = startIdx; i <= endIdx; i++) {
      indices.add(i);
      const s = sectors[i];
      if (s.type !== 'empty' && s.fileId !== activeFileData.fileId) {
        isValid = false;
      }
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
      const originalStartIdx = sectors.findIndex(s => s.fileId === movingFile.fileId);
      const targetStartIdx = sectors.findIndex(s => s.id === over.id);

      if (originalStartIdx !== targetStartIdx) {
        setMoveCount(prev => prev + 1);
        setVolumeMoved(prev => prev + movingFile.size);

        setSectors((prev) => {
          const newSectors = prev.map(s => ({ ...s }));
          prev.forEach((s, idx) => {
            if (s.fileId === movingFile.fileId) {
              newSectors[idx].type = 'empty';
              delete newSectors[idx].fileId;
            }
          });
          for (let i = 0; i < movingFile.size; i++) {
            newSectors[targetStartIdx + i].type = 'used';
            newSectors[targetStartIdx + i].fileId = movingFile.fileId;
          }
          const isGameWon = (() => {
            let foundEmpty = false;
            for (const s of newSectors) {
              if (s.type === 'empty') foundEmpty = true;
              else if (s.type === 'used' && foundEmpty) return false;
            }
            return true;
          })();
          if (isGameWon) setIsWon(true);
          return newSectors;
        });
      }
    }

    setActiveId(null);
    setOverId(null);
    setDragOffset(0);
  };

  const switchDifficulty = (newMode: DifficultyMode) => {
    const newConfig = DIFFICULTY_SETTINGS[newMode];
    setMode(newMode);
    setSectors(generateInitialSectors(newConfig));
    setIsWon(false);
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
      <div className={`game-container ${isWon ? 'game-won' : ''} ${activeId ? 'is-dragging' : ''}`}>
        <header>
          <h1>defragIt <small>v1.2</small></h1>
        </header>

        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Moves</span>
            <span className="stat-value">{moveCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Volume</span>
            <span className="stat-value">{volumeMoved}</span>
          </div>
        </div>
        
        <div className={`status ${isWon ? 'won' : ''}`}>
          {isWon ? 'DISK OPTIMIZED!' : `Optimization: ${defragPercentage}%`}
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${defragPercentage}%` }}></div>
          </div>
        </div>

        <DiskGrid 
          sectors={sectors} 
          sectorMetadata={sectorMetadata} 
          defraggedIndices={defraggedIndices} 
          isWon={isWon} 
          config={config} 
          landingIndices={landingData.indices}
          isLandingValid={landingData.isValid}
        />

        <button className="reset-btn" onClick={() => setShowModal(true)}>Reset & Select Level</button>
        
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
            <p>Resetting the disk will clear all current progress.</p>
            <div className="modal-actions">
              {(['Easy', 'Hard', 'Nightmare'] as DifficultyMode[]).map((m) => (
                <button 
                  key={m} 
                  className={`mode-btn ${mode === m ? 'active' : ''}`}
                  onClick={() => switchDifficulty(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <button className="close-modal" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      <DragOverlay dropAnimation={null}>
        {activeFileData && !isWon ? (
          <div style={{ marginLeft: `-${dragOffset * (config.sectorSize + GRID_GAP)}px`, pointerEvents: 'none' }}>
            <div className="file-dragging-overlay" style={{ display: 'flex', flexWrap: 'wrap', gap: `${GRID_GAP}px`, width: `${activeFileData.size * (config.sectorSize + GRID_GAP)}px` }}>
              {Array(activeFileData.size).fill(0).map((_, i) => (
                <div 
                  key={i} 
                  className={`sector sector-used ${i === 0 ? 'file-start' : ''} ${i === activeFileData.size - 1 ? 'file-end' : ''}`} 
                  style={{ opacity: 0.8, width: `${config.sectorSize}px`, height: `${config.sectorSize}px` }} 
                />
              ))}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
