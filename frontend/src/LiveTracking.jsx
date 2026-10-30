import { useEffect, useRef, useState } from "react";
import axios from "axios";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

// =====================================================
// LEAFLET ICON FIX
// =====================================================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// =====================================================
// DRIVER ICON
// =====================================================

const driverIcon = L.divIcon({
  className: "live-driver-marker",
  html: `
    <div style="
      width:34px;
      height:34px;
      border-radius:50%;
      background:#00ffc8;
      border:3px solid #061316;
      box-shadow:0 0 18px #00ffc8;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#061316;
      font-size:17px;
      font-weight:bold;
    ">🚚</div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// =====================================================
// PICKUP ICON
// =====================================================

const pickupIcon = L.divIcon({
  className: "tracking-stop-marker",
  html: `
    <div style="
      width:30px;
      height:30px;
      border-radius:50%;
      background:#00ffc8;
      border:3px solid #071719;
      box-shadow:0 0 15px rgba(0,255,200,.7);
      display:flex;
      align-items:center;
      justify-content:center;
      color:#071719;
      font-weight:bold;
      font-size:13px;
    ">P</div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// =====================================================
// DELIVERY ICON
// =====================================================

const deliveryIcon = L.divIcon({
  className: "tracking-stop-marker",
  html: `
    <div style="
      width:30px;
      height:30px;
      border-radius:50%;
      background:#66ff88;
      border:3px solid #071719;
      box-shadow:0 0 15px rgba(102,255,136,.7);
      display:flex;
      align-items:center;
      justify-content:center;
      color:#071719;
      font-weight:bold;
      font-size:13px;
    ">D</div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// =====================================================
// MAP FOLLOWER
// =====================================================

function MapFollower({ position, followDriver }) {
  const map = useMap();

  useEffect(() => {
    if (position && followDriver) {
      map.setView(position, map.getZoom(), {
        animate: true,
      });
    }
  }, [position, followDriver, map]);

  return null;
}

// =====================================================
// GEOCODING
// =====================================================

async function geocodeAddress(address) {
  if (!address) return null;

  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: address,
          format: "json",
          limit: 1,
        },
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.data || response.data.length === 0) {
      return null;
    }

    return [
      Number(response.data[0].lat),
      Number(response.data[0].lon),
    ];
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// =====================================================
// ROAD ROUTE
// =====================================================

async function getRoadRoute(coordinates) {
  if (!coordinates || coordinates.length < 2) {
    return [];
  }

  try {
    const coordinateString = coordinates
      .map((point) => `${point[1]},${point[0]}`)
      .join(";");

    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${coordinateString}`,
      {
        params: {
          overview: "full",
          geometries: "geojson",
        },
      }
    );

    if (
      !response.data ||
      !response.data.routes ||
      !response.data.routes[0]
    ) {
      return [];
    }

    return response.data.routes[0].geometry.coordinates.map(
      (point) => [point[1], point[0]]
    );
  } catch (error) {
    console.error("OSRM routing error:", error);
    return [];
  }
}

// =====================================================
// DISTANCE
// =====================================================

function calculateDistance(point1, point2) {
  if (!point1 || !point2) {
    return Infinity;
  }

  const lat1 = point1[0] * (Math.PI / 180);
  const lat2 = point2[0] * (Math.PI / 180);

  const deltaLat =
    (point2[0] - point1[0]) * (Math.PI / 180);

  const deltaLon =
    (point2[1] - point1[1]) * (Math.PI / 180);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return 6371 * c;
}

// =====================================================
// NEAREST ROUTE INDEX
// =====================================================

function findNearestRouteIndex(stop, route) {
  if (!stop || !route || route.length === 0) {
    return 0;
  }

  let nearestIndex = 0;
  let nearestDistance = Infinity;

  route.forEach((point, index) => {
    const distance = calculateDistance(stop, point);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

// =====================================================
// LIVE TRACKING
// =====================================================

function LiveTracking({ selectedOrderId }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [stops, setStops] = useState([]);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  const [tracking, setTracking] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [progress, setProgress] = useState(0);
  const [routeIndex, setRouteIndex] = useState(0);
  const [stopIndex, setStopIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState("");

  const [followDriver, setFollowDriver] = useState(true);

  const intervalRef = useRef(null);

  const routeIndexRef = useRef(0);
  const stopIndexRef = useRef(0);

  const processedStopsRef = useRef(new Set());
  const stopRouteIndexesRef = useRef([]);

  const routeRef = useRef([]);

  // ===================================================
  // LOAD ORDERS
  // ===================================================

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);

        const response = await axios.get(
          "http://localhost:5000/api/orders"
        );

        setOrders(response.data || []);
        setError("");
      } catch (error) {
        console.error(error);
        setError(
          "Could not connect to the Route Share backend."
        );
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  // ===================================================
  // SELECT ORDER
  // ===================================================

  useEffect(() => {
    if (!orders.length) {
      setSelectedOrder(null);
      return;
    }

    let order = null;

    if (selectedOrderId) {
      order =
        orders.find(
          (item) => item._id === selectedOrderId
        ) || null;
    }

    if (!order) {
      order =
        orders.find(
          (item) =>
            item.status === "Picked Up" ||
            item.status === "Out for Delivery"
        ) || null;
    }

    if (!order) {
      order = orders[0];
    }

    setSelectedOrder(order);
  }, [orders, selectedOrderId]);

  // ===================================================
  // BUILD ROUTE
  // ===================================================

  useEffect(() => {
    if (!selectedOrder) return;

    let cancelled = false;

    const buildRoute = async () => {
      setRouteLoading(true);
      setError("");

      try {
        const pickup = await geocodeAddress(
          selectedOrder.pickup
        );

        const delivery = await geocodeAddress(
          selectedOrder.delivery
        );

        if (cancelled) return;

        if (!pickup || !delivery) {
          setError(
            "Could not locate the pickup or delivery address."
          );

          setRouteLoading(false);
          return;
        }

        const newStops = [
          {
            id: `${selectedOrder._id}-pickup`,
            orderId: selectedOrder._id,
            type: "Pickup",
            address: selectedOrder.pickup,
            coords: pickup,
            customer: selectedOrder.customer,
          },
          {
            id: `${selectedOrder._id}-delivery`,
            orderId: selectedOrder._id,
            type: "Delivery",
            address: selectedOrder.delivery,
            coords: delivery,
            customer: selectedOrder.customer,
          },
        ];

        setStops(newStops);

        const roadRoute =
          await getRoadRoute([
            pickup,
            delivery,
          ]);

        if (cancelled) return;

        if (!roadRoute.length) {
          setError(
            "Could not create the road route."
          );

          setRouteLoading(false);
          return;
        }

        routeRef.current = roadRoute;
        setRouteCoordinates(roadRoute);

        const stopIndexes = newStops.map(
          (stop) =>
            findNearestRouteIndex(
              stop.coords,
              roadRoute
            )
        );

        stopRouteIndexesRef.current =
          stopIndexes;

        // =============================================
        // RESTORE SAVED TRACKING
        // =============================================

        let saved = null;

        try {
          const stored = localStorage.getItem(
            "routeShareMultiTracking"
          );

          if (stored) {
            saved = JSON.parse(stored);
          }
        } catch (error) {
          console.error(
            "Could not read saved tracking:",
            error
          );
        }

        if (
          saved &&
          saved.orderId === selectedOrder._id
        ) {
          const savedRouteIndex = Math.min(
            Math.max(
              Number(saved.routeIndex) || 0,
              0
            ),
            roadRoute.length - 1
          );

          routeIndexRef.current =
            savedRouteIndex;

          setRouteIndex(
            savedRouteIndex
          );

          const savedStopIndex = Math.min(
            Math.max(
              Number(saved.stopIndex) || 0,
              0
            ),
            newStops.length - 1
          );

          stopIndexRef.current =
            savedStopIndex;

          setStopIndex(
            savedStopIndex
          );

          const processed =
            Array.isArray(saved.processedStops)
              ? saved.processedStops
              : [];

          processedStopsRef.current =
            new Set(processed);

          const savedProgress = Math.min(
            Math.max(
              Number(saved.progress) || 0,
              0
            ),
            100
          );

          setProgress(savedProgress);

          setCompleted(
            Boolean(saved.completed)
          );

          // IMPORTANT:
          // Always open in paused state.
          // User can press Continue Tracking.
          setTracking(false);
        } else {
          routeIndexRef.current = 0;
          stopIndexRef.current = 0;

          processedStopsRef.current =
            new Set();

          setRouteIndex(0);
          setStopIndex(0);
          setProgress(0);
          setCompleted(false);
          setTracking(false);
        }
      } catch (error) {
        console.error(
          "Route preparation error:",
          error
        );

        if (!cancelled) {
          setError(
            "Unable to prepare the live tracking route."
          );
        }
      } finally {
        if (!cancelled) {
          setRouteLoading(false);
        }
      }
    };

    buildRoute();

    return () => {
      cancelled = true;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [selectedOrder]);

  // ===================================================
  // SAVE TRACKING
  // ===================================================

  const saveTracking = (
    isTracking,
    isCompleted,
    currentProgress = progress
  ) => {
    if (!selectedOrder) return;

    const data = {
      orderId: selectedOrder._id,
      routeIndex: routeIndexRef.current,
      stopIndex: stopIndexRef.current,
      progress: currentProgress,
      tracking: isTracking,
      completed: isCompleted,
      processedStops: Array.from(
        processedStopsRef.current
      ),
      updatedAt: Date.now(),
    };

    localStorage.setItem(
      "routeShareMultiTracking",
      JSON.stringify(data)
    );
  };

  // ===================================================
  // UPDATE ORDER STATUS
  // ===================================================

  const updateOrderStatus = async (status) => {
    if (!selectedOrder) return;

    try {
      await axios.put(
        `http://localhost:5000/api/orders/${selectedOrder._id}/status`,
        { status }
      );

      setSelectedOrder((current) =>
        current
          ? {
              ...current,
              status,
            }
          : current
      );

      setOrders((current) =>
        current.map((order) =>
          order._id === selectedOrder._id
            ? {
                ...order,
                status,
              }
            : order
        )
      );
    } catch (error) {
      console.error(
        "Order status update failed:",
        error
      );
    }
  };

  // ===================================================
  // PROCESS STOP
  // ===================================================

  const processStop = async (stop) => {
    if (!stop) return;

    if (
      processedStopsRef.current.has(
        stop.id
      )
    ) {
      return;
    }

    // Do not process delivery before pickup.
    if (
      stop.type === "Delivery" &&
      !processedStopsRef.current.has(
        `${selectedOrder._id}-pickup`
      )
    ) {
      return;
    }

    try {
      if (stop.type === "Pickup") {
        await updateOrderStatus(
          "Picked Up"
        );
      }

      if (stop.type === "Delivery") {
        await updateOrderStatus(
          "Delivered"
        );
      }

      processedStopsRef.current.add(
        stop.id
      );

      const index = stops.findIndex(
        (item) => item.id === stop.id
      );

      if (index >= 0) {
        const nextIndex = Math.min(
          index + 1,
          stops.length - 1
        );

        stopIndexRef.current =
          nextIndex;

        setStopIndex(nextIndex);
      }
    } catch (error) {
      console.error(
        "Stop processing error:",
        error
      );
    }
  };

  // ===================================================
  // TRACKING TIMER
  // ===================================================

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!tracking) return;
    if (completed) return;
    if (routeRef.current.length < 2) return;
    if (!selectedOrder) return;

    intervalRef.current =
      setInterval(async () => {
        const route = routeRef.current;

        if (!route.length) return;

        let current =
          routeIndexRef.current;

        // =============================================
        // FINISH ROUTE
        // =============================================

        if (
          current >=
          route.length - 1
        ) {
          routeIndexRef.current =
            route.length - 1;

          setRouteIndex(
            route.length - 1
          );

          setProgress(100);
          setTracking(false);
          setCompleted(true);

          await updateOrderStatus(
            "Delivered"
          );

          saveTracking(
            false,
            true,
            100
          );

          return;
        }

        // =============================================
        // MOVE DRIVER
        // =============================================

        current += 1;

        routeIndexRef.current =
          current;

        setRouteIndex(current);

        const newProgress = Math.round(
          (current /
            (route.length - 1)) *
            100
        );

        setProgress(
          newProgress
        );

        // =============================================
        // CHECK STOPS
        // =============================================

        for (
          let i = 0;
          i < stops.length;
          i++
        ) {
          const stop = stops[i];

          if (
            processedStopsRef.current.has(
              stop.id
            )
          ) {
            continue;
          }

          const stopRouteIndex =
            stopRouteIndexesRef.current[
              i
            ];

          if (
            typeof stopRouteIndex ===
              "number" &&
            current >=
              stopRouteIndex
          ) {
            await processStop(stop);
          }
        }

        saveTracking(
          true,
          false,
          newProgress
        );
      }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(
          intervalRef.current
        );

        intervalRef.current = null;
      }
    };
  }, [
    tracking,
    completed,
    selectedOrder,
    stops,
  ]);

  // ===================================================
  // PAUSE
  // ===================================================

  const pauseTracking = () => {
    if (intervalRef.current) {
      clearInterval(
        intervalRef.current
      );

      intervalRef.current = null;
    }

    setTracking(false);

    saveTracking(
      false,
      false,
      progress
    );
  };

  // ===================================================
  // CONTINUE
  // ===================================================

  const continueTracking = () => {
    if (completed) {
      alert(
        "This delivery has already been completed."
      );
      return;
    }

    if (routeRef.current.length < 2) {
      alert(
        "Please wait until the road route is ready."
      );
      return;
    }

    if (
      routeIndexRef.current >=
      routeRef.current.length - 1
    ) {
      alert(
        "The driver has reached the end of the route."
      );
      return;
    }

    // Save current position first.
    saveTracking(
      true,
      false,
      progress
    );

    // This starts the timer.
    setTracking(true);
  };

  // ===================================================
  // RESET
  // ===================================================

  const resetTracking = () => {
    if (intervalRef.current) {
      clearInterval(
        intervalRef.current
      );

      intervalRef.current = null;
    }

    routeIndexRef.current = 0;
    stopIndexRef.current = 0;

    processedStopsRef.current =
      new Set();

    setRouteIndex(0);
    setStopIndex(0);
    setProgress(0);
    setTracking(false);
    setCompleted(false);

    localStorage.removeItem(
      "routeShareMultiTracking"
    );
  };

  // ===================================================
  // POSITIONS
  // ===================================================

  const driverPosition =
    routeCoordinates.length > 0
      ? routeCoordinates[
          Math.min(
            routeIndex,
            routeCoordinates.length - 1
          )
        ]
      : null;

  const currentStop =
    stops.length > 0
      ? stops[
          Math.min(
            stopIndex,
            stops.length - 1
          )
        ]
      : null;

  const nextStop =
    stops.length > 0 &&
    stopIndex < stops.length - 1
      ? stops[stopIndex + 1]
      : null;

  const mapCenter =
    driverPosition ||
    (stops.length
      ? stops[0].coords
      : [16.5062, 80.648]);

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <main className="dashboard">
        <div className="cyber-header">
          <div>
            <h1>
              LIVE DELIVERY TRACKING
            </h1>

            <p>
              LOADING DELIVERY NETWORK
            </p>
          </div>

          <div className="system-status">
            ● CONNECTING
          </div>
        </div>

        <div className="empty-module">
          <div className="module-icon">
            ◉
          </div>

          <h3>
            LOADING TRACKING DATA
          </h3>

          <p>
            Preparing live delivery tracking.
          </p>
        </div>
      </main>
    );
  }

  // ===================================================
  // NO ORDER
  // ===================================================

  if (!selectedOrder) {
    return (
      <main className="dashboard">
        <div className="cyber-header">
          <div>
            <h1>
              LIVE DELIVERY TRACKING
            </h1>

            <p>
              REAL-TIME DRIVER MONITORING
            </p>
          </div>

          <div className="system-status">
            ● TRACKING ONLINE
          </div>
        </div>

        <div className="empty-module">
          <div className="module-icon">
            ◉
          </div>

          <h3>
            NO DELIVERY AVAILABLE
          </h3>

          <p>
            Create a delivery order to start
            tracking.
          </p>
        </div>
      </main>
    );
  }

  // ===================================================
  // MAIN PAGE
  // ===================================================

  return (
    <main className="dashboard">
      <div className="cyber-header">
        <div>
          <h1>
            LIVE DELIVERY TRACKING
          </h1>

          <p>
            REAL-TIME DRIVER MONITORING //
            ROAD ROUTE
          </p>
        </div>

        <div className="system-status">
          {tracking
            ? "● TRACKING LIVE"
            : completed
            ? "● DELIVERY COMPLETE"
            : "● TRACKING PAUSED"}
        </div>
      </div>

      {/* ORDER SELECTOR */}

      <div className="tracking-selector">
        <div>
          <small>
            TRACKING ORDER
          </small>

          <select
            value={selectedOrder._id}
            onChange={(e) => {
              const order =
                orders.find(
                  (item) =>
                    item._id ===
                    e.target.value
                );

              if (!order) return;

              if (intervalRef.current) {
                clearInterval(
                  intervalRef.current
                );

                intervalRef.current = null;
              }

              setTracking(false);
              setCompleted(false);

              setSelectedOrder(order);
            }}
          >
            {orders.map((order) => (
              <option
                key={order._id}
                value={order._id}
              >
                {order.customer} —{" "}
                {order.status}
              </option>
            ))}
          </select>
        </div>

        <div className="tracking-order-info">
          <strong>
            {selectedOrder.customer}
          </strong>

          <span>
            {selectedOrder.driverName ||
              "Driver not assigned"}
          </span>
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div
          className="tracking-error"
          style={{
            marginTop: "15px",
            padding: "12px 16px",
            border:
              "1px solid rgba(255,80,80,.35)",
            borderRadius: "8px",
            color: "#ff8c8c",
            background:
              "rgba(255,50,50,.05)",
          }}
        >
          {error}
        </div>
      )}

      {/* SUMMARY */}

      <div className="tracking-summary">
        <div className="tracking-stat">
          <span>ORDER</span>
          <strong>
            #{selectedOrder._id.slice(-6)}
          </strong>
        </div>

        <div className="tracking-stat">
          <span>DRIVER</span>
          <strong>
            {selectedOrder.driverName ||
              "Not Assigned"}
          </strong>
        </div>

        <div className="tracking-stat">
          <span>STATUS</span>
          <strong>
            {selectedOrder.status}
          </strong>
        </div>

        <div className="tracking-stat">
          <span>PROGRESS</span>
          <strong>
            {progress}%
          </strong>
        </div>
      </div>

      {/* MAP */}

      <div
        className="tracking-map-container"
        style={{
          height: "500px",
          marginTop: "20px",
          borderRadius: "10px",
          overflow: "hidden",
          border:
            "1px solid rgba(0,255,200,.18)",
        }}
      >
        {routeLoading ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#071113",
              color: "#00ffc8",
            }}
          >
            LOADING ROAD ROUTE...
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{
              height: "100%",
              width: "100%",
            }}
          >
            <TileLayer
              attribution="© OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapFollower
              position={driverPosition}
              followDriver={followDriver}
            />

            {routeCoordinates.length >
              1 && (
              <Polyline
                positions={
                  routeCoordinates
                }
                pathOptions={{
                  color: "#00ffc8",
                  weight: 5,
                  opacity: 0.75,
                }}
              />
            )}

            {driverPosition && (
              <Marker
                position={
                  driverPosition
                }
                icon={driverIcon}
              >
                <Popup>
                  <strong>
                    {selectedOrder.driverName ||
                      "Driver"}
                  </strong>

                  <br />

                  Live position
                </Popup>
              </Marker>
            )}

            {stops.map(
              (stop, index) => (
                <Marker
                  key={stop.id}
                  position={stop.coords}
                  icon={
                    stop.type ===
                    "Pickup"
                      ? pickupIcon
                      : deliveryIcon
                  }
                >
                  <Popup>
                    <strong>
                      Stop {index + 1}
                    </strong>

                    <br />

                    {stop.type}

                    <br />

                    {stop.address}
                  </Popup>
                </Marker>
              )
            )}
          </MapContainer>
        )}
      </div>

      {/* FOLLOW */}

      <div
        style={{
          marginTop: "12px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={() =>
            setFollowDriver(
              (current) => !current
            )
          }
          style={{
            padding: "9px 15px",
            border:
              "1px solid rgba(0,255,200,.25)",
            background: followDriver
              ? "rgba(0,255,200,.1)"
              : "rgba(255,255,255,.03)",
            color: "#dffefe",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          {followDriver
            ? "FOLLOW DRIVER: ON"
            : "FOLLOW DRIVER: OFF"}
        </button>
      </div>

      {/* STOPS */}

      <div className="tracking-stop-grid">
        <div className="tracking-stop-card">
          <small>
            CURRENT STOP
          </small>

          <h3>
            {currentStop
              ? currentStop.type
              : "Waiting"}
          </h3>

          <p>
            {currentStop
              ? currentStop.address
              : "No current stop"}
          </p>
        </div>

        <div className="tracking-stop-card">
          <small>
            NEXT STOP
          </small>

          <h3>
            {nextStop
              ? nextStop.type
              : "Final Destination"}
          </h3>

          <p>
            {nextStop
              ? nextStop.address
              : selectedOrder.delivery}
          </p>
        </div>
      </div>

      {/* PROGRESS */}

      <div
        style={{
          marginTop: "20px",
          padding: "20px",
          border:
            "1px solid rgba(0,255,200,.14)",
          borderRadius: "10px",
          background:
            "rgba(0,255,200,.025)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            marginBottom: "10px",
          }}
        >
          <span>
            DELIVERY PROGRESS
          </span>

          <strong>
            {progress}%
          </strong>
        </div>

        <div
          style={{
            height: "9px",
            background:
              "rgba(255,255,255,.08)",
            borderRadius: "20px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "#00ffc8",
              boxShadow:
                "0 0 12px rgba(0,255,200,.7)",
              transition:
                "width .3s ease",
            }}
          />
        </div>
      </div>

      {/* CONTROLS */}

      <div className="tracking-controls">
        {!completed ? (
          tracking ? (
            <button
              onClick={pauseTracking}
            >
              ⏸ PAUSE TRACKING
            </button>
          ) : (
            <button
              onClick={continueTracking}
            >
              ▶ CONTINUE TRACKING
            </button>
          )
        ) : (
          <button
            disabled
            style={{
              opacity: 0.6,
              cursor: "not-allowed",
            }}
          >
            ✓ DELIVERY COMPLETED
          </button>
        )}

        <button
          onClick={resetTracking}
        >
          ↻ RESET TRACKING
        </button>
      </div>

      {/* STOP SEQUENCE */}

      <div
        style={{
          marginTop: "25px",
        }}
      >
        <div className="dashboard-panel-header">
          <div>
            <h2>
              DELIVERY STOP SEQUENCE
            </h2>

            <p>
              ROUTE PROGRESS
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: "10px",
            marginTop: "15px",
          }}
        >
          {stops.map(
            (stop, index) => {
              const processed =
                processedStopsRef.current.has(
                  stop.id
                );

              const active =
                index === stopIndex;

              return (
                <div
                  key={stop.id}
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: "15px",
                    padding: "14px",
                    border: active
                      ? "1px solid rgba(0,255,200,.4)"
                      : "1px solid rgba(255,255,255,.08)",
                    borderRadius: "8px",
                    background: active
                      ? "rgba(0,255,200,.06)"
                      : "rgba(255,255,255,.02)",
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      background:
                        processed
                          ? "#00ffc8"
                          : active
                          ? "rgba(0,255,200,.15)"
                          : "rgba(255,255,255,.08)",
                      color: processed
                        ? "#071113"
                        : "#dffefe",
                      fontWeight: "bold",
                    }}
                  >
                    {processed
                      ? "✓"
                      : index + 1}
                  </div>

                  <div>
                    <strong>
                      {stop.type}
                    </strong>

                    <p
                      style={{
                        margin:
                          "4px 0 0",
                        fontSize: "12px",
                        opacity: 0.7,
                      }}
                    >
                      {stop.address}
                    </p>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>
    </main>
  );
}

export default LiveTracking;