import { useEffect, useState } from "react";
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

const defaultCenter = [17.385, 78.4867];

function MapUpdater({ center }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, 12);
    }
  }, [center, map]);

  return null;
}

function calculateDistance(point1, point2) {
  const lat1 = point1[0];
  const lon1 = point1[1];

  const lat2 = point2[0];
  const lon2 = point2[1];

  const earthRadius = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}

function OptimizeRoute() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [selectedDriver, setSelectedDriver] =
    useState("");

  const [selectedOrders, setSelectedOrders] =
    useState([]);

  const [coordinates, setCoordinates] =
    useState([]);

  const [route, setRoute] = useState([]);

  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [optimized, setOptimized] =
    useState(false);

  useEffect(() => {
    loadOrders();
    loadDrivers();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/orders"
      );

      setOrders(response.data);
    } catch (error) {
      console.error(
        "Could not load orders:",
        error
      );

      setError("Could not load orders.");
    }
  };

  const loadDrivers = async () => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/drivers"
      );

      setDrivers(response.data);
    } catch (error) {
      console.error(
        "Could not load drivers:",
        error
      );
    }
  };

  const toggleOrder = (id) => {
    setSelectedOrders((current) => {
      if (current.includes(id)) {
        return current.filter(
          (item) => item !== id
        );
      }

      return [...current, id];
    });

    setRoute([]);
    setCoordinates([]);
    setOptimized(false);
    setDistance(0);
    setDuration(0);
  };

  const geocodeAddress = async (address) => {
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

      if (
        !response.data ||
        response.data.length === 0
      ) {
        return null;
      }

      return [
        Number(response.data[0].lat),
        Number(response.data[0].lon),
      ];
    } catch (error) {
      console.error(
        "Geocoding error:",
        error
      );

      return null;
    }
  };

  const createStops = async () => {
    const stops = [];

    for (const orderId of selectedOrders) {
      const order = orders.find(
        (item) => item._id === orderId
      );

      if (!order) {
        continue;
      }

      const pickupCoords =
        await geocodeAddress(order.pickup);

      if (pickupCoords) {
        stops.push({
          id: `${order._id}-pickup`,
          orderId: order._id,
          order: order,
          type: "Pickup",
          address: order.pickup,
          coords: pickupCoords,
        });
      }

      const deliveryCoords =
        await geocodeAddress(
          order.delivery
        );

      if (deliveryCoords) {
        stops.push({
          id: `${order._id}-delivery`,
          orderId: order._id,
          order: order,
          type: "Delivery",
          address: order.delivery,
          coords: deliveryCoords,
        });
      }
    }

    return stops;
  };

  const optimizeStopSequence = (stops) => {
    const result = [];
    const remaining = [...stops];

    if (remaining.length === 0) {
      return [];
    }

    let currentPosition =
      remaining[0].coords;

    const firstPickup = remaining.find(
      (stop) => stop.type === "Pickup"
    );

    const firstStop =
      firstPickup || remaining[0];

    result.push(firstStop);

    remaining.splice(
      remaining.indexOf(firstStop),
      1
    );

    const completedPickups = new Set();

    if (firstStop.type === "Pickup") {
      completedPickups.add(
        firstStop.orderId
      );
    }

    while (remaining.length > 0) {
      let nearestStop = null;
      let nearestDistance = Infinity;

      for (const stop of remaining) {
        if (
          stop.type === "Delivery" &&
          !completedPickups.has(
            stop.orderId
          )
        ) {
          continue;
        }

        const stopDistance =
          calculateDistance(
            currentPosition,
            stop.coords
          );

        if (
          stopDistance <
          nearestDistance
        ) {
          nearestDistance =
            stopDistance;

          nearestStop = stop;
        }
      }

      if (!nearestStop) {
        nearestStop = remaining[0];
      }

      result.push(nearestStop);

      remaining.splice(
        remaining.indexOf(nearestStop),
        1
      );

      currentPosition =
        nearestStop.coords;

      if (
        nearestStop.type === "Pickup"
      ) {
        completedPickups.add(
          nearestStop.orderId
        );
      }
    }

    return result;
  };

  const calculateRoadRoute = async (
    stops
  ) => {
    const waypoints = stops
      .map(
        (stop) =>
          `${stop.coords[1]},${stop.coords[0]}`
      )
      .join(";");

    const url =
      `https://router.project-osrm.org/route/v1/driving/${waypoints}` +
      `?overview=full&geometries=geojson`;

    const response = await axios.get(url);

    if (
      !response.data.routes ||
      response.data.routes.length === 0
    ) {
      return null;
    }

    return response.data.routes[0];
  };

  /* =========================================
     ASSIGN DRIVER TO SELECTED ORDERS
  ========================================= */

  const assignDriverToOrders = async () => {
    const driver = drivers.find(
      (item) =>
        item._id === selectedDriver
    );

    if (!driver) {
      return;
    }

    for (const orderId of selectedOrders) {
      try {
        await axios.put(
          `http://localhost:5000/api/orders/${orderId}/assign-driver`,
          {
            driverId: driver._id,
            driverName: driver.name,
          }
        );
      } catch (error) {
        console.error(
          "Driver assignment error:",
          error
        );
      }
    }

    await loadOrders();
  };

  /* =========================================
     SAVE OPTIMIZED ROUTE
  ========================================= */

  const saveOptimizedRoute = (
    optimizedStops,
    driver
  ) => {
    const savedRoutes = JSON.parse(
      localStorage.getItem(
        "routeShareOptimizedRoutes"
      ) || "{}"
    );

    savedRoutes[driver._id] = {
      driverId: driver._id,
      driverName: driver.name,
      vehicle: driver.vehicle,

      stops: optimizedStops.map(
        (stop, index) => ({
          sequence: index + 1,
          id: stop.id,
          orderId: stop.orderId,
          type: stop.type,
          address: stop.address,
          coords: stop.coords,
          customer:
            stop.order?.customer || "",
        })
      ),

      distance: Number(distance) || 0,
      duration: Number(duration) || 0,

      createdAt:
        new Date().toISOString(),
    };

    localStorage.setItem(
      "routeShareOptimizedRoutes",
      JSON.stringify(savedRoutes)
    );
  };

  /* =========================================
     OPTIMIZE
  ========================================= */

  const optimizeRoute = async () => {
    setError("");
    setOptimized(false);

    if (!selectedDriver) {
      setError(
        "Please select a driver."
      );
      return;
    }

    if (selectedOrders.length === 0) {
      setError(
        "Please select at least one order."
      );
      return;
    }

    setLoading(true);

    try {
      const stops =
        await createStops();

      if (stops.length < 2) {
        setError(
          "Could not find enough valid locations."
        );

        setLoading(false);
        return;
      }

      const optimizedStops =
        optimizeStopSequence(stops);

      const roadRoute =
        await calculateRoadRoute(
          optimizedStops
        );

      if (!roadRoute) {
        setError(
          "Could not calculate the road route."
        );

        setLoading(false);
        return;
      }

      const routeCoordinates =
        roadRoute.geometry.coordinates.map(
          (point) => [
            point[1],
            point[0],
          ]
        );

      const calculatedDistance =
        (
          roadRoute.distance / 1000
        ).toFixed(2);

      const calculatedDuration =
        Math.round(
          roadRoute.duration / 60
        );

      setCoordinates(
        optimizedStops
      );

      setRoute(
        routeCoordinates
      );

      setDistance(
        calculatedDistance
      );

      setDuration(
        calculatedDuration
      );

      /* Assign selected driver */
      await assignDriverToOrders();

      /* Save exact optimized sequence */
      const driver = drivers.find(
        (item) =>
          item._id === selectedDriver
      );

      if (driver) {
        const savedRoutes =
          JSON.parse(
            localStorage.getItem(
              "routeShareOptimizedRoutes"
            ) || "{}"
          );

        savedRoutes[driver._id] = {
          driverId: driver._id,
          driverName: driver.name,
          vehicle: driver.vehicle,

          stops:
            optimizedStops.map(
              (stop, index) => ({
                sequence: index + 1,
                id: stop.id,
                orderId:
                  stop.orderId,
                type:
                  stop.type,
                address:
                  stop.address,
                coords:
                  stop.coords,
                customer:
                  stop.order
                    ?.customer || "",
              })
            ),

          distance:
            Number(
              calculatedDistance
            ),

          duration:
            calculatedDuration,

          createdAt:
            new Date().toISOString(),
        };

        localStorage.setItem(
          "routeShareOptimizedRoutes",
          JSON.stringify(
            savedRoutes
          )
        );
      }

      setOptimized(true);

      alert(
        "OPTIMIZED ROUTE CREATED SUCCESSFULLY"
      );
    } catch (error) {
      console.error(
        "Optimization error:",
        error
      );

      setError(
        "Could not optimize the delivery route."
      );
    } finally {
      setLoading(false);
    }
  };

  const mapCenter =
    route.length > 0
      ? route[0]
      : defaultCenter;

  const createStopIcon = (
    number,
    type
  ) => {
    const color =
      type === "Pickup"
        ? "#00ffc8"
        : "#ff465a";

    return L.divIcon({
      className:
        "route-number-marker",

      html: `
        <div
          style="
            width:36px;
            height:36px;
            border-radius:50%;
            background:${color};
            color:#041014;
            display:flex;
            align-items:center;
            justify-content:center;
            font-weight:800;
            border:2px solid ${color};
            box-shadow:0 0 18px ${color};
            font-size:13px;
          "
        >
          ${number}
        </div>
      `,

      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  };

  return (
    <main className="dashboard">

      <div className="cyber-header">
        <div>
          <h1>
            ROUTE OPTIMIZATION
          </h1>

          <p>
            INTELLIGENT MULTI-STOP
            DELIVERY ROUTE PLANNING
          </p>
        </div>

        <div className="system-status">
          ● OPTIMIZER ONLINE
        </div>
      </div>

      <div className="route-optimizer-panel">
        <div>
          <h2>
            SELECT DELIVERY DRIVER
          </h2>

          <p>
            Choose the driver responsible
            for this optimized route.
          </p>
        </div>

        <select
          value={selectedDriver}
          onChange={(e) => {
            setSelectedDriver(
              e.target.value
            );

            setRoute([]);
            setCoordinates([]);
            setOptimized(false);
          }}
        >
          <option value="">
            SELECT DRIVER
          </option>

          {drivers.map((driver) => (
            <option
              key={driver._id}
              value={driver._id}
            >
              {driver.name}
              {" — "}
              {driver.vehicle}
              {" — "}
              {driver.status}
            </option>
          ))}
        </select>
      </div>

      <div className="route-optimizer-panel">
        <div>
          <h2>
            SELECT DELIVERY ORDERS
          </h2>

          <p>
            Select multiple orders for
            route optimization.
          </p>
        </div>

        <button
          onClick={() => {
            loadOrders();
            loadDrivers();
          }}
        >
          ↻ REFRESH DATA
        </button>
      </div>

      <div className="optimizer-orders">
        {orders.length === 0 ? (
          <div className="empty-module">
            <div className="module-icon">
              ⌁
            </div>

            <h3>
              NO ORDERS AVAILABLE
            </h3>

            <p>
              Create delivery orders first.
            </p>
          </div>
        ) : (
          orders.map((order, index) => (
            <div
              key={order._id}
              className={`optimizer-order ${
                selectedOrders.includes(
                  order._id
                )
                  ? "optimizer-selected"
                  : ""
              }`}
              onClick={() =>
                toggleOrder(order._id)
              }
            >
              <div className="optimizer-check">
                {selectedOrders.includes(
                  order._id
                )
                  ? "✓"
                  : ""}
              </div>

              <div>
                <small>
                  ORDER{" "}
                  {String(index + 1).padStart(
                    3,
                    "0"
                  )}
                </small>

                <h3>
                  {order.customer}
                </h3>

                <p>
                  {order.pickup}
                  {" → "}
                  {order.delivery}
                </p>
              </div>

              <strong>
                {order.status}
              </strong>
            </div>
          ))
        )}
      </div>

      <div className="optimizer-action">
        <button
          onClick={optimizeRoute}
          disabled={loading}
        >
          {loading
            ? "ANALYZING ROUTE..."
            : "⌁ FIND OPTIMIZED ROUTE"}
        </button>
      </div>

      {error && (
        <div className="tracking-error">
          {error}
        </div>
      )}

      {route.length > 0 && (
        <div className="stats">

          <div className="stat-card">
            <h3>DRIVER</h3>

            <strong>
              {
                drivers.find(
                  (driver) =>
                    driver._id ===
                    selectedDriver
                )?.name ||
                "UNKNOWN"
              }
            </strong>
          </div>

          <div className="stat-card">
            <h3>TOTAL STOPS</h3>

            <strong>
              {coordinates.length}
            </strong>
          </div>

          <div className="stat-card">
            <h3>ROAD DISTANCE</h3>

            <strong>
              {distance} KM
            </strong>
          </div>

          <div className="stat-card">
            <h3>ESTIMATED TIME</h3>

            <strong>
              {duration} MIN
            </strong>
          </div>

        </div>
      )}

      {optimized && (
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>
                OPTIMIZED ROUTE READY
              </h2>

              <p>
                The route is now available
                for Live Tracking.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              window.dispatchEvent(
                new Event(
                  "routeShareRouteUpdated"
                )
              );

              alert(
                "Route saved. Open LIVE TRACKING to monitor the optimized route."
              );
            }}
          >
            ◉ TRACK OPTIMIZED ROUTE
          </button>
        </div>
      )}

      <div className="route-map">
        <MapContainer
          center={mapCenter}
          zoom={12}
          style={{
            width: "100%",
            height: "500px",
          }}
        >
          <MapUpdater
            center={mapCenter}
          />

          <TileLayer
            attribution="© OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {coordinates.map(
            (stop, index) => (
              <Marker
                key={stop.id}
                position={stop.coords}
                icon={createStopIcon(
                  index + 1,
                  stop.type
                )}
              >
                <Popup>
                  <strong>
                    STOP {index + 1}
                  </strong>

                  <br />

                  {stop.type}

                  <br />
                  <br />

                  <strong>
                    Customer:
                  </strong>

                  <br />

                  {stop.order.customer}

                  <br />
                  <br />

                  <strong>
                    Location:
                  </strong>

                  <br />

                  {stop.address}
                </Popup>
              </Marker>
            )
          )}

          {route.length > 0 && (
            <Polyline
              positions={route}
              pathOptions={{
                color: "#00ffc8",
                weight: 5,
                opacity: 0.85,
              }}
            />
          )}
        </MapContainer>
      </div>

      {coordinates.length > 0 && (
        <div className="route-info">
          <h2>
            OPTIMIZED STOP SEQUENCE
          </h2>

          {coordinates.map(
            (stop, index) => (
              <div
                className="analytics-row"
                key={`${stop.id}-list`}
              >
                <span>
                  STOP {index + 1}
                  {" — "}
                  {stop.type}
                </span>

                <strong>
                  {stop.address}
                </strong>
              </div>
            )
          )}
        </div>
      )}

    </main>
  );
}

export default OptimizeRoute;