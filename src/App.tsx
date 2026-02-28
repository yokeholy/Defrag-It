import { useState, useMemo } from 'react';
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import './App.css';

type SectorType = 'empty' | 'used' | 'locked';

interface Sector {
  id: string;
  type: SectorType;
  fileId?: string;
}

const GRID_SIZE = 100;
const LOCKED_RATIO = 0.1;
const USED_RATIO = 0.4;

const generateInitialSectors = (): Sector[] => {
  const sectors: Sector[] = Array(GRID_SIZE).fill(null).map((_, i) => ({
    id: `slot-${i}`,
    type: 'empty'
  }));

  let lockedCount = Math.floor(GRID_SIZE * LOCKED_RATIO);
  while (lockedCount > 0) {
    const idx = Math.floor(Math.random() * GRID_SIZE);
    if (sectors[idx].type === 'empty') {
      sectors[idx].type = 'locked';
      lockedCount--;
    }
  }

  let usedCount = 0;
  const targetUsed = Math.floor(GRID_SIZE * USED_RATIO);
  let fileCounter = 0;

  while (usedCount < targetUsed) {
    const fileSize = Math.floor(Math.random() * 4) + 1;
    const startIdx = Math.floor(Math.random() * (GRID_SIZE - fileSize));
    
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
    if (fileCounter > 100) break;
  }

  return sectors;
};

const SectorSlot = ({ 
  sector, 
  isDefragged, 
  isPotentialDrop,
  isDropValid,
  isFirst,
  isLast,
  isGameWon
}: { 
  sector: Sector; 
  isDefragged: boolean; 
  isPotentialDrop: boolean;
  isDropValid: boolean;
  isFirst: boolean;
  isLast: boolean;
  isGameWon: boolean;
}) => {
  const { setNodeRef: setDraggableRef, attributes, listeners } = useDraggable({
    id: sector.id,
    disabled: sector.type !== 'used' || isGameWon,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: sector.id,
    disabled: sector.type !== 'empty' || isGameWon,
  });

  const typeClass = `sector-${sector.type}`;
  const defraggedClass = (sector.type === 'used' && isDefragged) ? 'defragged' : '';
  
  // Visual state for drop target
  let dropClass = '';
  if (isPotentialDrop) {
    dropClass = isDropValid ? 'drop-target-valid' : 'drop-target-invalid';
  } else if (isOver && !isPotentialDrop) {
    // If we are over a single slot but it's not part of a valid file range
    dropClass = 'drop-target-invalid';
  }

  const connectivityClass = sector.fileId ? `file-member ${isFirst ? 'file-start' : ''} ${isLast ? 'file-end' : ''}` : '';

  return (
    <div
      ref={(node) => {
        setDraggableRef(node);
        setDroppableRef(node);
      }}
      className={`sector ${typeClass} ${defraggedClass} ${dropClass} ${connectivityClass}`}
      {...(sector.type === 'used' && !isGameWon ? { ...attributes, ...listeners } : {})}
    />
  );
};

