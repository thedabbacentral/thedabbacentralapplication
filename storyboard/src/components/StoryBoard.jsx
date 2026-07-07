import React, { useEffect, useState } from "react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import "./StoryBoard.css";
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
const StoryBoard = ({ isPublish, isFetchAllCustomers }) => {
  const [columns, setColumns] = useState({});
  const [selectedCard, setSelectedCard] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [mealType, setMealType] = useState("lunch");
  const [fetching, setFetching] = useState(false);
  const [generatedList, setGeneratedList] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [currentRouteIndex, setCurrentRouteIndex] = useState(0);
  const routes = Object.keys(columns);
  const [movingCard, setMovingCard] = useState(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [selectedWhatsappRoute, setSelectedWhatsappRoute] = useState(null);

  const currentRoute = routes[currentRouteIndex];

  const fetchData = async () => {
    try {
      setFetching(true);
      const res = await axios.get(
        `https://thedabbacentralapplication-vo2b.vercel.app/customers/${mealType}${
          isFetchAllCustomers ? "/all" : ""
        }`,
      );

      const sortedColumns = {};
      Object.entries(res.data).forEach(([columnId, cards]) => {
        const sorted = [...cards].sort(
          (a, b) => (a.order || 0) - (b.order || 0),
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
          }),
        );
      });

      setColumns(sortedColumns);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (mealType) fetchData();
  }, [mealType, isFetchAllCustomers]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (currentRouteIndex >= routes.length) {
      setCurrentRouteIndex(0);
    }
  }, [routes]);

  console.log("Mobile", isMobile);

  const reorderRoute = (route, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const updatedCards = [...columns[route]];

    const [moved] = updatedCards.splice(fromIndex, 1);

    updatedCards.splice(toIndex, 0, moved);

    setColumns((prev) => ({
      ...prev,
      [route]: updatedCards,
    }));
  };

  const moveCardToRoute = (card, sourceRoute, destinationRoute) => {
    if (sourceRoute === destinationRoute) return;

    const sourceCards = [...columns[sourceRoute]];
    const destinationCards = [...columns[destinationRoute]];

    const sourceIndex = sourceCards.findIndex((c) => c.id === card.id);

    if (sourceIndex === -1) return;

    const [moved] = sourceCards.splice(sourceIndex, 1);

    if (moved.mapLink) {
      const existingIndex = destinationCards.findIndex(
        (c) => c.mapLink === moved.mapLink,
      );

      if (existingIndex !== -1) {
        destinationCards[existingIndex] = {
          ...destinationCards[existingIndex],
          customers: [
            ...destinationCards[existingIndex].customers,
            ...moved.customers,
          ],
        };
      } else {
        destinationCards.push(moved);
      }
    } else {
      destinationCards.push(moved);
    }

    setColumns((prev) => ({
      ...prev,
      [sourceRoute]: sourceCards,
      [destinationRoute]: destinationCards,
    }));
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;

    // Moving in the same column
    if (sourceCol === destCol) {
      reorderRoute(sourceCol, source.index, destination.index);
      return;
    } else {
      // Moving to a different column
      const sourceCards = [...columns[sourceCol]];
      const destCards = [...columns[destCol]];
      const [moved] = sourceCards.splice(source.index, 1);

      // Check if a card with the same mapLink exists in destination
      if (moved.mapLink) {
        const existingIndex = destCards.findIndex(
          (c) => c.mapLink === moved.mapLink,
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
      columns[col].some((card) => card.id === selectedCard.id),
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
  console.log("Columns: ", columns);

  const updateSingleCustomer = async (customer) => {
    console.log("Customer: ", customer);
    try {
      const response = await fetch(
        "https://thedabbacentralapplication-vo2b.vercel.app/customer/update",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer, mealType }), // sending board state
        },
      );
      if (response.ok) {
        alert("✅ Customer updated!");
        return true;
      } else {
        alert("❌ Customer update failed");
        return false;
      }
    } catch (err) {
      console.error("Error updating customer: ", err);
      return false;
    }
  };

  const saveChanges = async () => {
    if (!selectedCard) return;
    if (isPublish) {
      const isUpdated = await updateSingleCustomer(selectedCard);
      if (!isUpdated) return;
    }
    // Find which column this card belongs to
    const colId = Object.keys(columns).find((col) =>
      columns[col].some((card) => card.id === selectedCard.id),
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

  const whatsappModalBackdropStyle = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  };

  const generateRouteMessage = (route) => {
    let output = `🛣 ${route}\n\n`;

    const cards = columns[route] || [];

    let count = 1;

    const allCustomers = [];

    cards.forEach((card) => {
      card.customers.forEach((c) => {
        allCustomers.push({
          ...c,
          mapLink: card.mapLink,
        });
      });
    });

    const grouped = {};

    allCustomers.forEach((c) => {
      const key = c.mapLink || "No Map Link";

      if (!grouped[key]) grouped[key] = [];

      grouped[key].push(c);
    });

    Object.entries(grouped).forEach(([mapLink, group]) => {
      group.forEach((c, index) => {
        if (index === 0) {
          output += `${count}. ${c.name} - ${c.phoneNumber || "No phone"} - ${
            mealType === "lunch"
              ? c.LunchSpecialNormal || "Normal"
              : c.DinnerSpecialNormal || "Normal"
          }\n`;

          count++;
        } else {
          output += `${c.name} - ${c.phoneNumber || "No phone"} - ${
            mealType === "lunch"
              ? c.LunchSpecialNormal || "Normal"
              : c.DinnerSpecialNormal || "Normal"
          }\n`;
        }
      });

      if (mapLink && mapLink !== "No Map Link") {
        output += `${mapLink}\n`;
      }

      output += "\n";
    });

    return output.trim();
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
      <div className="toolbar">
        <div className="meal-section">
          <span className="toolbar-label">Choose Meal</span>

          <div className="meal-buttons">
            <button
              style={{
                ...buttonStyle,
                background: mealType === "lunch" ? "#2196F3" : "#ccc",
                color: mealType === "lunch" ? "#fff" : "#000",
              }}
              onClick={() => setMealType("lunch")}
              disabled={fetching}
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
              disabled={fetching}
            >
              Dinner
            </button>
          </div>
        </div>
        <div className="action-buttons">
          <button
            style={{
              ...buttonStyle,
              background: "#4CAF50",
              color: "#fff",
              marginLeft: "auto",
            }}
            onClick={generateList}
            disabled={fetching}
          >
            Generate List
          </button>
          <button
            onClick={async () => {
              try {
                const groupedCustomers = columns;

                // console.log("Grouped Customers: ", groupedCustomers);
                let newdata = [];
                Object.keys(groupedCustomers).forEach((key) => {
                  // console.log(`${key}: ${data[key]}`);
                  let singleRouteCustomers = groupedCustomers[key];

                  singleRouteCustomers = singleRouteCustomers?.map(
                    (locationCustomers, index) => {
                      return locationCustomers?.customers?.map((customer) => ({
                        ...customer,
                        ...(mealType === "lunch"
                          ? {
                              lunchRoute: key,
                              lunchRouteOrder: index * 100,
                            }
                          : {
                              dinnerRoute: key,
                              dinnerRouteOrder: index * 100,
                            }),
                      }));
                    },
                  );
                  console.log("Single Route Customers: ", singleRouteCustomers);

                  newdata = [...newdata, ...singleRouteCustomers];
                });
                newdata = newdata?.flat();
                const response = await fetch(
                  "https://thedabbacentralapplication-vo2b.vercel.app/customers/route/publish",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ newdata, mealType }), // sending board state
                  },
                );
                const data = await response.json();
                alert("✅ Publish triggered! Check backend logs.");
                console.log("Publish response:", data);
              } catch (err) {
                console.error("❌ Publish failed", err);
              }
            }}
            style={{
              marginLeft: "10px",
              background: "orange",
              color: "white",
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            disabled={fetching || !isPublish || !isFetchAllCustomers}
          >
            Publish Route
          </button>
        </div>
      </div>

      {/* Columns */}

      {isMobile ? (
        <div className="mobile-board">
          {routes.length > 0 && (
            <>
              <div className="mobile-route-header">
                <button
                  onClick={() =>
                    setCurrentRouteIndex((prev) =>
                      prev === 0 ? routes.length - 1 : prev - 1,
                    )
                  }
                >
                  ←
                </button>

                <div>
                  <h3>{currentRoute}</h3>
                  <small>
                    {currentRouteIndex + 1} / {routes.length}
                  </small>
                </div>

                <button
                  onClick={() =>
                    setCurrentRouteIndex((prev) =>
                      prev === routes.length - 1 ? 0 : prev + 1,
                    )
                  }
                >
                  →
                </button>
              </div>

              <div className="mobile-route-cards">
                {columns[currentRoute]?.map((card, index) => (
                  <div
                    key={card.id}
                    className="mobile-card"
                    onClick={() => setSelectedCard(card)}
                  >
                    {card.customers.map((c) => (
                      <div key={c.id}>
                        <strong>{c.name}</strong>

                        <br />

                        {c.phoneNumber}

                        <br />

                        {mealType === "lunch"
                          ? c.LunchSpecialNormal || "Normal"
                          : c.DinnerSpecialNormal || "Normal"}
                      </div>
                    ))}

                    {card.mapLink && (
                      <div
                        style={{
                          marginTop: 10,
                          color: "#1976d2",
                          fontSize: 13,
                        }}
                      >
                        📍 Map Link
                      </div>
                    )}
                    <div className="mobile-actions">
                      <button
                        className="action-btn"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();

                          if (index > 0) {
                            reorderRoute(currentRoute, index, index - 1);
                          }
                        }}
                      >
                        ⬆️
                      </button>

                      <button
                        className="action-btn"
                        disabled={index === columns[currentRoute].length - 1}
                        onClick={(e) => {
                          e.stopPropagation();

                          if (index < columns[currentRoute].length - 1) {
                            reorderRoute(currentRoute, index, index + 1);
                          }
                        }}
                      >
                        ⬇️
                      </button>

                      <button
                        className="action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMovingCard(card);
                          setShowMoveModal(true);
                        }}
                      >
                        🚚
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        // ORIGINAL DESKTOP CODE HERE
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
      )}
      {showMoveModal && movingCard && (
        <div
          style={modalBackdropStyle}
          onClick={() => {
            setShowMoveModal(false);
            setMovingCard(null);
          }}
        >
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <h2>Move Customer</h2>

            <p>Choose destination route</p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {routes
                .filter((route) => route !== currentRoute)
                .map((route) => (
                  <button
                    key={route}
                    style={{
                      ...buttonStyle,
                      background: "#2196F3",
                      color: "#fff",
                    }}
                    onClick={() => {
                      moveCardToRoute(movingCard, currentRoute, route);

                      setShowMoveModal(false);
                      setMovingCard(null);
                    }}
                  >
                    {route}
                  </button>
                ))}
            </div>

            <button
              style={{
                ...buttonStyle,
                background: "#f44336",
                color: "#fff",
                marginTop: "15px",
              }}
              onClick={() => {
                setShowMoveModal(false);
                setMovingCard(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
                          e.target.value,
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

      {showWhatsappModal && (
        <div
          style={whatsappModalBackdropStyle}
          onClick={() => setShowWhatsappModal(false)}
        >
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <h2>Select Route</h2>

            <p>Choose which delivery route to send.</p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              {routes.map((route) => (
                <button
                  key={route}
                  style={{
                    ...buttonStyle,
                    background: "#25D366",
                    color: "#fff",
                  }}
                  onClick={() => {
                    const message = generateRouteMessage(route);

                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(message)}`,
                      "_blank",
                    );

                    setShowWhatsappModal(false);
                  }}
                >
                  {route}
                </button>
              ))}
            </div>

            <button
              style={{
                ...buttonStyle,
                background: "#f44336",
                color: "#fff",
                marginTop: "20px",
              }}
              onClick={() => setShowWhatsappModal(false)}
            >
              Cancel
            </button>
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
                gap: "10px",
                marginTop: "15px",
                flexWrap: "wrap",
              }}
            >
              <button
                style={{
                  ...buttonStyle,
                  background: "#25D366",
                  color: "#fff",
                }}
                onClick={() => {
                  setShowWhatsappModal(true);
                }}
              >
                💬 WhatsApp
              </button>

              <button
                style={{
                  ...buttonStyle,
                  background: "#2196F3",
                  color: "#fff",
                }}
                onClick={() => {
                  navigator.clipboard.writeText(generatedList);
                  alert("Copied!");
                }}
              >
                📋 Copy
              </button>

              <button
                style={{
                  ...buttonStyle,
                  background: "#4CAF50",
                  color: "#fff",
                }}
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
