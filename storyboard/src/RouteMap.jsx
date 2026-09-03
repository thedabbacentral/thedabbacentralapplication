import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Popup,
  CircleMarker,
  Tooltip,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ---------------------------------------------------------
// Leaflet marker icon
// ---------------------------------------------------------

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ---------------------------------------------------------
// KITCHEN LOCATION
// ---------------------------------------------------------
// coordinates.

const KITCHEN_LOCATION = {
  lat: 12.907395553360235,
  lng: 77.60474376556127,
};

// ---------------------------------------------------------
// Different colour for every route
// ---------------------------------------------------------

const ROUTE_COLORS = [
  "#e53935",
  "#1e88e5",
  "#43a047",
  "#8e24aa",
  "#fb8c00",
  "#00897b",
  "#6d4c41",
  "#3949ab",
  "#d81b60",
  "#00acc1",
];

// ---------------------------------------------------------
// Fit map around visible locations
// ---------------------------------------------------------

const FitBounds = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    const bounds = L.latLngBounds(points);

    map.fitBounds(bounds, {
      padding: [80, 80],
    });
  }, [points, map]);

  return null;
};

// ---------------------------------------------------------
// RouteMap
// ---------------------------------------------------------

const RouteMap = ({ routes, visibleRoutes = {}, onToggleRoute }) => {
  const [roadRoutes, setRoadRoutes] = useState({});

  // -------------------------------------------------------
  // Only routes that are currently visible
  // -------------------------------------------------------

  const visibleRouteEntries = Object.entries(routes || {}).filter(
    ([routeName]) => visibleRoutes[routeName] !== false,
  );

  // -------------------------------------------------------
  // Get all points for visible routes
  // -------------------------------------------------------

  const allPoints = [];

  visibleRouteEntries.forEach(([routeName, cards]) => {
    cards.forEach((card) => {
      card.customers?.forEach((customer) => {
        if (
          typeof customer.lat === "number" &&
          typeof customer.lng === "number"
        ) {
          allPoints.push([customer.lat, customer.lng]);
        }
      });
    });
  });

  // -------------------------------------------------------
  // Calculate each route separately using OSRM
  // -------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const calculateRoutes = async () => {
      const calculatedRoutes = {};

      // Clear old lines immediately
      setRoadRoutes({});

      for (const [routeName, cards] of visibleRouteEntries) {
        // Unassigned should only show points
        if (routeName === "Unassigned") {
          continue;
        }

        // -----------------------------------------------
        // Get customers ONLY from this route
        // -----------------------------------------------

        const customers = [];

        cards.forEach((card) => {
          card.customers?.forEach((customer) => {
            if (
              typeof customer.lat === "number" &&
              typeof customer.lng === "number"
            ) {
              customers.push(customer);
            }
          });
        });

        // Need at least 2 stops for a road route
        if (customers.length < 2) {
          continue;
        }

        // -----------------------------------------------
        // Preserve current card/customer order
        // -----------------------------------------------

        const coordinates = [
          `${KITCHEN_LOCATION.lng},${KITCHEN_LOCATION.lat}`,
          ...customers.map((customer) => `${customer.lng},${customer.lat}`),
        ].join(";");

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${coordinates}` +
          `?overview=full&geometries=geojson`;

        try {
          console.log(
            `🚚 OSRM calculating: ${routeName} (${customers.length} stops)`,
          );

          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`OSRM HTTP ${response.status}`);
          }

          const data = await response.json();

          if (data.code === "Ok" && data.routes?.length) {
            const geometry = data.routes[0].geometry.coordinates.map(
              ([lng, lat]) => [lat, lng],
            );

            calculatedRoutes[routeName] = {
              geometry,
              customers,
            };

            console.log(
              `✅ Route calculated: ${routeName} (${customers.length} stops)`,
            );
          } else {
            console.warn(`⚠️ OSRM returned no route for ${routeName}`);
          }
        } catch (error) {
          console.error(`❌ OSRM failed for ${routeName}`, error);

          // ------------------------------------------------
          // FALLBACK:
          // Draw a straight line through the stops.
          // This ensures the route is still visible even
          // when OSRM fails.
          // ------------------------------------------------

          calculatedRoutes[routeName] = {
            geometry: customers.map((customer) => [customer.lat, customer.lng]),
            customers,
            fallback: true,
          };
        }
      }

      if (!cancelled) {
        setRoadRoutes(calculatedRoutes);
      }
    };

    calculateRoutes();

    return () => {
      cancelled = true;
    };
  }, [routes, visibleRoutes]);

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "600px",
        marginTop: "20px",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <MapContainer
        center={[12.9716, 77.5946]}
        zoom={12}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={allPoints} />

        {/* ================================================= */}
        {/* MARKERS                                           */}
        {/* ================================================= */}

        {visibleRouteEntries.map(([routeName, cards], routeIndex) => {
          const routeColor = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];

          let stopNumber = 1;

          return cards.flatMap((card) =>
            (card.customers || [])
              .filter(
                (customer) =>
                  typeof customer.lat === "number" &&
                  typeof customer.lng === "number",
              )
              .map((customer) => {
                const currentStop = stopNumber++;

                return (
                  <CircleMarker
                    key={`${routeName}-${customer.id}`}
                    center={[customer.lat, customer.lng]}
                    radius={8}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 2,
                      fillColor: routeColor,
                      fillOpacity: 1,
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -8]}>
                      {currentStop}. {customer.name}
                    </Tooltip>

                    <Popup>
                      <strong>{routeName}</strong>
                      <br />
                      Stop {currentStop}
                      <br />
                      {customer.name}
                    </Popup>
                  </CircleMarker>
                );
              }),
          );
        })}

        {/* ================================================= */}
        {/* ROAD ROUTES                                       */}
        {/* ================================================= */}

        {Object.entries(roadRoutes).map(([routeName, routeData]) => {
          // Find the route's ORIGINAL index so that
          // colours remain consistent.
          const routeIndex = Object.keys(routes || {}).indexOf(routeName);

          const routeColor =
            ROUTE_COLORS[
              (routeIndex >= 0 ? routeIndex : 0) % ROUTE_COLORS.length
            ];

          return (
            <Polyline
              key={routeName}
              positions={routeData.geometry}
              pathOptions={{
                color: routeColor,
                weight: 6,
                opacity: 0.85,
              }}
            />
          );
        })}
      </MapContainer>

      {/* ================================================= */}
      {/* ROUTE LEGEND / VISIBILITY CONTROL                 */}
      {/* TOP LEFT OF MAP                                   */}
      {/* ================================================= */}

      <div
        style={{
          position: "absolute",
          top: "15px",
          left: "15px",
          width: "230px",
          maxHeight: "calc(100% - 30px)",
          overflowY: "auto",
          background: "rgba(255,255,255,0.96)",
          padding: "12px",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
          zIndex: 1000,
        }}
      >
        <strong
          style={{
            display: "block",
            marginBottom: "10px",
          }}
        >
          Delivery Routes
        </strong>

        {Object.keys(routes || {}).map((routeName, index) => {
          const routeColor = ROUTE_COLORS[index % ROUTE_COLORS.length];

          const isVisible = visibleRoutes[routeName] !== false;

          return (
            <label
              key={routeName}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "7px",
                fontSize: "13px",
                cursor: "pointer",
                opacity: isVisible ? 1 : 0.45,
              }}
            >
              <input
                type="checkbox"
                checked={isVisible}
                onChange={() => onToggleRoute?.(routeName)}
                style={{
                  marginRight: "7px",
                  cursor: "pointer",
                }}
              />

              <span
                style={{
                  width: "18px",
                  height: "5px",
                  background: isVisible ? routeColor : "#aaa",
                  display: "inline-block",
                  marginRight: "7px",
                  borderRadius: "3px",
                }}
              />

              {routeName}
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default RouteMap;
