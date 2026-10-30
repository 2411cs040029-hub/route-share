
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import "./App.css";

import CreateOrder from "./CreateOrder";
import Drivers from "./Drivers";
import OptimizeRoute from "./OptimizeRoute";
import LiveTracking from "./LiveTracking";
import Analytics from "./Analytics";

const API_URL = "http://127.0.0.1:5000";

function App() {
  // LOGIN STATE
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem("routeShareLoggedIn") === "true"
  );

  const [email, setEmail] = useState(
    localStorage.getItem("routeShareUsername") || ""
  );

  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // APPLICATION STATE
  const [page, setPage] = useState("home");
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  const [backendError, setBackendError] = useState("");

  // LOAD ORDERS
  const loadOrders = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders`);
      setOrders(Array.isArray(response.data) ? response.data : []);
      setBackendError("");
    } catch (error) {
      console.error("Error loading orders:", error);
      setBackendError(
        "Cannot connect to backend. Please start FastAPI on port 8000."
      );
    }
  }, []);

  // LOAD DRIVERS
  const loadDrivers = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/drivers`);
      setDrivers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error loading drivers:", error);
    }
  }, []);

  // LOAD ALL DATA
  const loadData = useCallback(async () => {
    await Promise.all([loadOrders(), loadDrivers()]);
  }, [loadOrders, loadDrivers]);

  useEffect(() => {
    if (!isLoggedIn) return;

    loadData();

    const interval = setInterval(loadData, 5000);

    return () => clearInterval(interval);
  }, [isLoggedIn, loadData]);

  // LOGIN
  const handleLogin = (event) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setLoginError("Please enter username and password.");
      return;
    }

    localStorage.setItem("routeShareLoggedIn", "true");
    localStorage.setItem("routeShareUsername", email.trim());

    setIsLoggedIn(true);
    setLoginError("");
    setPage("home");
  };

  // LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("routeShareLoggedIn");
    localStorage.removeItem("routeShareUsername");

    setIsLoggedIn(false);
    setEmail("");
    setPassword("");
    setLoginError("");
    setPage("home");
    setTrackingOrderId(null);
    setOrders([]);
    setDrivers([]);
  };

  // ORDER CREATED
  const handleOrderCreated = async () => {
    await loadData();
    setPage("orders");
  };

  // OPEN TRACKING
  const openTracking = (orderId) => {
    if (!orderId) {
      alert("Please select an order to track.");
      return;
    }

    setTrackingOrderId(orderId);
    setPage("tracking");
  };

  // TRACK DRIVER
  const openDriverTracking = (driver) => {
    if (!driver) return;

    const driverOrder = orders.find(
      (order) =>
        order.driverId === driver.id &&
        order.status !== "Delivered"
    );

    if (!driverOrder) {
      alert(`${driver.name} does not have an active delivery.`);
      return;
    }

    openTracking(driverOrder.id);
  };

  // UPDATE ORDER STATUS
  const updateOrderStatus = async (orderId, status) => {
    try {
      const response = await axios.patch(
        `${API_URL}/api/orders/${orderId}/status`,
        { status }
      );

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId ? response.data : order
        )
      );

      await loadDrivers();
    } catch (error) {
      console.error("Status update error:", error);

      alert(
        error.response?.data?.detail ||
        "Could not update order status."
      );
    }
  };

  // ASSIGN DRIVER
  const assignDriver = async (orderId, driverId) => {
    if (!driverId) return;

    try {
      const response = await axios.post(
        `${API_URL}/api/orders/${orderId}/assign`,
        { driverId }
      );

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId ? response.data.order : order
        )
      );

      await loadDrivers();
    } catch (error) {
      console.error("Driver assignment error:", error);

      alert(
        error.response?.data?.detail ||
        "Could not assign driver."
      );
    }
  };

  // DELETE ORDER
  const deleteOrder = async (orderId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this order?"
    );

    if (!confirmed) return;

    try {
      await axios.delete(`${API_URL}/api/orders/${orderId}`);

      setOrders((currentOrders) =>
        currentOrders.filter((order) => order.id !== orderId)
      );

      if (trackingOrderId === orderId) {
        setTrackingOrderId(null);
        if (page === "tracking") setPage("orders");
      }

      await loadDrivers();
    } catch (error) {
      console.error("Delete order error:", error);

      alert(
        error.response?.data?.detail ||
        "Could not delete order."
      );
    }
  };

  // NAVIGATION
  const navigate = (nextPage) => {
    if (nextPage === "tracking" && !trackingOrderId) {
      alert("Please select an order from Orders first.");
      return;
    }

    setPage(nextPage);
  };

  // LOGIN PAGE
  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-box">
          <div className="login-logo">RS</div>

          <h1>ROUTE SHARE</h1>

          <p className="login-subtitle">
            SHARED LAST MILE DELIVERY
            <br />
            OPTIMIZATION PLATFORM
          </p>

          <div className="login-status">● SYSTEM ONLINE</div>

          <form onSubmit={handleLogin}>
            <label>EMAIL / USERNAME</label>

            <input
              type="text"
              placeholder="Enter email or username"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setLoginError("");
              }}
            />

            <label>PASSWORD</label>

            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setLoginError("");
              }}
            />

            {loginError && (
              <div className="login-error">{loginError}</div>
            )}

            <button type="submit">LOGIN</button>
          </form>

          <div className="login-footer">
            DELIVERY MANAGEMENT SYSTEM
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD STATISTICS
  const activeDeliveries = orders.filter(
    (order) =>
      order.status === "Picked Up" ||
      order.status === "Out for Delivery"
  ).length;

  const deliveredOrders = orders.filter(
    (order) => order.status === "Delivered"
  ).length;

  const availableDrivers = drivers.filter(
    (driver) => driver.status === "Available"
  ).length;

  // MAIN APPLICATION
  return (
    <div className="app">

      {/* NAVIGATION */}
      <nav className="top-nav">
        <div className="logo" onClick={() => navigate("home")}>
          ROUTE SHARE
        </div>

        <div className="nav-buttons">
          {[
            ["home", "DASHBOARD"],
            ["orders", "ORDERS"],
            ["create", "CREATE ORDER"],
            ["drivers", "DRIVERS"],
            ["optimize", "OPTIMIZE ROUTE"],
            ["tracking", "LIVE TRACKING"],
            ["analytics", "ANALYTICS"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => navigate(key)}
            >
              {label}
            </button>
          ))}

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            LOGOUT
          </button>
        </div>
      </nav>

      {backendError && (
        <div className="login-error">{backendError}</div>
      )}

      {/* DASHBOARD */}
      {page === "home" && (
        <main className="dashboard">
          <div className="cyber-header">
            <div>
              <h1>DELIVERY COMMAND CENTER</h1>
              <p>ROUTE SHARE // DELIVERY OPERATIONS</p>
            </div>

            <div className="system-status">● SYSTEM ONLINE</div>
          </div>

          <div className="home-main-layout">
            <div className="home-dashboard-content">

              <div className="dashboard-live-bar">
                <div>
                  <span>NETWORK STATUS</span>
                  <strong>● LIVE</strong>
                </div>

                <div>
                  <span>TOTAL ORDERS</span>
                  <strong>{orders.length}</strong>
                </div>

                <div>
                  <span>TOTAL DRIVERS</span>
                  <strong>{drivers.length}</strong>
                </div>

                <div>
                  <span>AUTO REFRESH</span>
                  <strong>5 SEC</strong>
                </div>
              </div>

              <div className="stats">
                <div className="stat-card">
                  <h3>TOTAL ORDERS</h3>
                  <strong>{orders.length}</strong>
                </div>

                <div className="stat-card">
                  <h3>ACTIVE DELIVERIES</h3>
                  <strong>{activeDeliveries}</strong>
                </div>

                <div className="stat-card">
                  <h3>DELIVERED</h3>
                  <strong>{deliveredOrders}</strong>
                </div>

                <div className="stat-card">
                  <h3>AVAILABLE DRIVERS</h3>
                  <strong>{availableDrivers}</strong>
                </div>
              </div>

              {/* MODULE CARDS */}
              <div className="module-grid">
                <div
                  className="module"
                  onClick={() => navigate("orders")}
                >
                  <div className="module-icon">◫</div>
                  <h2>ORDER MANAGEMENT</h2>
                  <p>Create and monitor delivery orders.</p>
                </div>

                <div
                  className="module"
                  onClick={() => navigate("drivers")}
                >
                  <div className="module-icon">◉</div>
                  <h2>DRIVER MANAGEMENT</h2>
                  <p>Register and manage delivery drivers.</p>
                </div>

                <div
                  className="module"
                  onClick={() => navigate("optimize")}
                >
                  <div className="module-icon">⌁</div>
                  <h2>ROUTE OPTIMIZATION</h2>
                  <p>Optimize multiple delivery stops.</p>
                </div>

                <div
                  className="module"
                  onClick={() => navigate("analytics")}
                >
                  <div className="module-icon">▥</div>
                  <h2>ANALYTICS</h2>
                  <p>Monitor delivery performance.</p>
                </div>
              </div>

              {/* RECENT ORDERS */}
              <div className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <div>
                    <h2>RECENT ORDERS</h2>
                    <p>LIVE DELIVERY ACTIVITY</p>
                  </div>

                  <button onClick={() => navigate("orders")}>
                    VIEW ALL
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="dashboard-empty">
                    <div className="module-icon">◫</div>
                    <h3>NO ORDERS AVAILABLE</h3>
                    <p>Create a delivery order to begin.</p>
                  </div>
                ) : (
                  <div className="dashboard-orders">
                    {orders
                      .slice()
                      .reverse()
                      .slice(0, 5)
                      .map((order, index) => (
                        <div
                          className="dashboard-order-row"
                          key={order.id}
                        >
                          <div className="dashboard-order-number">
                            {String(index + 1).padStart(2, "0")}
                          </div>

                          <div className="dashboard-order-main">
                            <strong>{order.customer}</strong>
                            <span>
                              {order.pickup} → {order.delivery}
                            </span>
                          </div>

                          <div className="dashboard-order-driver">
                            <small>DRIVER</small>
                            <strong>
                              {order.driverName || "Not Assigned"}
                            </strong>
                          </div>

                          <div className="dashboard-order-status">
                            {order.status}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* ACCOUNT PANEL */}
            <aside className="account-panel">
              <div className="account-panel-top">
                <span className="account-label">MY ACCOUNT</span>
                <span className="account-online">● ONLINE</span>
              </div>

              <div className="account-avatar">
                {email.trim().charAt(0).toUpperCase() || "U"}
              </div>

              <h2 className="account-name">{email || "User"}</h2>
              <p className="account-role">ROUTE SHARE USER</p>

              <div className="account-status">
                <span>●</span> ACCOUNT ACTIVE
              </div>

              <div className="account-divider"></div>

              <div className="account-info">
                <div>
                  <span>USERNAME</span>
                  <strong>{email || "User"}</strong>
                </div>

                <div>
                  <span>TOTAL ORDERS</span>
                  <strong>{orders.length}</strong>
                </div>

                <div>
                  <span>ACTIVE DELIVERIES</span>
                  <strong>{activeDeliveries}</strong>
                </div>

                <div>
                  <span>ACCOUNT TYPE</span>
                  <strong>STANDARD</strong>
                </div>
              </div>

              <button
                className="account-logout"
                onClick={handleLogout}
              >
                LOGOUT
              </button>
            </aside>
          </div>
        </main>
      )}

      {/* CREATE ORDER */}
      {page === "create" && (
        <CreateOrder onOrderCreated={handleOrderCreated} />
      )}

      {/* DRIVERS */}
      {page === "drivers" && (
        <Drivers onTrackDriver={openDriverTracking} />
      )}

      {/* ORDERS */}
      {page === "orders" && (
        <OrdersPage
          orders={orders}
          drivers={drivers}
          assignDriver={assignDriver}
          updateOrderStatus={updateOrderStatus}
          deleteOrder={deleteOrder}
          openTracking={openTracking}
        />
      )}

      {/* OPTIMIZE ROUTE */}
      {page === "optimize" && (
        <OptimizeRoute
          orders={orders}
          drivers={drivers}
          openTracking={openTracking}
        />
      )}

      {/* LIVE TRACKING */}
      {page === "tracking" && (
        <LiveTracking selectedOrderId={trackingOrderId} />
      )}

      {/* ANALYTICS */}
      {page === "analytics" && (
        <Analytics orders={orders} />
      )}
    </div>
  );
}


