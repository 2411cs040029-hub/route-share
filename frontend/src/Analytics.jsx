import { useEffect, useState } from "react";
import axios from "axios";

function Analytics() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [lastUpdated, setLastUpdated] = useState("");

  // ========================================
  // LOAD DATA
  // ========================================

  const loadData = async () => {
    try {
      const ordersResponse = await axios.get(
        "http://localhost:5000/api/orders"
      );

      const driversResponse = await axios.get(
        "http://localhost:5000/api/drivers"
      );

      setOrders(ordersResponse.data);
      setDrivers(driversResponse.data);

      setLastUpdated(
        new Date().toLocaleTimeString()
      );
    } catch (error) {
      console.error(
        "Analytics loading error:",
        error
      );
    }
  };

  // ========================================
  // INITIAL LOAD + AUTO REFRESH
  // ========================================

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // ========================================
  // ORDER STATISTICS
  // ========================================

  const totalOrders = orders.length;

  const confirmedOrders = orders.filter(
    (order) =>
      order.status === "Order Confirmed"
  ).length;

  const pickedUpOrders = orders.filter(
    (order) =>
      order.status === "Picked Up"
  ).length;

  const outForDelivery = orders.filter(
    (order) =>
      order.status === "Out for Delivery"
  ).length;

  const deliveredOrders = orders.filter(
    (order) =>
      order.status === "Delivered"
  ).length;

  const activeDeliveries =
    pickedUpOrders +
    outForDelivery;

  // ========================================
  // DRIVER STATISTICS
  // ========================================

  const assignedOrders = orders.filter(
    (order) =>
      order.driverId
  ).length;

  const unassignedOrders =
    totalOrders -
    assignedOrders;

  // ========================================
  // DELIVERY RATE
  // ========================================

  const deliveryRate =
    totalOrders === 0
      ? 0
      : Math.round(
          (deliveredOrders /
            totalOrders) *
            100
        );

  // ========================================
  // DRIVER ASSIGNMENT RATE
  // ========================================

  const assignmentRate =
    totalOrders === 0
      ? 0
      : Math.round(
          (assignedOrders /
            totalOrders) *
            100
        );

  // ========================================
  // ACTIVE DRIVER COUNT
  // ========================================

  const availableDrivers =
    drivers.filter(
      (driver) =>
        driver.status === "Available"
    ).length;

  return (
    <main className="dashboard">

      {/* ==================================
          HEADER
      ================================== */}

      <div className="cyber-header">

        <div>

          <h1>
            DELIVERY ANALYTICS
          </h1>

          <p>
            LIVE DELIVERY NETWORK
            PERFORMANCE MONITORING
          </p>

        </div>

        <div className="system-status">
          ● ANALYTICS ONLINE
        </div>

      </div>


      {/* ==================================
          LIVE UPDATE BAR
      ================================== */}

      <div className="analytics-live-bar">

        <div>
          <span>
            NETWORK STATUS
          </span>

          <strong>
            ● LIVE
          </strong>
        </div>

        <div>
          <span>
            AUTO REFRESH
          </span>

          <strong>
            5 SEC
          </strong>
        </div>

        <div>
          <span>
            LAST UPDATED
          </span>

          <strong>
            {lastUpdated || "Loading..."}
          </strong>
        </div>

        <button
          onClick={loadData}
        >
          ↻ REFRESH NOW
        </button>

      </div>


      {/* ==================================
          MAIN STATISTICS
      ================================== */}

      <div className="stats">

        <div className="stat-card">

          <h3>
            TOTAL ORDERS
          </h3>

          <strong>
            {totalOrders}
          </strong>

        </div>


        <div className="stat-card">

          <h3>
            ACTIVE DELIVERIES
          </h3>

          <strong>
            {activeDeliveries}
          </strong>

        </div>


        <div className="stat-card">

          <h3>
            DELIVERED
          </h3>

          <strong>
            {deliveredOrders}
          </strong>

        </div>


        <div className="stat-card">

          <h3>
            DELIVERY RATE
          </h3>

          <strong>
            {deliveryRate}%
          </strong>

        </div>

      </div>


      {/* ==================================
          ORDER + DRIVER NETWORK
      ================================== */}

      <div className="analytics-grid">

        {/* ORDER STATUS */}

        <div className="analytics-panel">

          <h2>
            ORDER STATUS
          </h2>


          <div className="analytics-row">

            <span>
              Order Confirmed
            </span>

            <strong>
              {confirmedOrders}
            </strong>

          </div>


          <div className="analytics-row">

            <span>
              Picked Up
            </span>

            <strong>
              {pickedUpOrders}
            </strong>

          </div>


          <div className="analytics-row">

            <span>
              Out for Delivery
            </span>

            <strong>
              {outForDelivery}
            </strong>

          </div>


          <div className="analytics-row">

            <span>
              Delivered
            </span>

            <strong>
              {deliveredOrders}
            </strong>

          </div>

        </div>


        {/* DRIVER NETWORK */}

        <div className="analytics-panel">

          <h2>
            DRIVER NETWORK
          </h2>


          <div className="analytics-row">

            <span>
              Total Drivers
            </span>

            <strong>
              {drivers.length}
            </strong>

          </div>


          <div className="analytics-row">

            <span>
              Available Drivers
            </span>

            <strong>
              {availableDrivers}
            </strong>

          </div>


          <div className="analytics-row">

            <span>
              Assigned Orders
            </span>

            <strong>
              {assignedOrders}
            </strong>

          </div>


          <div className="analytics-row">

            <span>
              Unassigned Orders
            </span>

            <strong>
              {unassignedOrders}
            </strong>

          </div>

        </div>

      </div>


      {/* ==================================
          PERFORMANCE
      ================================== */}

      <div className="analytics-panel">

        <h2>
          DELIVERY PERFORMANCE
        </h2>


        {/* DELIVERY RATE */}

        <div className="performance-bar">

          <div className="performance-header">

            <span>
              Completed Deliveries
            </span>

            <strong>
              {deliveryRate}%
            </strong>

          </div>

          <div className="analytics-progress">

            <div
              className="analytics-progress-fill"
              style={{
                width:
                  `${deliveryRate}%`,
              }}
            />

          </div>

        </div>


        {/* DRIVER ASSIGNMENT */}

        <div className="performance-bar">

          <div className="performance-header">

            <span>
              Driver Assignment
            </span>

            <strong>
              {assignmentRate}%
            </strong>

          </div>

          <div className="analytics-progress">

            <div
              className="analytics-progress-fill"
              style={{
                width:
                  `${assignmentRate}%`,
              }}
            />

          </div>

        </div>


        {/* ACTIVE DELIVERY RATE */}

        <div className="performance-bar">

          <div className="performance-header">

            <span>
              Active Delivery Load
            </span>

            <strong>
              {
                totalOrders === 0
                  ? 0
                  : Math.round(
                      (activeDeliveries /
                        totalOrders) *
                        100
                    )
              }%
            </strong>

          </div>

          <div className="analytics-progress">

            <div
              className="analytics-progress-fill"
              style={{
                width:
                  `${
                    totalOrders === 0
                      ? 0
                      : Math.round(
                          (activeDeliveries /
                            totalOrders) *
                            100
                        )
                  }%`,
              }}
            />

          </div>

        </div>

      </div>


      {/* ==================================
          DELIVERY ACTIVITY
      ================================== */}

      <div className="analytics-panel">

        <h2>
          RECENT DELIVERY ACTIVITY
        </h2>


        {orders.length === 0 ? (

          <div className="empty-module">

            <div className="module-icon">
              ▥
            </div>

            <h3>
              NO DELIVERY DATA
            </h3>

            <p>
              Create orders to generate
              analytics.
            </p>

          </div>

        ) : (

          <div className="analytics-table">

            <div className="analytics-table-header">

              <span>
                CUSTOMER
              </span>

              <span>
                DRIVER
              </span>

              <span>
                STATUS
              </span>

            </div>


            {orders
              .slice()
              .reverse()
              .slice(0, 10)
              .map(
                (order) => (

                  <div
                    className="analytics-table-row"
                    key={order._id}
                  >

                    <span>
                      {order.customer}
                    </span>

                    <span>
                      {order.driverName ||
                        "Not Assigned"}
                    </span>

                    <span>
                      {order.status}
                    </span>

                  </div>

                )
              )}

          </div>

        )}

      </div>

    </main>
  );
}

export default Analytics;