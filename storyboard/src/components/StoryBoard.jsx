import React, { useEffect, useState } from "react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const colors = [
  { bg: "#E0F7FA", header: "#00ACC1" },
  { bg: "#FFF3E0", header: "#FB8C00" },
  { bg: "#F3E5F5", header: "#8E24AA" },
  { bg: "#E8F5E9", header: "#43A047" },
  { bg: "#FFEBEE", header: "#E53935" },
];

const StoryBoard = () => {
  const [columns, setColumns] = useState({});
  const [selectedCard, setSelectedCard] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    axios.get("http://localhost:4000/customers/lunch").then((res) => {
      const sortedColumns = {};
      Object.entries(res.data).forEach(([columnId, cards]) => {
        const sorted = [...cards].sort(
          (a, b) => (a.order || 0) - (b.order || 0)
        );

        const groupedByMap = {};
        sorted.forEach((c) => {
          const key = c.lunchMapLink || "No Map Link";
          if (!groupedByMap[key]) groupedByMap[key] = [];
          groupedByMap[key].push(c);
        });

        sortedColumns[columnId] = Object.entries(groupedByMap).map(
          ([mapLink, group]) => ({
            mapLink,
            customers: group,
            id: group.map((g) => g.id).join("-"),
          })
        );
      });
      setColumns(sortedColumns);
    });
  }, []);

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;

    if (sourceCol === destCol) {
      const updatedCards = Array.from(columns[sourceCol]);
      const [moved] = updatedCards.splice(source.index, 1);
      updatedCards.splice(destination.index, 0, moved);

      setColumns({
        ...columns,
        [sourceCol]: updatedCards,
      });
    } else {
      const sourceCards = Array.from(columns[sourceCol]);
      const destCards = Array.from(columns[destCol]);
      const [moved] = sourceCards.splice(source.index, 1);

      destCards.splice(destination.index, 0, moved);

      setColumns({
        ...columns,
        [sourceCol]: sourceCards,
        [destCol]: destCards,
      });
    }
  };

  const handleInputChange = (index, field, value) => {
    const updated = { ...selectedCard };
    if (field === "mapLink") {
      updated.mapLink = value;
    } else {
      updated.customers[index][field] = value;
    }
    setSelectedCard(updated);
  };

  const saveChanges = () => {
    console.log("Save to backend:", selectedCard);
    setIsEditing(false);
  };

  return (
    <div className="flex overflow-x-auto p-6 bg-gray-100 min-h-screen space-x-6">
      <DragDropContext onDragEnd={onDragEnd}>
        {Object.entries(columns).map(([columnId, cards], idx) => {
          const theme = colors[idx % colors.length];

          return (
            <Droppable key={columnId} droppableId={columnId}>
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="column"
                  style={{
                    background: theme.bg,
                    minWidth: "250px",
                    borderRadius: "8px",
                    flex: "0 0 auto",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    className="column-header"
                    style={{
                      background: theme.header,
                      color: "white",
                      borderRadius: "6px",
                      padding: "8px",
                      textAlign: "center",
                      fontWeight: "600",
                      marginBottom: "12px",
                    }}
                  >
                    {columnId}
                  </div>

                  <div
                    className={`task-list ${
                      snapshot.isDraggingOver ? "dragging-over" : ""
                    }`}
                    style={{ flexGrow: 1, minHeight: "150px" }}
                  >
                    {cards.map((card, index) => (
                      <Draggable
                        key={card.id}
                        draggableId={card.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log("Card clicked:", card); // debug
                              setSelectedCard(card);
                            }}
                            className={`task ${
                              snapshot.isDragging ? "dragging" : ""
                            }`}
                            style={{
                              padding: "10px",
                              marginBottom: "8px",
                              borderRadius: "6px",
                              background: "white",
                              boxShadow: "0 1px 0 rgba(9, 30, 66, 0.08)",
                              cursor: "pointer",
                              userSelect: "none",
                              ...provided.draggableProps.style,
                            }}
                          >
                            {card.customers.map((c) => (
                              <div key={c.id}>
                                {c.name} - {c.phoneNumber || "No phone"}
                              </div>
                            ))}
                            {card.mapLink && (
                              <div
                                style={{
                                  marginTop: "4px",
                                  fontSize: "0.9em",
                                  color: "#1976d2",
                                }}
                              >
                                {card.mapLink}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </DragDropContext>

      {/* MODAL */}
      {selectedCard && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
          onClick={() => {
            setSelectedCard(null);
            setIsEditing(false);
          }}
        >
          <div
            className="bg-white p-6 rounded-lg w-[400px] shadow-lg relative z-60"
            onClick={(e) => e.stopPropagation()} // prevent modal click from closing
          >
            <h2 className="text-lg font-bold mb-4">Customer Details</h2>

            {selectedCard.customers.map((c, idx) => (
              <div key={c.id} className="mb-4 border-b pb-2">
                <div>
                  <strong>Name:</strong> {c.name}
                </div>
                <div>
                  <strong>Phone:</strong>{" "}
                  {isEditing ? (
                    <input
                      value={c.phoneNumber || ""}
                      onChange={(e) =>
                        handleInputChange(idx, "phoneNumber", e.target.value)
                      }
                      className="border px-2 py-1 rounded w-full"
                    />
                  ) : (
                    c.phoneNumber || "No phone"
                  )}
                </div>
              </div>
            ))}

            <div className="mb-4">
              <strong>Map Link:</strong>{" "}
              {isEditing ? (
                <input
                  value={selectedCard.mapLink || ""}
                  onChange={(e) =>
                    handleInputChange(null, "mapLink", e.target.value)
                  }
                  className="border px-2 py-1 rounded w-full"
                />
              ) : (
                <a
                  href={selectedCard.mapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  {selectedCard.mapLink}
                </a>
              )}
            </div>

            <div className="flex justify-end gap-2">
              {isEditing ? (
                <button
                  onClick={saveChanges}
                  className="bg-green-500 text-white px-3 py-1 rounded"
                >
                  Save
                </button>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedCard(null);
                  setIsEditing(false);
                }}
                className="bg-gray-400 text-white px-3 py-1 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryBoard;
