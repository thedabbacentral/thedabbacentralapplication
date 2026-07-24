// App.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import "./StoryBoard2v2.css";
// const API_URL = "http://localhost:4000";
const API_URL = "https://thedabbacentralapplication.onrender.com";

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
  const [isFullRiceMeal, setIsFullRiceMeal] = useState(false);

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
        `${API_URL}/customers/serve/${mealType}${
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

  const applyTemplates = async () => {
    console.log("mealType:", mealType);

    try {
      const response = await fetch(`${API_URL}/templates/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meal: mealType,
        }),
      });

      const result = await response.json();
      await fetchCustomers();
      console.log(result);

      alert(`
Templates Applied Successfully

Cancellations
Applied: ${result.cancellations.applied}
Skipped Duplicate: ${result.cancellations.skippedDuplicate}
Skipped Inactive: ${result.cancellations.skippedInactive}

Extra Meals
Applied: ${result.extras.applied}
Skipped Duplicate: ${result.extras.skippedDuplicate}
Skipped Inactive: ${result.extras.skippedInactive}
`);
    } catch (err) {
      console.error(err);
      alert("Failed to apply templates");
    }
  };

  useEffect(() => {
    setCustomers(parseCustomers(data));
  }, [data, isNonVegView]);

  useEffect(() => {
    if (isFetchAllCustomers && isNonVegView) {
      setIsNonVegView(false);
    }
  }, [isFetchAllCustomers]);

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
                dailyCustomization: customer.dailyCustomization || false,
                isTrialMeal: customer.isTrialMeal || false,
                templateNonVeg: customer.templateNonVeg || false,
              }
            : {
                thaliType: customer.locationChanged
                  ? "Unassigned"
                  : customer.foodPreference === "Non-Veg"
                    ? "Chicken"
                    : customer.DinnerSpecialNormal === "Paneer"
                      ? "Normal"
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
                dailyCustomization: customer.dailyCustomization || false,
                isTrialMeal: customer.isTrialMeal || false,
                templateNonVeg: customer.templateNonVeg || false,
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
                dailyCustomization: customer.dailyCustomization || false,
                isTrialMeal: customer.isTrialMeal || false,
                templateNonVeg: customer.templateNonVeg || false,
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
                dailyCustomization: customer.dailyCustomization || false,
                isTrialMeal: customer.isTrialMeal || false,
                templateNonVeg: customer.templateNonVeg || false,
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

  function getDisplayedCustomization(customization, isFullRiceMeal) {
    if (!customization) return "";

    if (!isFullRiceMeal) return customization;

    const keep = ["3 Gravy", "No Curd", "No Raita", "Spoon", "Tissue"];

    return keep
      .filter((item) =>
        customization.toLowerCase().includes(item.toLowerCase()),
      )
      .join(", ");
  }

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

  function normalize(customisation = "") {
    return customisation
      .toLowerCase()
      .replace(/poster/g, "")
      .replace(/spoon/g, "")
      .replace(/papad/g, "")
      .replace(/salad/g, "")
      .replace(/achar/g, "")
      .trim();
  }

  function getSpecialPriority(customisation = "") {
    const text = normalize(customisation);

    if (text.includes("no rice")) {
      if (text.includes("2 gravy")) return 2;
      return 1;
    }

    if (text.includes("2 gravy")) return 3;

    if (text.includes("only rice")) return 4;

    if (text.includes("less rice")) return 5;

    if (text.includes("no roti")) return 6;

    if (text.includes("roti")) return 7;

    return text ? 8 : 9;
  }

  const prepareServingList = () => {
    // Clone customers
    const updatedCustomers = customers.map((c) => ({ ...c }));

    // STEP 1: Assign thali types
    updatedCustomers.forEach((customer) => {
      const effectiveCustomization = getDisplayedCustomization(
        customer.customisation,
        isFullRiceMeal,
      );

      const hasCustomization = effectiveCustomization.trim().length > 0;

      if (customer.thaliType === "Unassigned") {
        if (!isFetchAllCustomers && customer.isTrialMeal) {
          customer.thaliType = "Paneer";
        } else if (!isFetchAllCustomers && customer.templateNonVeg) {
          customer.thaliType = "Chicken";
        } else if (hasCustomization) {
          customer.thaliType = "Special";
        } else {
          customer.thaliType = "Normal";
        }
      } else if (customer.thaliType === "Normal" && hasCustomization) {
        customer.thaliType = "Special";
      } else if (customer.thaliType === "Special" && !hasCustomization) {
        customer.thaliType = "Normal";
      }
    });

    // Helper for sorting by customization priority
    const sortByCustomizationPriority = (list) =>
      list.sort((a, b) => {
        const diff =
          getSpecialPriority(
            getDisplayedCustomization(a.customisation, isFullRiceMeal),
          ) -
          getSpecialPriority(
            getDisplayedCustomization(b.customisation, isFullRiceMeal),
          );

        if (diff !== 0) return diff;

        return 0;
      });

    // STEP 2: Sort Special customers
    const specialCustomers = sortByCustomizationPriority(
      updatedCustomers.filter((c) => c.thaliType === "Special"),
    );

    // STEP 3: Sort Chicken customers
    const chickenCustomers = sortByCustomizationPriority(
      updatedCustomers.filter((c) => c.thaliType === "Chicken"),
    );

    // STEP 4: Everything else stays in existing order
    const otherCustomers = updatedCustomers.filter(
      (c) => c.thaliType !== "Special" && c.thaliType !== "Chicken",
    );

    setCustomers([...specialCustomers, ...chickenCustomers, ...otherCustomers]);
  };

  if (error) return <p className="error">{error}</p>;

  const generateServingListText = () => {
    let text = "";

    THALI_TYPE_SUPPORTED.forEach((thaliType) => {
      const thaliCustomers = customers.filter((c) => c.thaliType === thaliType);

      if (thaliCustomers.length === 0) return;

      text += `*${thaliType}*\n`;

      thaliCustomers.forEach((c, index) => {
        text += `${index + 1}. ${c.name}`;

        const displayCustomization = getDisplayedCustomization(
          c.customisation,
          isFullRiceMeal,
        );

        if (displayCustomization) {
          text += ` - ${displayCustomization}`;
        }

        if (c.poster) {
          text += ` - Poster`;
        }

        text += "\n";
      });

      text += "\n";
    });

    return text;
  };

  return (
    <div className="app">
      <div className="header">
        {/* Toggle Meal Type */}
        <div className="header-left">
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
        <div className="header-right">
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: isFetchAllCustomers ? "not-allowed" : "pointer",
              opacity: isFetchAllCustomers ? 0.5 : 1,
            }}
            onClick={() => {
              if (isFetchAllCustomers) return;
              setIsNonVegView((v) => !v);
            }}
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
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
            }}
            onClick={() => setIsFullRiceMeal((v) => !v)}
          >
            <span>Full Rice Meal</span>

            <div
              role="switch"
              aria-checked={isFullRiceMeal}
              style={{
                width: 52,
                height: 28,
                borderRadius: 999,
                background: isFullRiceMeal ? "#2196F3" : "#cfd8dc",
                position: "relative",
                transition: "background 0.2s ease",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: isFullRiceMeal ? 26 : 3,
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
            disabled={fetching || isFetchAllCustomers}
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
                  `${API_URL}/customers/serve/publish`,
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

          <button
            style={{
              ...buttonStyle,
              background: "#9C27B0",
              color: "white",
            }}
            onClick={prepareServingList}
            disabled={fetching}
          >
            ✨ Organize List
          </button>
          <button
            className="fixed-cancellations-btn"
            onClick={applyTemplates}
            disabled={fetching || isFetchAllCustomers}
          >
            🚫 Apply Templates
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
                                } ${
                                  customer.dailyCustomization
                                    ? "daily-change"
                                    : ""
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
                                      {getDisplayedCustomization(
                                        customer.customisation,
                                        isFullRiceMeal,
                                      )
                                        ? `- ${getDisplayedCustomization(
                                            customer.customisation,
                                            isFullRiceMeal,
                                          )}`
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
                              {getDisplayedCustomization(
                                c.customisation,
                                isFullRiceMeal,
                              )
                                ? `- ${getDisplayedCustomization(
                                    c.customisation,
                                    isFullRiceMeal,
                                  )}`
                                : ""}
                              {c.poster ? `- Poster` : ""}
                            </li>
                          ))}
                      </ol>
                    </>
                  ),
              )}
            </div>
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
                className="btn"
                style={{
                  background: "#25D366",
                  color: "white",
                }}
                onClick={() => {
                  const message = generateServingListText();

                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(message)}`,
                    "_blank",
                  );
                }}
              >
                💬 WhatsApp
              </button>

              <button
                className="btn"
                onClick={() => {
                  navigator.clipboard.writeText(generateServingListText());
                  alert("Copied!");
                }}
              >
                📋 Copy
              </button>

              <button
                className="btn close-btn"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
