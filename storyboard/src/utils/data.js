export const initialData = {
  tasks: {
    "task-1": { id: "task-1", content: "Write project proposal" },
    "task-2": { id: "task-2", content: "Design UI mockups" },
    "task-3": { id: "task-3", content: "Fix bugs" },
    "task-4": { id: "task-4", content: "Team meeting" },
  },
  columns: {
    "column-1": {
      id: "column-1",
      title: "To Do",
      taskIds: ["task-1", "task-2"],
    },
    "column-2": { id: "column-2", title: "In Progress", taskIds: ["task-3"] },
    "column-3": { id: "column-3", title: "Done", taskIds: ["task-4"] },
  },
  columnOrder: ["column-1", "column-2", "column-3"],
};
