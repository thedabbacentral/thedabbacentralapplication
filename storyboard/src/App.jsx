import { BrowserRouter, Routes, Route } from "react-router-dom";
import StoryBoard from "./components/StoryBoard";
import StoryBoard2 from "./components/StoryBoard2";

import { useState } from "react";

function App() {
  const [isPublish, setIsPublish] = useState(false);
  const [isFetchAllCustomers, setIsFetchAllCustomers] = useState(false);
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1>Kanban Story Board</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
            }}
            onClick={() => setIsFetchAllCustomers((v) => !v)}
          >
            <span>Fetch All Customers</span>
            <div
              role="switch"
              aria-checked={isFetchAllCustomers}
              style={{
                width: 52,
                height: 28,
                borderRadius: 999,
                background: isFetchAllCustomers ? "#2196F3" : "#cfd8dc",
                position: "relative",
                transition: "background 0.2s ease",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: isFetchAllCustomers ? 26 : 3,
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
            onClick={() => setIsPublish((v) => !v)}
          >
            <span>Publish</span>
            <div
              role="switch"
              aria-checked={isPublish}
              style={{
                width: 52,
                height: 28,
                borderRadius: 999,
                background: isPublish ? "#2196F3" : "#cfd8dc",
                position: "relative",
                transition: "background 0.2s ease",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: isPublish ? 26 : 3,
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
          {window.location.pathname !== "/delivery" ? (
            <button
              className="btn route-btn"
              style={{
                background: "#28a745",
                "&:hover": { background: "#1e7e34" },
              }}
              onClick={() => (window.location.href = "/delivery")}
            >
              Open delivery list
            </button>
          ) : (
            <button
              className="btn route-btn"
              style={{
                background: "#28a745",
                "&:hover": { background: "#1e7e34" },
              }}
              onClick={() => (window.location.href = "/")}
            >
              Open serving list
            </button>
          )}
        </div>
      </div>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <StoryBoard2
                isPublish={isPublish}
                isFetchAllCustomers={isFetchAllCustomers}
              />
            }
          />
          <Route
            path="/delivery"
            element={
              <StoryBoard
                isPublish={isPublish}
                isFetchAllCustomers={isFetchAllCustomers}
              />
            }
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
