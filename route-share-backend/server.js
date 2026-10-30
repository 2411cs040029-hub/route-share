const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const Order = require("./Order");
const Driver = require("./Driver");

const app = express();

app.use(cors());
app.use(express.json());

mongoose
  .connect("mongodb://127.0.0.1:27017/route_share")
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error);
  });

app.get("/", (req, res) => {
  res.json({
    message: "Route Share Backend is running",
  });
});

/* =====================================================
   GET ALL ORDERS
===================================================== */

app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not fetch orders",
    });
  }
});

/* =====================================================
   CREATE ORDER + AUTOMATIC DRIVER ASSIGNMENT
===================================================== */

app.post("/api/orders", async (req, res) => {
  try {
    const {
      customer,
      pickup,
      delivery,
      package: packageDetails,
    } = req.body;

    /* Find a driver who has no unfinished order */

    const assignedDriver = await Driver.findOne({
      status: "Available",
    });

    const newOrder = new Order({
      customer,
      pickup,
      delivery,
      package: packageDetails,

      driverId: assignedDriver
        ? assignedDriver._id.toString()
        : "",

      driverName: assignedDriver
        ? assignedDriver.name
        : "",

      status: "Order Confirmed",
    });

    const savedOrder = await newOrder.save();

    /* Mark driver as assigned */

    if (assignedDriver) {
      assignedDriver.status = "Assigned";
      await assignedDriver.save();

      console.log(
        `Driver ${assignedDriver.name} automatically assigned to order`
      );
    } else {
      console.log(
        "No available driver found. Order remains unassigned."
      );
    }

    console.log("New order saved:", savedOrder);

    res.status(201).json({
      message: assignedDriver
        ? "Order created and driver assigned automatically"
        : "Order created, but no available driver was found",

      order: savedOrder,

      driverAssigned: !!assignedDriver,

      driver: assignedDriver
        ? {
            id: assignedDriver._id,
            name: assignedDriver.name,
            vehicle: assignedDriver.vehicle,
          }
        : null,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not create order",
    });
  }
});

/* =====================================================
   DELETE ORDER
===================================================== */

app.delete("/api/orders/:id", async (req, res) => {
  try {
    const deletedOrder =
      await Order.findByIdAndDelete(req.params.id);

    if (!deletedOrder) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (deletedOrder.driverId) {
      await updateDriverAvailability(
        deletedOrder.driverId
      );
    }

    res.json({
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not delete order",
    });
  }
});

/* =====================================================
   GET ALL DRIVERS
===================================================== */

app.get("/api/drivers", async (req, res) => {
  try {
    const drivers = await Driver.find();

    res.json(drivers);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not fetch drivers",
    });
  }
});

/* =====================================================
   REGISTER DRIVER
===================================================== */

app.post("/api/drivers", async (req, res) => {
  try {
    const newDriver = new Driver({
      name: req.body.name,
      phone: req.body.phone,
      vehicle: req.body.vehicle,
      status: "Available",
    });

    const savedDriver = await newDriver.save();

    res.status(201).json({
      message: "Driver added successfully",
      driver: savedDriver,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not add driver",
    });
  }
});

/* =====================================================
   DELETE DRIVER
===================================================== */

app.delete("/api/drivers/:id", async (req, res) => {
  try {
    const driver =
      await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    const activeOrder = await Order.findOne({
      driverId: driver._id.toString(),
      status: {
        $ne: "Delivered",
      },
    });

    if (activeOrder) {
      return res.status(400).json({
        message:
          "Driver has an assigned order and cannot be deleted.",
      });
    }

    await Driver.findByIdAndDelete(req.params.id);

    res.json({
      message: "Driver deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not delete driver",
    });
  }
});

/* =====================================================
   MANUAL DRIVER ASSIGNMENT
===================================================== */

app.put(
  "/api/orders/:id/assign-driver",
  async (req, res) => {
    try {
      const {
        driverId,
      } = req.body;

      const order =
        await Order.findById(req.params.id);

      if (!order) {
        return res.status(404).json({
          message: "Order not found",
        });
      }

      const driver =
        await Driver.findById(driverId);

      if (!driver) {
        return res.status(404).json({
          message: "Driver not found",
        });
      }

      const existingOrder =
        await Order.findOne({
          driverId: driverId,
          status: {
            $ne: "Delivered",
          },
          _id: {
            $ne: order._id,
          },
        });

      if (existingOrder) {
        return res.status(400).json({
          message:
            "Driver already has an assigned order.",
        });
      }

      /* Release old driver */

      if (
        order.driverId &&
        order.driverId !== driverId
      ) {
        await updateDriverAvailability(
          order.driverId
        );
      }

      order.driverId =
        driver._id.toString();

      order.driverName =
        driver.name;

      await order.save();

      driver.status = "Assigned";

      await driver.save();

      res.json({
        message:
          "Driver assigned successfully",
        order,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not assign driver",
      });
    }
  }
);

/* =====================================================
   UPDATE ORDER STATUS
===================================================== */

app.put(
  "/api/orders/:id/status",
  async (req, res) => {
    try {
      const { status } = req.body;

      const order =
        await Order.findById(req.params.id);

      if (!order) {
        return res.status(404).json({
          message: "Order not found",
        });
      }

      const validStatuses = [
        "Order Confirmed",
        "Picked Up",
        "Out for Delivery",
        "Delivered",
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid order status",
        });
      }

      if (
        (
          status === "Picked Up" ||
          status === "Out for Delivery"
        ) &&
        !order.driverId
      ) {
        return res.status(400).json({
          message:
            "Assign a driver before starting the delivery.",
        });
      }

      order.status = status;

      await order.save();

      if (order.driverId) {
        await updateDriverAvailability(
          order.driverId
        );
      }

      res.json({
        message:
          "Order status updated successfully",
        order,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not update order status",
      });
    }
  }
);

/* =====================================================
   DRIVER AVAILABILITY
===================================================== */

async function updateDriverAvailability(
  driverId
) {
  try {
    const driver =
      await Driver.findById(driverId);

    if (!driver) {
      return;
    }

    const assignedOrder =
      await Order.findOne({
        driverId: driverId.toString(),
        status: {
          $ne: "Delivered",
        },
      });

    if (assignedOrder) {
      driver.status = "Assigned";
    } else {
      driver.status = "Available";
    }

    await driver.save();
  } catch (error) {
    console.error(
      "Driver availability error:",
      error
    );
  }
}

/* =====================================================
   SERVER
===================================================== */

const PORT = 5000;

app.listen(PORT, () => {
  console.log(
    `Route Share backend running on http://localhost:${PORT}`
  );
});