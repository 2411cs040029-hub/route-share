import { useCallback, useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-routing-machine";


// =====================================================
// CREATE NUMBERED MAP MARKER
// =====================================================

const createNumberedIcon = (number, type) => {
  const markerColor =
    type === "Pickup" ? "#00ffc8" : "#ff496c";

  return L.divIcon({
    className: "route-number-marker",

    html: `
      <div
        style="
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: ${markerColor};
          color: #061016;
          border: 3px solid #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 14px;
          box-shadow: 0 0 15px ${markerColor};
        "
      >
        ${number}
      </div>
    `,

    iconSize: [34, 34],

    iconAnchor: [17, 17],

    popupAnchor: [0, -18],
  });
};


// =====================================================
// FIT MAP TO ALL STOPS
// =====================================================

function FitMap({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length < 1) {
      return;
    }

    const bounds = L.latLngBounds(
      locations.map(
        (location) => location.position
      )
    );

    map.fitBounds(bounds, {
      padding: [50, 50],
    });
  }, [locations, map]);

  return null;
}


// =====================================================
// REAL ROAD ROUTING
// =====================================================

function RoadRouting({
  locations,
  onRouteFound,
}) {
  const map = useMap();

  useEffect(() => {
    if (locations.length < 2) {
      return;
    }

    const waypoints = locations.map(
      (location) =>
        L.latLng(
          location.position[0],
          location.position[1]
        )
    );

    const routingControl =
      L.Routing.control({
        waypoints: waypoints,

        routeWhileDragging: false,

        addWaypoints: false,

        draggableWaypoints: false,

        showAlternatives: false,

        fitSelectedRoutes: true,

        show: false,

        createMarker: () => null,

        lineOptions: {
          styles: [
            {
              weight: 6,
              opacity: 0.9,
            },
          ],
        },
      }).addTo(map);


    routingControl.on(
      "routesfound",
      (event) => {
        const route =
          event.routes[0];

        if (!route) {
          return;
        }

        const totalDistance =
          route.summary.totalDistance;

        const totalTime =
          route.summary.totalTime;


        onRouteFound({
          distance:
            (
              totalDistance / 1000
            ).toFixed(1),

          time: Math.ceil(
            totalTime / 60
          ),
        });
      }
    );


    routingControl.on(
      "routingerror",
      (error) => {
        console.error(
          "Road routing error:",
          error
        );
      }
    );


    return () => {
      try {
        map.removeControl(
          routingControl
        );
      } catch (error) {
        console.error(error);
      }
    };

  }, [
    map,
    locations,
    onRouteFound,
  ]);

  return null;
}


// =====================================================
// MAIN ROUTE MAP
// =====================================================

