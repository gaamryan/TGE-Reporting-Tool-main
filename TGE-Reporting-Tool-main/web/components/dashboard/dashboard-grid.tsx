"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WidgetConfig } from "@/types/widget";
import { WidgetWithData } from "@/components/widgets/widget-with-data";
import { cn } from "@/lib/utils";

interface DashboardGridProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  onRemoveWidget: (id: string) => void;
  className?: string;
}

export function DashboardGrid({
  widgets,
  onWidgetsChange,
  onRemoveWidget,
  className,
}: DashboardGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      onWidgetsChange(arrayMove(widgets, oldIndex, newIndex));
    }
  };

  const activeWidget = activeId ? widgets.find((w) => w.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-min",
            className
          )}
        >
          {widgets.map((widget) => (
            <SortableWidget
              key={widget.id}
              widget={widget}
              isDragging={activeId === widget.id}
              onRemove={() => onRemoveWidget(widget.id)}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeWidget && (
          <WidgetWithData
            config={activeWidget}
            isDragging
            className="opacity-80 shadow-2xl"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface SortableWidgetProps {
  widget: WidgetConfig;
  isDragging?: boolean;
  onRemove: () => void;
}

function SortableWidget({
  widget,
  isDragging,
  onRemove,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(isSortableDragging && "opacity-50")}
    >
      <WidgetWithData
        config={widget}
        isDragging={isDragging}
        onRemove={onRemove}
        showSampleOnEmpty={true}
      />
    </div>
  );
}
