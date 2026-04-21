// App.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import "./StoryBoard2.css";

const buttonStyle = {
  padding: "8px 16px",
  margin: "5px",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};

function App({ isPublish, isFetchAllCustomers }) {
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  const [editingInstanceId, setEditingInstanceId] = useState(null);
  const [editedThaliSpecial, setEditedThaliSpecial] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [mealType, setMealType] = useState("lunch");
  const [fetching, setFetching] = useState(false);
  const [isNonVegView, setIsNonVegView] = useState(false);
  const [data, setData] = useState([]);

  const THALI_TYPE_SUPPORTED = isNonVegView
    ? [
        "Unassigned",
        "Chicken",
        "Special",
        "Normal",
        "Tiffin",
        "3CP",
        "Container",
      ]
    : [
        "Unassigned",
        "Chicken",
        "Paneer",
        "Special",
        "Normal",
        "Tiffin",
        "3CP",
        "Container",
      ];

  const fetchCustomers = async () => {
    try {
      setFetching(true);
      const resp = await axios.get(
        `https://thedabbacentralapplication-vo2b.vercel.app/customers/serve/${mealType}${
          isFetchAllCustomers ? "/all" : ""
        }`,
      );
      const data = Array.isArray(resp.data) ? resp.data : [];
      setData(data);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to fetch customers");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    setCustomers(parseCustomers(data));
  }, [data, isNonVegView]);

  const parseCustomers = (customerData) => {
    if (isNonVegView) {
      customerData = customerData
        ?.map((customer, index) =>
          mealType === "lunch"
            ? {
                thaliType:
                  customer.foodPreference === "Non-Veg"
                    ? "Chicken"
                    : customer.LunchSpecialNormal === "Paneer"
                      ? "Normal"
                      : customer.LunchSpecialNormal === "Normal" ||
                          customer.lunchServeOrder
                        ? (customer.LunchSpecialNormal ?? "Unassigned")
                        : "Unassigned",
                serveOrder: customer.lunchServeOrder ?? 0,
                customisation: customer.customisationLunch ?? "",
                poster: customer.poster,
                id: customer.id,
                name: customer.name,
                instanceId: `${customer.id}-${index}`,
              }
            : {
                thaliType:
                  customer.foodPreference === "Non-Veg"
                    ? "Chicken"
                    : customer.DinnerSpecialNormal === "Normal" ||
                        customer.dinnerServeOrder
                      ? (customer.DinnerSpecialNormal ?? "Unassigned")
                      : "Unassigned",
                serveOrder: customer.dinnerServeOrder ?? 0,
                customisation: customer.customisationDinner ?? "",
                poster: customer.poster,
                id: customer.id,
                name: customer.name,
                instanceId: `${customer.id}-${index}`,
              },
        )
        ?.sort((a, b) => a.serveOrder - b.serveOrder);
    } else {
      customerData = customerData
        ?.map((customer, index) =>
          mealType === "lunch"
            ? {
                thaliType:
                  customer.LunchSpecialNormal === "Normal" ||
                  customer.lunchServeOrder
                    ? (customer.LunchSpecialNormal ?? "Unassigned")
                    : "Unassigned",
                serveOrder: customer.lunchServeOrder ?? 0,
                customisation: customer.customisationLunch ?? "",
                poster: customer.poster,
                id: customer.id,
                name: customer.name,
                instanceId: `${customer.id}-${index}`,
              }
            : {
                thaliType:
                  customer.DinnerSpecialNormal === "Normal" ||
                  customer.dinnerServeOrder
                    ? (customer.DinnerSpecialNormal ?? "Unassigned")
                    : "Unassigned",
                serveOrder: customer.dinnerServeOrder ?? 0,
                customisation: customer.customisationDinner ?? "",
                poster: customer.poster,
                id: customer.id,
                name: customer.name,
                instanceId: `${customer.id}-${index}`,
              },
        )
        ?.sort((a, b) => a.serveOrder - b.serveOrder);
    }
    return customerData;
  };

  useEffect(() => {
    if (mealType) fetchCustomers();
  }, [mealType, isFetchAllCustomers]);

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    console.log("source", source);
    console.log("destination", destination);
    if (!destination) return;

    const sourceDroppable = source.droppableId;
    const destDroppable = destination.droppableId;

    if (sourceDroppable === destDroppable) {
      let allParticularThaliCustomers = [
        ...customers?.filter((c) => c.thaliType === sourceDroppable),
      ];
      let otherThaliCustomers = [
        ...customers?.filter((c) => c.thaliType !== sourceDroppable),
      ];
      const customer = allParticularThaliCustomers[source.index];
      allParticularThaliCustomers.splice(source.index, 1);
      allParticularThaliCustomers.splice(destination.index, 0, customer);

      setCustomers([...allParticularThaliCustomers, ...otherThaliCustomers]);
    } else {
      let sourceCustomers = [
        ...customers?.filter((c) => c.thaliType === sourceDroppable),
      ];
      let destCustomers = [
        ...customers?.filter((c) => c.thaliType === destDroppable),
      ];

      let otherCustomers = [
        ...customers?.filter(
          (c) =>
            c.thaliType !== sourceDroppable && c.thaliType !== destDroppable,
        ),
      ];

      let sourceCustomer = sourceCustomers[source.index];

      sourceCustomer.thaliType = destDroppable;
      sourceCustomers.splice(source.index, 1);
      destCustomers.splice(destination.index, 0, sourceCustomer);

      setCustomers([...sourceCustomers, ...destCustomers, ...otherCustomers]);
    }

    // if (sourceDroppable === destDroppable) {
    //   if (sourceDroppable === "special") {
    //     setSpecialCustomers((prev) =>
    //       reorder(prev, source.index, destination.index)
    //     );
    //   } else {
    //     setNormalCustomers((prev) =>
    //       reorder(prev, source.index, destination.index)
    //     );
    //   }
    //   return;
    // }

    // if (sourceDroppable === "special" && destDroppable === "normal") {
    //   let moved;
    //   setSpecialCustomers((prev) => {
    //     const copy = Array.from(prev);
    //     moved = copy.splice(source.index, 1)[0];
    //     return copy;
    //   });
    //   if (!moved) return;
    //   moved = {
    //     ...moved,
    //     ...(mealType === "lunch"
    //       ? { thaliSpecialLunch: null }
    //       : { thaliSpecialDinner: null }),
    //   };
    //   setNormalCustomers((prev) => {
    //     const copy = Array.from(prev);
    //     copy.splice(destination.index, 0, moved);
    //     return copy;
    //   });
    //   return;
    // }

    // if (sourceDroppable === "normal" && destDroppable === "special") {
    //   let moved;
    //   setNormalCustomers((prev) => {
    //     const copy = Array.from(prev);
    //     moved = copy.splice(source.index, 1)[0];
    //     return copy;
    //   });
    //   if (!moved) return;
    //   moved = {
    //     ...moved,
    //     ...(mealType === "lunch"
    //       ? { thaliSpecialLunch: moved.thaliSpecialLunch ?? "" }
    //       : { thaliSpecialDinner: moved.thaliSpecialDinner ?? "" }),
    //   };
    //   setSpecialCustomers((prev) => {
    //     const copy = Array.from(prev);
    //     copy.splice(destination.index, 0, moved);
    //     return copy;
    //   });
    //   return;
    // }
  };

  const handleEditOpen = (customerInstanceId) => {
    setEditingInstanceId(customerInstanceId);

    setEditedThaliSpecial(
      customers.find((c) => c.instanceId === customerInstanceId)?.customisation,
    );
  };

  const handleSave = (customerInstanceId) => {
    const updatedCustomers = customers.map((c) =>
      c.instanceId === customerInstanceId
        ? {
            ...c,
            customisation: editedThaliSpecial,
          }
        : c,
    );
    setCustomers(updatedCustomers);

    setEditingInstanceId(null);
    setEditedThaliSpecial("");
  };

  if (error) return <p className="error">{error}</p>;

  return (
    <div className="app">
      <div
        className="header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          background: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        {/* Toggle Meal Type */}
        <div
          style={{
            padding: "10px",
            display: "flex",
            gap: "10px",
            alignItems: "center",

            width: "100%",
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
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            width: "100%",
            justifyContent: "flex-end",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
            }}
            onClick={() => setIsNonVegView((v) => !v)}
          >
            <span>Non Veg View</span>
            <div
              role="switch"
              aria-checked={isNonVegView}
              style={{
                width: 52,
                height: 28,
                borderRadius: 999,
                background: isNonVegView ? "#2196F3" : "#cfd8dc",
                position: "relative",
                transition: "background 0.2s ease",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: isNonVegView ? 26 : 3,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  transition: "left 0.2s ease",
                }}
              />
            </div>
          </label>
          <button
            className="btn generate-btn"
            onClick={() => setShowModal(true)}
            disabled={fetching}
            style={{
              ...buttonStyle,
              background: "#4CAF50",
              color: "#fff",
            }}
          >
            Generate List
          </button>
          <button
            style={{
              marginLeft: "10px",
              background: "orange",
              color: "white",
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={async () => {
              try {
                let newdata = [...customers];
                console.log("Newdata Old: ", newdata);
                let updatedData = [];
                THALI_TYPE_SUPPORTED.forEach((thaliType) => {
                  let thaliTypeCustomers = newdata.filter(
                    (c) => c.thaliType === thaliType,
                  );
                  updatedData = [
                    ...updatedData,
                    ...thaliTypeCustomers.map((c, index) => ({
                      ...c,
                      serveOrder: index + 1,
                    })),
                  ];
                });

                newdata = updatedData;
                console.log("Newdata: ", newdata);

                const response = await fetch(
                  "https://thedabbacentralapplication-vo2b.vercel.app/customers/serve/publish",
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
            disabled={
              fetching || !isPublish || !isFetchAllCustomers || isNonVegView
            }
          >
            Publish Route
          </button>
        </div>
      </div>

      {fetching ? (
        <p className="info">Loading...</p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          {THALI_TYPE_SUPPORTED.map((thaliType) => (
            <section key={thaliType}>
              <h3 className="section-title">
                {thaliType} (
                {customers?.filter((c) => c.thaliType === thaliType)?.length})
              </h3>
              <Droppable droppableId={thaliType}>
                {(provided) => (
                  <div
                    className="list"
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                  >
                    {customers?.filter((c) => c.thaliType === thaliType)
                      ?.length > 0 ? (
                      customers
                        ?.filter((c) => c.thaliType === thaliType)
                        .map((customer, index) => (
                          <Draggable
                            key={customer.instanceId}
                            draggableId={customer.instanceId}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                className={`card ${
                                  snapshot.isDragging ? "dragging" : ""
                                }`}
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() =>
                                  editingInstanceId !== customer.instanceId &&
                                  handleEditOpen(customer.instanceId)
                                }
                              >
                                {editingInstanceId === customer.instanceId ? (
                                  <div className="edit-box">
                                    <input
                                      type="text"
                                      value={editedThaliSpecial}
                                      onChange={(e) =>
                                        setEditedThaliSpecial(e.target.value)
                                      }
                                    />
                                    <button
                                      className="btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSave(customer.instanceId);
                                      }}
                                    >
                                      Save
                                    </button>
                                  </div>
                                ) : (
                                  <h4>
                                    {customer.name}{" "}
                                    <span>
                                      {customer.customisation
                                        ? `- ${customer.customisation}`
                                        : " "}
                                    </span>
                                    <span>
                                      {customer.poster ? `- Poster` : " "}
                                    </span>
                                  </h4>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))
                    ) : (
                      <p>No {thaliType} customers</p>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </section>
          ))}
        </DragDropContext>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Generated List</h3>
            <div className="modal-content">
              {THALI_TYPE_SUPPORTED.map(
                (thaliType) =>
                  customers?.filter((c) => c.thaliType === thaliType)?.length >
                    0 && (
                    <>
                      <h4>{thaliType}</h4>
                      <ol>
                        {customers
                          ?.filter((c) => c.thaliType === thaliType)
                          .map((c, i) => (
                            <li key={c.id}>
                              {c.name}{" "}
                              {c.customisation ? `- ${c.customisation}` : ""}
                              {c.poster ? `- Poster` : ""}
                            </li>
                          ))}
                      </ol>
                    </>
                  ),
              )}
            </div>
            <button
              className="btn close-btn"
              onClick={() => setShowModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
