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
const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const modalBoxStyle = {
  background: "#fefefe",
  padding: "20px",
  borderRadius: "12px",
  width: "400px",
  maxHeight: "80vh",
  overflowY: "auto",
  boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
  borderTop: "5px solid #4A90E2",
};
const generatedModalBoxStyle = {
  background: "#fefefe",
  padding: "20px",
  borderRadius: "12px",
  width: "500px",
  maxHeight: "80vh",
  overflowY: "auto",
  boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
  borderLeft: "5px solid #4CAF50",
};
const buttonStyle = {
  padding: "8px 16px",
  margin: "5px",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};
const StoryBoard = () => {
  const [columns, setColumns] = useState({});
  const [selectedCard, setSelectedCard] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [mealType, setMealType] = useState("lunch");
  const [generatedList, setGeneratedList] = useState(null);

  const fetchData = async () => {
    try {
      const res = await axios.get(
        `http://localhost:4000/customers/${mealType}`
      );

      const sortedColumns = {};
      Object.entries(res.data).forEach(([columnId, cards]) => {
        const sorted = [...cards].sort(
          (a, b) => (a.order || 0) - (b.order || 0)
        );

        // Group only if mapLink exists
        const groupedByMap = {};
        sorted.forEach((c) => {
          const key = c[`${mealType}MapLink`];
          if (key) {
            if (!groupedByMap[key]) groupedByMap[key] = [];
            groupedByMap[key].push(c);
          } else {
            // Customers without mapLink become their own "group"
            groupedByMap[c.id] = [c];
          }
        });

        sortedColumns[columnId] = Object.entries(groupedByMap).map(
          ([mapLinkOrId, group]) => ({
            mapLink: group[0][`${mealType}MapLink`] || null,
            customers: group,
            id: group.map((g) => g.id).join("-"),
          })
        );
      });

      setColumns(sortedColumns);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [mealType]);

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;

    // Moving in the same column
    if (sourceCol === destCol) {
      const updatedCards = [...columns[sourceCol]];
      const [moved] = updatedCards.splice(source.index, 1);
      updatedCards.splice(destination.index, 0, moved);

      setColumns({
        ...columns,
        [sourceCol]: updatedCards,
      });
    } else {
      // Moving to a different column
      const sourceCards = [...columns[sourceCol]];
      const destCards = [...columns[destCol]];
      const [moved] = sourceCards.splice(source.index, 1);

      // Check if a card with the same mapLink exists in destination
      if (moved.mapLink) {
        const existingIndex = destCards.findIndex(
          (c) => c.mapLink === moved.mapLink
        );
        if (existingIndex !== -1) {
          // Merge customers into the existing card
          destCards[existingIndex] = {
            ...destCards[existingIndex],
            customers: [
              ...destCards[existingIndex].customers,
              ...moved.customers,
            ],
          };
        } else {
          destCards.splice(destination.index, 0, moved);
        }
      } else {
        destCards.splice(destination.index, 0, moved);
      }

      setColumns({
        ...columns,
        [sourceCol]: sourceCards,
        [destCol]: destCards,
      });
    }
  };

  const separateCustomer = (index) => {
    if (!selectedCard) return;

    const customerToSeparate = selectedCard.customers[index];

    // Find which column this card belongs to
    const colId = Object.keys(columns).find((col) =>
      columns[col].some((card) => card.id === selectedCard.id)
    );

    if (!colId) return;

    const updatedColumn = columns[colId]
      .map((card) => {
        if (card.id === selectedCard.id) {
          // Remove customer from this card
          const newCustomers = card.customers.filter((_, i) => i !== index);
          return { ...card, customers: newCustomers };
        }
        return card;
      })
      .filter((card) => card.customers.length > 0); // Remove empty cards

    // Create a new card with this customer
    const newCard = {
      id: customerToSeparate.id, // unique id
      mapLink: customerToSeparate.mapLink || null,
      customers: [customerToSeparate],
    };

    updatedColumn.push(newCard);

    setColumns({
      ...columns,
      [colId]: updatedColumn,
    });

    // Close modal or update selectedCard
    setSelectedCard(null);
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
    if (!selectedCard) return;

    // Find which column this card belongs to
    const colId = Object.keys(columns).find((col) =>
      columns[col].some((card) => card.id === selectedCard.id)
    );

    if (!colId) return;

    const updatedColumn = columns[colId].map((card) => {
      if (card.id === selectedCard.id) {
        // Update the card with edited mapLink and customers
        return { ...selectedCard };
      }
      return card;
    });

    setColumns({
      ...columns,
      [colId]: updatedColumn,
    });

    setIsEditing(false);
  };

  const generateList = () => {
    let output = "";

    Object.entries(columns).forEach(([route, cards]) => {
      output += `\n🛣 ${route}\n`;

      let count = 1;

      // Flatten all customers for this route
      const allCustomers = [];
      cards.forEach((card) => {
        card.customers.forEach((c) => {
          allCustomers.push({ ...c, mapLink: card.mapLink });
        });
      });

      // Group customers by mapLink while keeping order
      const grouped = {};
      allCustomers.forEach((c) => {
        const key = c.mapLink || "No Map Link";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(c);
      });

      // Print grouped customers
      Object.entries(grouped).forEach(([mapLink, group]) => {
        group.forEach((c, index) => {
          if (index === 0) {
            output += `${count}. ${c.name} - ${c.phoneNumber || "No phone"} - ${
              mealType == "lunch"
                ? c.LunchSpecialNormal || "Normal"
                : c.DinnerSpecialNormal || "Normal"
            }\n`;
            count++;
          } else {
            output += `${c.name} - ${c.phoneNumber || "No phone"} - ${
              mealType == "lunch"
                ? c.LunchSpecialNormal || "Normal"
                : c.DinnerSpecialNormal || "Normal"
            }\n`;
          }
        });
        if (mapLink && mapLink !== "No Map Link") {
          output += `   ${mapLink}\n`;
        }
      });
    });

    setGeneratedList(output.trim());
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "#f2f2f2",
      }}
    >
      {/* Toggle Meal Type */}
      <div
        style={{
          padding: "10px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
          background: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        <span style={{ fontWeight: "bold" }}>Choose Meal:</span>
        <button
          style={{
            ...buttonStyle,
            background: mealType === "lunch" ? "#2196F3" : "#ccc",
            color: mealType === "lunch" ? "#fff" : "#000",
          }}
          onClick={() => setMealType("lunch")}
        >
          Lunch
        </button>
        <button
          style={{
            ...buttonStyle,
            background: mealType === "dinner" ? "#2196F3" : "#ccc",
            color: mealType === "dinner" ? "#fff" : "#000",
          }}
          onClick={() => setMealType("dinner")}
        >
          Dinner
        </button>
        <button
          style={{
            ...buttonStyle,
            background: "#4CAF50",
            color: "#fff",
            marginLeft: "auto",
          }}
          onClick={generateList}
        >
          Generate List
        </button>
      </div>

      {/* Columns */}
      <div
        style={{
          display: "flex",
          overflowX: "auto",
          padding: "20px",
          gap: "20px",
        }}
      >
        <DragDropContext onDragEnd={onDragEnd}>
          {Object.entries(columns).map(([columnId, cards], idx) => {
            const theme = colors[idx % colors.length];
            return (
              <Droppable key={columnId} droppableId={columnId}>
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    style={{
                      background: theme.bg,
                      minWidth: "250px",
                      borderRadius: "8px",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        background: theme.header,
                        color: "#fff",
                        padding: "8px",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        textAlign: "center",
                        marginBottom: "12px",
                      }}
                    >
                      {columnId} ({cards.length})
                    </div>
                    {cards.map((card, index) => (
                      <Draggable
                        key={card.id}
                        draggableId={card.id}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => setSelectedCard(card)}
                            style={{
                              padding: "10px",
                              marginBottom: "8px",
                              borderRadius: "6px",
                              background: "#fff",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                              cursor: "pointer",
                              ...provided.draggableProps.style,
                            }}
                          >
                            {card.customers.map((c) => (
                              <div key={c.id}>
                                {c.name} - {c.phoneNumber || "No phone"} -{" "}
                                {mealType === "lunch"
                                  ? c.LunchSpecialNormal || "Normal"
                                  : c.DinnerSpecialNormal || "Normal"}
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
                )}
              </Droppable>
            );
          })}
        </DragDropContext>
      </div>

      {/* Edit Modal */}
      {selectedCard && (
        <div
          style={modalBackdropStyle}
          onClick={() => {
            setSelectedCard(null);
            setIsEditing(false);
          }}
        >
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <h2
              style={{
                textAlign: "center",
                fontSize: "20px",
                fontWeight: "bold",
                marginBottom: "15px",
                color: "#4A90E2",
              }}
            >
              Customer Details
            </h2>
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

                <div>
                  <strong>Special:</strong>{" "}
                  {isEditing ? (
                    <select
                      value={
                        mealType === "lunch"
                          ? c.LunchSpecialNormal || "Normal"
                          : c.DinnerSpecialNormal || "Normal"
                      }
                      onChange={(e) =>
                        handleInputChange(
                          idx,
                          mealType === "lunch"
                            ? "LunchSpecialNormal"
                            : "DinnerSpecialNormal",
                          e.target.value
                        )
                      }
                      className="border px-2 py-1 rounded w-full"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Special">Special</option>
                    </select>
                  ) : mealType === "lunch" ? (
                    c.LunchSpecialNormal || "Normal"
                  ) : (
                    c.DinnerSpecialNormal || "Normal"
                  )}
                </div>
                {/* 🔹 Separate button */}
                {!isEditing && selectedCard.customers.length > 1 && (
                  <button
                    style={{
                      ...buttonStyle,
                      background: "#FF9800",
                      color: "#fff",
                      marginTop: "6px",
                    }}
                    onClick={() => separateCustomer(idx)}
                  >
                    Separate
                  </button>
                )}
              </div>
            ))}

            <div style={{ marginBottom: "12px" }}>
              <strong>Map Link:</strong>{" "}
              {isEditing ? (
                <input
                  type="text"
                  value={selectedCard.mapLink || ""}
                  onChange={(e) =>
                    handleInputChange(null, "mapLink", e.target.value)
                  }
                />
              ) : (
                <a href={selectedCard.mapLink} target="_blank" rel="noreferrer">
                  {selectedCard.mapLink}
                </a>
              )}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              {isEditing ? (
                <button
                  style={{
                    ...buttonStyle,
                    background: "#4CAF50",
                    color: "#fff",
                  }}
                  onClick={saveChanges}
                >
                  Save
                </button>
              ) : (
                <button
                  style={{
                    ...buttonStyle,
                    background: "#2196F3",
                    color: "#fff",
                  }}
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
              )}
              <button
                style={{ ...buttonStyle, background: "#f44336", color: "#fff" }}
                onClick={() => {
                  setSelectedCard(null);
                  setIsEditing(false);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated List Modal */}
      {generatedList && (
        <div style={modalBackdropStyle} onClick={() => setGeneratedList(null)}>
          <div
            style={generatedModalBoxStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                textAlign: "center",
                fontSize: "20px",
                fontWeight: "bold",
                marginBottom: "15px",
                color: "#4CAF50",
              }}
            >
              Generated List
            </h2>
            <pre
              style={{
                background: "#f9f9f9",
                padding: "10px",
                borderRadius: "6px",
                maxHeight: "60vh",
                overflowY: "auto",
                border: "1px solid #ccc",
              }}
            >
              {generatedList}
            </pre>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "15px",
              }}
            >
              <button
                style={{ ...buttonStyle, background: "#4CAF50", color: "#fff" }}
                onClick={() => setGeneratedList(null)}
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