function RouteMap() {

  const [orders, setOrders] =
    useState([]);

  const [locations, setLocations] =
    useState([]);

  const [distance, setDistance] =
    useState("--");

  const [time, setTime] =
    useState("--");

  const [loading, setLoading] =
    useState(true);

  const [status, setStatus] =
    useState(
      "SCANNING DELIVERY NETWORK..."
    );

  const [errorMessage, setErrorMessage] =
    useState("");


// =====================================================
// LOAD ORDERS FROM MONGODB
// =====================================================

  const loadOrders = async () => {

    try {

      setStatus(
        "LOADING SAVED ORDERS..."
      );

      const response =
        await fetch(
          "http://localhost:5000/api/orders"
        );

      if (!response.ok) {
        throw new Error(
          "Could not load orders"
        );
      }

      const data =
        await response.json();

      setOrders(data);

    } catch (error) {

      console.error(
        "Order loading error:",
        error
      );

      setErrorMessage(
        "Could not load orders from the backend."
      );

      setLoading(false);
    }
  };


  useEffect(() => {
    loadOrders();
  }, []);


// =====================================================
// GEOCODE ACTUAL ADDRESS
// =====================================================

  const geocodeLocation =
    async (address) => {

      if (!address) {
        return null;
      }

      try {

        const url =
          `https://nominatim.openstreetmap.org/search` +
          `?format=json` +
          `&limit=1` +
          `&q=${encodeURIComponent(
            address
          )}`;

        const response =
          await fetch(url, {
            headers: {
              Accept:
                "application/json",
            },
          });

        if (!response.ok) {
          return null;
        }

        const data =
          await response.json();

        if (
          data &&
          data.length > 0
        ) {

          return [
            parseFloat(
              data[0].lat
            ),

            parseFloat(
              data[0].lon
            ),
          ];
        }

        return null;

      } catch (error) {

        console.error(
          "Geocoding error:",
          address,
          error
        );

        return null;
      }
    };


// =====================================================
// DISTANCE CALCULATION
// =====================================================

  const calculateDistance =
    (first, second) => {

      const R = 6371;

      const lat1 =
        (first[0] * Math.PI) /
        180;

      const lat2 =
        (second[0] * Math.PI) /
        180;

      const dLat =
        ((second[0] - first[0]) *
          Math.PI) /
        180;

      const dLon =
        ((second[1] - first[1]) *
          Math.PI) /
        180;

      const a =
        Math.sin(dLat / 2) *
          Math.sin(dLat / 2) +

        Math.cos(lat1) *
          Math.cos(lat2) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c =
        2 *
        Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a)
        );

      return R * c;
    };


