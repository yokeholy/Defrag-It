import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
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
}

const GRID_SIZE = 100;
const LOCKED_RATIO = 0.1;
const USED_RATIO = 0.4;

const generateInitialSectors = (): Sector[] => {
  const sectors: Sector[] = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    const rand = Math.random();
    let type: SectorType = 'empty';
    if (rand < LOCKED_RATIO) type = 'locked';
    else if (rand < LOCKED_RATIO + USED_RATIO) type = 'used';
    sectors.push({ id: `sector-${i}`, type });
  }
  return sectors.sort(() => Math.random() - 0.5);
};

const SectorSlot = ({ sector, isDefragged, isDragging }: { sector: Sector; isDefragged: boolean; isDragging: boolean }) => {
  const { setNodeRef: setDraggableRef, attributes, listeners } = useDraggable({
    id: sector.id,
    disabled: sector.type !== 'used',
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: sector.id,
    disabled: sector.type !== 'empty',
  });

  const typeClass = `sector-${sector.type}`;
  const defraggedClass = isDefragged ? 'defragged' : '';
  const draggingClass = isDragging ? 'is-dragging-source' : '';
  const overClass = isOver ? 'drop-target' : '';

  return (
    <div
      ref={(node) => {
        setDraggableRef(node);
        setDroppableRef(node);
      }}
      className={`sector ${typeClass} ${defraggedClass} ${draggingClass} ${overClass}`}
      {...(sector.type === 'used' ? { ...attributes, ...listeners } : {})}
    />
  );
};

function App() {
  const [sectors, setSectors] = useState<Sector[]>(() => generateInitialSectors());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isWon, setIsWon] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const defraggedIndices = useMemo(() => {
    const indices = new Set<number>();
    let lastUsedIndex = -1;
    
    // Find how many used blocks should be at the front
    const totalUsed = sectors.filter(s => s.type === 'used').length;
    let foundUsed = 0;
    
    for (let i = 0; i < sectors.length; i++) {
      if (sectors[i].type === 'used') {
        foundUsed++;
        if (foundUsed <= totalUsed) {
          // If this is one of the "first" used blocks and is contiguous or at the start
          // For simplicity: a block is "defragged" if it's one of the first N used blocks 
          // AND there are no empty blocks before it.
          const sliceBefore = sectors.slice(0, i);
          const hasEmptyBefore = sliceBefore.some(s => s.type === 'empty');
          if (!hasEmptyBefore) {
            indices.add(i);
          }
        }
      }
    }
    return indices;
  }, [sectors]);

  const checkWin = (currentSectors: Sector[]) => {
    const firstEmptyIndex = currentSectors.findIndex(s => s.type === 'empty');
    if (firstEmptyIndex === -1) return true;
    const anyUsedAfterEmpty = currentSectors.slice(firstEmptyIndex).some(s => s.type === 'used');
    return !anyUsedAfterEmpty;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const activeSector = sectors.find(s => s.id === active.id);
      const overSector = sectors.find(s => s.id === over.id);

      if (activeSector?.type === 'used' && overSector?.type === 'empty') {
        setSectors((items) => {
          const oldIndex = items.findIndex((i) => i.id === active.id);
          const newIndex = items.findIndex((i) => i.id === over.id);
          
          const newSectors = [...items];
          // Swap types (content) instead of the whole object to keep IDs stable if preferred
          // But swapping objects is fine here since we want the "content" to move.
          const temp = newSectors[oldIndex];
          newSectors[oldIndex] = newSectors[newIndex];
          newSectors[newIndex] = temp;

          if (checkWin(newSectors)) {
            setIsWon(true);
          }
          return newSectors;
        });
      }
    }
  };

  const resetGame = () => {
    setSectors(generateInitialSectors());
    setIsWon(false);
  };

  const activeSector = activeId ? sectors.find(s => s.id === activeId) : null;

  return (
    <div className="game-container">
      <header>
        <h1>defragIt</h1>
        <p>
          Drag <span className="text-used">fragmented</span> blocks to the front until they turn <span className="text-defragged">green</span>.
        </p>
      </header>
      
      <div className={`status ${isWon ? 'won' : ''}`}>
        {isWon ? 'DISK OPTIMIZED!' : 'Defragmentation in progress...'}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="disk-grid">
          {sectors.map((sector, index) => (
            <SectorSlot 
              key={sector.id} 
              sector={sector} 
              isDefragged={defraggedIndices.has(index)}
              isDragging={activeId === sector.id}
            />
          ))}
        </div>

        <DragOverlay>
          {activeSector ? (
            <div className={`sector sector-used ${defraggedIndices.has(sectors.indexOf(activeSector)) ? 'defragged' : ''}`} style={{ cursor: 'grabbing' }} />
          ) : null}
        </DragOverlay>
      </DndContext>

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
  );
}

export default App;