// =====================================================
// ORDERS PAGE
// =====================================================

function OrdersPage({
  orders,
  drivers,
  assignDriver,
  updateOrderStatus,
  deleteOrder,
  openTracking,
}) {
  const statusList = [
    "Order Confirmed",
    "Driver Assigned",
    "Picked Up",
    "Out for Delivery",
    "Delivered",
  ];

  return (
    <main className="dashboard">
      <div className="cyber-header">
        <div>
          <h1>ORDER MANAGEMENT</h1>
          <p>DELIVERY ORDER MONITORING // LIVE STATUS</p>
        </div>

        <div className="system-status">● ORDERS ONLINE</div>
      </div>

      {orders.length === 0 ? (
        <div className="empty-module">
          <div className="module-icon">◫</div>
          <h3>NO ORDERS AVAILABLE</h3>
          <p>Create an order to initialize delivery operations.</p>
        </div>
      ) : (
        <div className="orders-command-list">
          {orders
            .slice()
            .reverse()
            .map((order, index) => {
              const currentIndex = statusList.indexOf(order.status);

              return (
                <div
                  className="order-command-card"
                  key={order.id}
                >
                  <div className="order-card-header">
                    <div>
                      <small>ORDER</small>
                      <h2>
                        ORDER-{String(orders.length - index).padStart(3, "0")}
                      </h2>
                    </div>

                    <div className="order-status-badge">
                      {order.status}
                    </div>
                  </div>

                  <div className="order-route">
                    <div>
                      <small>PICKUP</small>
                      <strong>{order.pickup}</strong>
                    </div>

                    <div className="order-route-arrow">→</div>

                    <div>
                      <small>DELIVERY</small>
                      <strong>{order.delivery}</strong>
                    </div>
                  </div>

                  <div className="order-package">
                    <div>
                      <span>CUSTOMER</span>
                      <strong>{order.customer}</strong>
                    </div>

                    <div>
                      <span>PACKAGE</span>
                      <strong>{order.package || "Standard"}</strong>
                    </div>
                  </div>

                  <div className="delivery-progress">
                    {statusList.map((status, statusIndex) => (
                      <div
                        className={`progress-step ${
                          statusIndex < currentIndex
                            ? "progress-completed"
                            : ""
                        } ${
                          statusIndex === currentIndex
                            ? "progress-active"
                            : ""
                        }`}
                        key={status}
                      >
                        <div className="progress-dot">
                          {statusIndex < currentIndex
                            ? "✓"
                            : statusIndex + 1}
                        </div>

                        <span>{status}</span>
                      </div>
                    ))}
                  </div>

                  <div className="order-driver-control">
                    <div>
                      <small>ASSIGNED DRIVER</small>
                      <strong>
                        {order.driverName || "Not Assigned"}
                      </strong>
                    </div>

                    <select
                      value={order.driverId || ""}
                      onChange={(event) => {
                        if (event.target.value) {
                          assignDriver(order.id, event.target.value);
                        }
                      }}
                    >
                      <option value="">Select Driver</option>

                      {drivers.map((driver) => (
                        <option
                          key={driver.id}
                          value={driver.id}
                        >
                          {driver.name} - {driver.status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="order-status-controls">
                    <small>UPDATE DELIVERY STATUS</small>

                    <div className="status-buttons">
                      {statusList.map((status) => (
                        <button
                          key={status}
                          className={
                            order.status === status
                              ? "status-selected"
                              : ""
                          }
                          onClick={() =>
                            updateOrderStatus(order.id, status)
                          }
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="order-card-actions">
                    <button onClick={() => openTracking(order.id)}>
                      TRACK DELIVERY
                    </button>

                    <button
                      className="delete-button"
                      onClick={() => deleteOrder(order.id)}
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </main>
  );
}

export default App;