// =====================================================
// BUILD OPTIMIZED ROUTE
// =====================================================

  useEffect(() => {

    const buildRoute =
      async () => {

        if (orders.length === 0) {

          setLocations([]);

          setLoading(false);

          setStatus(
            "NO DELIVERY ORDERS FOUND"
          );

          return;
        }


        setLoading(true);

        setErrorMessage("");

        setStatus(
          "SCANNING PICKUP AND DELIVERY LOCATIONS..."
        );


        const orderStops = [];


        // ---------------------------------------------
        // GEOCODE EVERY SAVED ORDER
        // ---------------------------------------------

        for (
          const order of orders
        ) {

          setStatus(
            `SCANNING: ${order.customer}`
          );


          const pickup =
            await geocodeLocation(
              order.pickup
            );


          const delivery =
            await geocodeLocation(
              order.delivery
            );


          if (
            pickup &&
            delivery
          ) {

            orderStops.push({

              orderId:
                order._id,

              customer:
                order.customer,

              package:
                order.package,

              status:
                order.status,

              pickup: pickup,

              delivery: delivery,

              pickupText:
                order.pickup,

              deliveryText:
                order.delivery,
            });

          } else {

            console.warn(
              "Could not locate:",
              order
            );
          }
        }


        if (
          orderStops.length === 0
        ) {

          setLocations([]);

          setLoading(false);

          setStatus(
            "LOCATION SCAN FAILED"
          );

          setErrorMessage(
            "No pickup/delivery addresses could be located. Try using complete addresses."
          );

          return;
        }


        // ---------------------------------------------
        // CREATE AVAILABLE STOPS
        // ---------------------------------------------

        const remainingOrders =
          orderStops.map(
            (order) => ({
              ...order,

              pickupDone: false,
            })
          );


        const optimized = [];


        // ---------------------------------------------
        // START AT FIRST ORDER PICKUP
        // ---------------------------------------------

        let current =
          remainingOrders[0];

        let currentPosition =
          current.pickup;


        optimized.push({
          name:
            `Pickup - ${current.customer}`,

          position:
            current.pickup,

          type:
            "Pickup",

          orderId:
            current.orderId,

          customer:
            current.customer,

          package:
            current.package,

          address:
            current.pickupText,
        });


        current.pickupDone =
          true;


        // ---------------------------------------------
        // REMOVE FIRST ORDER
        // ---------------------------------------------

        remainingOrders.shift();


        // ---------------------------------------------
        // NEAREST VALID STOP
        // ---------------------------------------------

        while (
          remainingOrders.length > 0
        ) {

          let nearestIndex = -1;

          let nearestType =
            null;

          let nearestPosition =
            null;

          let nearestDistance =
            Infinity;


          remainingOrders.forEach(
            (order, index) => {

              // Pickup is always available.
              const pickupDistance =
                calculateDistance(
                  currentPosition,
                  order.pickup
                );


              if (
                pickupDistance <
                nearestDistance
              ) {

                nearestDistance =
                  pickupDistance;

                nearestIndex =
                  index;

                nearestType =
                  "Pickup";

                nearestPosition =
                  order.pickup;
              }


              // Delivery becomes available
              // only after its pickup.
              if (
                order.pickupDone
              ) {

                const deliveryDistance =
                  calculateDistance(
                    currentPosition,
                    order.delivery
                  );


                if (
                  deliveryDistance <
                  nearestDistance
                ) {

                  nearestDistance =
                    deliveryDistance;

                  nearestIndex =
                    index;

                  nearestType =
                    "Delivery";

                  nearestPosition =
                    order.delivery;
                }
              }
            }
          );


          if (
            nearestIndex === -1
          ) {
            break;
          }


          const selectedOrder =
            remainingOrders[
              nearestIndex
            ];


          // -------------------------------------------
          // PICKUP
          // -------------------------------------------

          if (
            nearestType ===
            "Pickup"
          ) {

            optimized.push({
              name:
                `Pickup - ${selectedOrder.customer}`,

              position:
                selectedOrder.pickup,

              type:
                "Pickup",

              orderId:
                selectedOrder.orderId,

              customer:
                selectedOrder.customer,

              package:
                selectedOrder.package,

              address:
                selectedOrder.pickupText,
            });


            selectedOrder.pickupDone =
              true;


            currentPosition =
              selectedOrder.pickup;


            // Don't remove yet.
            // Delivery still needs to happen.

          }


          // -------------------------------------------
          // DELIVERY
          // -------------------------------------------

          else {

            optimized.push({
              name:
                `Delivery - ${selectedOrder.customer}`,

              position:
                selectedOrder.delivery,

              type:
                "Delivery",

              orderId:
                selectedOrder.orderId,

              customer:
                selectedOrder.customer,

              package:
                selectedOrder.package,

              address:
                selectedOrder.deliveryText,
            });


            currentPosition =
              selectedOrder.delivery;


            remainingOrders.splice(
              nearestIndex,
              1
            );
          }


          setStatus(
            `OPTIMIZING STOP ${optimized.length}`
          );
        }


        setLocations(
          optimized
        );


        setStatus(
          "ROUTE OPTIMIZED SUCCESSFULLY"
        );


        setLoading(false);
      };


    buildRoute();

  }, [orders]);


// =====================================================
// ROUTE RESULT
// =====================================================

  const handleRouteFound =
    useCallback(
      (result) => {

        setDistance(
          result.distance
        );

        setTime(
          result.time
        );

        setStatus(
          "REAL ROAD ROUTE ACTIVE"
        );
      },
      []
    );


// =====================================================
// MAP CENTER
// =====================================================

  const center =
    locations.length > 0
      ? locations[0].position
      : [17.3850, 78.4867];


