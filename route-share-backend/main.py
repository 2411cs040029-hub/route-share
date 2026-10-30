
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="RouteShare API", version="2.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temporary in-memory storage
orders = []
drivers = []


def make_id():
    return str(uuid4())[:8]


def now():
    return datetime.now(timezone.utc).isoformat()


def find_order(order_id):
    order = next((o for o in orders if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def find_driver(driver_id):
    driver = next((d for d in drivers if d["id"] == driver_id), None)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


def refresh_driver_status(driver_id):
    """Keep driver status consistent with their assigned orders."""
    driver = next((d for d in drivers if d["id"] == driver_id), None)

    if driver:
        has_orders = any(
            o.get("driverId") == driver_id for o in orders
        )
        driver["status"] = "Assigned" if has_orders else "Available"


# ---------------- HOME / HEALTH ----------------

@app.get("/")
def home():
    return {
        "message": "RouteShare API is running",
        "version": "2.1"
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------------- ORDERS / DELIVERIES ----------------

@app.get("/api/orders")
@app.get("/api/deliveries")
def get_orders():
    return orders


@app.post("/api/orders")
@app.post("/api/deliveries")
def create_order(data: dict):
    customer = data.get("customer") or data.get("customerName")
    pickup = data.get("pickup") or data.get("pickupLocation")
    destination = (
        data.get("delivery")
        or data.get("destination")
        or data.get("deliveryLocation")
    )

    if not customer or not pickup or not destination:
        raise HTTPException(
            status_code=400,
            detail="Customer, pickup and delivery destination are required",
        )

    timestamp = now()

    order = {
        "id": make_id(),
        "customer": customer,
        "pickup": pickup,
        "delivery": destination,
        "destination": destination,
        "package": data.get("package", "Standard"),
        "status": "Order Confirmed",
        "driverId": None,
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "tracking": {
            "location": pickup,
            "latitude": None,
            "longitude": None,
            "updatedAt": timestamp,
        },
    }

    orders.append(order)
    return order


@app.get("/api/orders/{order_id}")
@app.get("/api/deliveries/{order_id}")
def get_order(order_id: str):
    return find_order(order_id)


@app.patch("/api/orders/{order_id}")
@app.patch("/api/deliveries/{order_id}")
def update_order(order_id: str, data: dict):
    order = find_order(order_id)

    allowed_fields = {
        "customer",
        "pickup",
        "delivery",
        "destination",
        "package",
    }

    for field in allowed_fields:
        if field in data:
            order[field] = data[field]

    order["updatedAt"] = now()
    return order


@app.patch("/api/orders/{order_id}/status")
@app.patch("/api/deliveries/{order_id}/status")
def update_order_status(order_id: str, data: dict):
    order = find_order(order_id)
    status = data.get("status")

    if not status:
        raise HTTPException(
            status_code=400,
            detail="Status is required"
        )

    order["status"] = status
    order["updatedAt"] = now()

    return order


@app.delete("/api/orders/{order_id}")
@app.delete("/api/deliveries/{order_id}")
def delete_order(order_id: str):
    order = find_order(order_id)
    driver_id = order.get("driverId")

    orders.remove(order)

    if driver_id:
        refresh_driver_status(driver_id)

    return {
        "message": "Order deleted successfully",
        "id": order_id
    }


# ---------------- DRIVERS ----------------

@app.get("/api/drivers")
def get_drivers():
    return drivers


@app.post("/api/drivers")
def add_driver(data: dict):
    name = data.get("name") or data.get("driverName")

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Driver name is required"
        )

    driver = {
        "id": make_id(),
        "name": name,
        "phone": data.get("phone", ""),
        "vehicle": data.get("vehicle", "Bike"),
        "status": "Available",
        "createdAt": now(),
    }

    drivers.append(driver)
    return driver


@app.patch("/api/drivers/{driver_id}")
def update_driver(driver_id: str, data: dict):
    driver = find_driver(driver_id)

    allowed_fields = {"name", "phone", "vehicle"}

    for field in allowed_fields:
        if field in data:
            driver[field] = data[field]

    return driver


@app.delete("/api/drivers/{driver_id}")
def delete_driver(driver_id: str):
    driver = find_driver(driver_id)

    for order in orders:
        if order.get("driverId") == driver_id:
            order["driverId"] = None
            order.pop("driverName", None)
            order["status"] = "Order Confirmed"
            order["updatedAt"] = now()

    drivers.remove(driver)

    return {"message": "Driver deleted successfully"}


# ---------------- DRIVER ASSIGNMENT ----------------

@app.post("/api/orders/{order_id}/assign")
def assign_driver(order_id: str, data: dict):
    order = find_order(order_id)
    driver_id = data.get("driverId")

    if not driver_id:
        raise HTTPException(
            status_code=400,
            detail="driverId is required"
        )

    driver = find_driver(driver_id)

    old_driver_id = order.get("driverId")

    # Remove the order from its previous driver if necessary.
    if old_driver_id and old_driver_id != driver_id:
        refresh_driver_status(old_driver_id)

    order["driverId"] = driver_id
    order["driverName"] = driver["name"]
    order["status"] = "Driver Assigned"
    order["updatedAt"] = now()

    refresh_driver_status(driver_id)

    return {
        "order": order,
        "driver": driver
    }


@app.post("/api/orders/{order_id}/unassign")
def unassign_driver(order_id: str):
    order = find_order(order_id)
    driver_id = order.get("driverId")

    order["driverId"] = None
    order.pop("driverName", None)
    order["status"] = "Order Confirmed"
    order["updatedAt"] = now()

    if driver_id:
        refresh_driver_status(driver_id)

    return order


# ---------------- LIVE TRACKING ----------------

@app.get("/api/tracking")
def get_all_tracking():
    return [
        {
            "orderId": order["id"],
            "customer": order["customer"],
            "pickup": order["pickup"],
            "delivery": order["delivery"],
            "status": order["status"],
            "driverId": order.get("driverId"),
            "driverName": order.get("driverName"),
            **order["tracking"],
        }
        for order in orders
    ]


@app.get("/api/tracking/{order_id}")
def get_tracking(order_id: str):
    order = find_order(order_id)

    return {
        "orderId": order["id"],
        "customer": order["customer"],
        "pickup": order["pickup"],
        "delivery": order["delivery"],
        "status": order["status"],
        "driverId": order.get("driverId"),
        "driverName": order.get("driverName"),
        **order["tracking"],
    }


@app.patch("/api/tracking/{order_id}")
def update_tracking(order_id: str, data: dict):
    order = find_order(order_id)

    for field in ("location", "latitude", "longitude"):
        if field in data:
            order["tracking"][field] = data[field]

    order["tracking"]["updatedAt"] = now()

    if data.get("status"):
        order["status"] = data["status"]

    order["updatedAt"] = now()

    return {
        "orderId": order["id"],
        "status": order["status"],
        **order["tracking"],
    }


# ---------------- SHARED ROUTES ----------------

@app.get("/api/routes")
@app.get("/api/shared-routes")
def get_shared_routes():
    groups = {}

    for order in orders:
        driver_id = order.get("driverId")

        if driver_id:
            groups.setdefault(driver_id, []).append(order)

    result = []

    for driver_id, route_orders in groups.items():
        driver = next(
            (d for d in drivers if d["id"] == driver_id),
            None
        )

        result.append({
            "driverId": driver_id,
            "driverName": driver["name"] if driver else "Unknown driver",
            "orders": route_orders,
            "orderCount": len(route_orders),
        })

    return result


@app.get("/api/route-score")
def route_score(
    distance_km: float = 5,
    shared_distance_km: float = 3
):
    if distance_km <= 0 or shared_distance_km < 0:
        raise HTTPException(
            status_code=400,
            detail="Distance must be positive and shared distance cannot be negative",
        )

    saved = min(distance_km, shared_distance_km)

    return {
        "distance_km": distance_km,
        "shared_distance_km": saved,
        "estimated_distance_saved_km": saved,
        "estimated_savings_percent": round(
            saved / distance_km * 100, 2
        ),
    }


# ---------------- ANALYTICS / REPORTS ----------------

@app.get("/api/analytics")
@app.get("/api/reports")
def analytics():
    total = len(orders)

    delivered = sum(
        1 for order in orders
        if order["status"].lower() == "delivered"
    )

    active = total - delivered

    assigned = sum(
        1 for order in orders
        if order.get("driverId")
    )

    return {
        "totalOrders": total,
        "deliveredOrders": delivered,
        "activeOrders": active,
        "assignedOrders": assigned,
        "unassignedOrders": total - assigned,
        "totalDrivers": len(drivers),
        "availableDrivers": sum(
            1 for driver in drivers
            if driver["status"] == "Available"
        ),
        "assignedDrivers": sum(
            1 for driver in drivers
            if driver["status"] == "Assigned"
        ),
    }
