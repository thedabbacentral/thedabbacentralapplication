import StoryBoard from "./components/StoryBoard";
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
        </div>
      </div>
      <StoryBoard
        isPublish={isPublish}
        isFetchAllCustomers={isFetchAllCustomers}
      />
    </div>
  );
}

export default App;