function App() {
  const [sectors, setSectors] = useState<Sector[]>(() => generateInitialSectors());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0); 
  const [isWon, setIsWon] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeFileData = useMemo(() => {
    if (!activeId) return null;
    const activeIdx = sectors.findIndex(s => s.id === activeId);
    const activeSector = sectors[activeIdx];
    if (!activeSector || !activeSector.fileId) return null;

    const fileSectors = sectors.filter(s => s.fileId === activeSector.fileId);
    
    return {
      fileId: activeSector.fileId,
      size: fileSectors.length,
    };
  }, [activeId, sectors]);

  const landingData = useMemo(() => {
    if (!activeFileData || !overId) return { indices: new Set<number>(), isValid: false };
    
    const targetIdx = sectors.findIndex(s => s.id === overId);
    const startIdx = targetIdx;
    const endIdx = startIdx + activeFileData.size - 1;

    // Out of bounds check
    if (startIdx < 0 || endIdx >= GRID_SIZE) return { indices: new Set<number>(), isValid: false };

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
  }, [activeFileData, overId, sectors]);

  const defraggedIndices = useMemo(() => {
    const indices = new Set<number>();
    let foundEmpty = false;
    
    for (let i = 0; i < sectors.length; i++) {
      if (sectors[i].type === 'empty') {
        foundEmpty = true;
      } else if (sectors[i].type === 'used' && !foundEmpty) {
        indices.add(i);
      }
    }
    return indices;
  }, [sectors]);

  const defragPercentage = useMemo(() => {
    const totalUsed = sectors.filter(s => s.type === 'used').length;
    if (totalUsed === 0) return 100;
    return Math.floor((defraggedIndices.size / totalUsed) * 100);
  }, [sectors, defraggedIndices]);

  const checkWin = (currentSectors: Sector[]) => {
    let foundEmpty = false;
    for (const s of currentSectors) {
      if (s.type === 'empty') foundEmpty = true;
      else if (s.type === 'used' && foundEmpty) return false;
    }
    return true;
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
    const success = over && landingData.isValid;

    setActiveId(null);
    setOverId(null);
    setDragOffset(0);

    if (success) {
      setSectors((prev) => {
        const newSectors = prev.map(s => ({ ...s }));
        const targetIdx = prev.findIndex(s => s.id === over.id);
        const newStartIdx = targetIdx;

        // 1. Clear old positions
        prev.forEach((s, idx) => {
          if (s.fileId === activeFileData!.fileId) {
            newSectors[idx].type = 'empty';
            delete newSectors[idx].fileId;
          }
        });

        // 2. Fill new positions
        for (let i = 0; i < activeFileData!.size; i++) {
          newSectors[newStartIdx + i].type = 'used';
          newSectors[newStartIdx + i].fileId = activeFileData!.fileId;
        }

        if (checkWin(newSectors)) {
          setIsWon(true);
        }
        return newSectors;
      });
    }
  };

  const resetGame = () => {
    setSectors(generateInitialSectors());
    setIsWon(false);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`game-container ${isWon ? 'game-won' : ''}`}>
        <header { ...{ style: { cursor: 'default' } } }>
          <h1>defragIt <small>v1.1</small></h1>
          <p>
            Optimization: <strong>{defragPercentage}%</strong>
          </p>
        </header>
        
        <div className={`status ${isWon ? 'won' : ''}`}>
          {isWon ? 'DISK OPTIMIZED!' : `Defragmenting: ${defragPercentage}%`}
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${defragPercentage}%` }}></div>
          </div>
        </div>

        <div className={`disk-grid ${isWon ? 'locked-grid' : ''}`}>
          {sectors.map((sector, index) => {
            const isFirst = sector.fileId !== undefined && (index === 0 || sectors[index - 1].fileId !== sector.fileId);
            const isLast = sector.fileId !== undefined && (index === sectors.length - 1 || sectors[index + 1].fileId !== sector.fileId);
            
            return (
              <SectorSlot 
                key={sector.id} 
                sector={sector} 
                isDefragged={defraggedIndices.has(index)}
                isPotentialDrop={landingData.indices.has(index)}
                isDropValid={landingData.isValid}
                isFirst={isFirst}
                isLast={isLast}
                isGameWon={isWon}
              />
            );
          })}
        </div>

        <button className="reset-btn" onClick={resetGame}>Reset Disk</button>
        
        <footer>
          <div className="legend">
            <div className="legend-item"><div className="sector sector-used defragged" /> Defragged</div>
            <div className="legend-item"><div className="sector sector-used" /> Fragmented</div>
            <div className="legend-item"><div className="sector sector-locked" /> Locked</div>
            <div className="legend-item"><div className="sector sector-empty" /> Free</div>
          </div>
        </footer>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeFileData && !isWon ? (
          <div 
            style={{ 
              marginLeft: `-${dragOffset * (42 + 6)}px`,
              pointerEvents: 'none'
            }}
          >
            <div className="file-dragging-overlay" style={{ display: 'flex' }}>
              {Array(activeFileData.size).fill(0).map((_, i) => (
                <div 
                  key={i} 
                  className={`sector sector-used ${i === 0 ? 'file-start' : ''} ${i === activeFileData.size - 1 ? 'file-end' : ''}`} 
                  style={{ opacity: 0.8 }} 
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
