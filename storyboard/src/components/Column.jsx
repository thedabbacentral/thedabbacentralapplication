import React from "react";
import { Droppable } from "react-beautiful-dnd";
import Task from "./Task";
import AddCardForm from "./AddCardForm";

export default function Column({ column, tasks, addTask }) {
  return (
    <div className="column">
      <div className="column-header">
        <h3>{column.title}</h3>
      </div>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`task-list ${
              snapshot.isDraggingOver ? "dragging-over" : ""
            }`}
          >
            {tasks.map((task, index) => (
              <Task key={task.id} task={task} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <AddCardForm onAdd={(content) => addTask(column.id, content)} />
    </div>
  );
}