// =====================================================
// UI
// =====================================================

  return (

    <div className="route-map">

      {/* ========================================= */}
      {/* HEADER */}
      {/* ========================================= */}

      <div className="route-info">

        <div>

          <strong>
            OPTIMIZED ROUTE
          </strong>

          <span>
            {orders.length} Orders
          </span>

        </div>


        <div>

          <strong>
            {distance === "--"
              ? "--"
              : `${distance} km`}
          </strong>

          <span>
            Road Distance
          </span>

        </div>


        <div>

          <strong>
            {time === "--"
              ? "--"
              : `${time} min`}
          </strong>

          <span>
            Estimated Time
          </span>

        </div>

      </div>


      {/* ========================================= */}
      {/* SCANNING STATUS */}
      {/* ========================================= */}

      <div
        style={{
          marginTop: "15px",
          marginBottom: "15px",
          padding: "16px",
          border:
            "1px solid rgba(0,255,200,0.3)",
          background:
            "rgba(0,255,200,0.04)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >

        <div
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background:
              loading
                ? "#00ffc8"
                : "#39ff88",

            boxShadow:
              "0 0 15px #00ffc8",

            animation:
              loading
                ? "routePulse 1s infinite"
                : "none",
          }}
        />

        <strong>
          {status}
        </strong>

      </div>


      {/* ========================================= */}
      {/* ERROR */}
      {/* ========================================= */}

      {errorMessage && (

        <div
          style={{
            padding: "14px",
            marginBottom: "15px",
            border:
              "1px solid #ff496c",
            color: "#ff496c",
          }}
        >
          {errorMessage}
        </div>

      )}


      {/* ========================================= */}
      {/* MAP */}
      {/* ========================================= */}

      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        style={{
          height: "500px",
          width: "100%",
        }}
      >

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />


        {/* REAL ROAD ROUTE */}

        {!loading &&
          locations.length >= 2 && (

            <RoadRouting
              locations={locations}
              onRouteFound={
                handleRouteFound
              }
            />

          )}


        {/* NUMBERED MARKERS */}

        {locations.map(
          (location, index) => (

            <Marker
              key={`${location.orderId}-${location.type}-${index}`}
              position={
                location.position
              }
              icon={createNumberedIcon(
                index + 1,
                location.type
              )}
            >

              <Popup>

                <strong>
                  STOP-{String(
                    index + 1
                  ).padStart(2, "0")}
                </strong>

                <br />
                <br />

                <strong>
                  {location.type}
                </strong>

                <br />

                Customer:
                {" "}
                {location.customer}

                <br />

                Address:
                {" "}
                {location.address}

                <br />

                Package:
                {" "}
                {location.package}

              </Popup>

            </Marker>

          )
        )}


        <FitMap
          locations={locations}
        />

      </MapContainer>


      {/* ========================================= */}
      {/* LEGEND */}
      {/* ========================================= */}

      <div
        style={{
          display: "flex",
          gap: "25px",
          marginTop: "15px",
          flexWrap: "wrap",
        }}
      >

        <div>
          🟢 <strong>PICKUP</strong>
        </div>

        <div>
          🔴 <strong>DELIVERY</strong>
        </div>

        <div>
          🔢 <strong>STOP NUMBER</strong>
        </div>

      </div>


      {/* ========================================= */}
      {/* OPTIMIZED STOP SEQUENCE */}
      {/* ========================================= */}

      {locations.length > 0 && (

        <div
          style={{
            marginTop: "25px",
          }}
        >

          <div className="cyber-header">

            <div>

              <h2>
                OPTIMIZED STOP SEQUENCE
              </h2>

              <p>
                ACTUAL SAVED LOCATIONS //
                REAL ROAD ROUTING
              </p>

            </div>

          </div>


          <div className="order-list">

            {locations.map(
              (location, index) => (

                <div
                  className="order-row"
                  key={`${location.orderId}-${location.type}-list-${index}`}
                >

                  <div>

                    <strong>
                      STOP-
                      {String(
                        index + 1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </strong>

                    <p>
                      {location.address}
                    </p>

                    <small>
                      CUSTOMER:{" "}
                      {location.customer}
                    </small>

                  </div>


                  <div>

                    <small>
                      TYPE
                    </small>

                    <strong
                      className={
                        location.type ===
                        "Pickup"
                          ? "status-online"
                          : ""
                      }
                    >
                      {location.type}
                    </strong>

                  </div>


                  <div>

                    <small>
                      PACKAGE
                    </small>

                    <strong>
                      {location.package}
                    </strong>

                  </div>

                </div>

              )
            )}

          </div>

        </div>

      )}

    </div>
  );
}

export default RouteMap;