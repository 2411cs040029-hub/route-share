const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  customer: String,
  pickup: String,
  delivery: String,
  package: String,
  driverId: {
  type: String,
  default: "",
},

driverName: {
  type: String,
  default: "",
},
 status: {
  type: String,
  enum: [
    "Order Confirmed",
    "Picked Up",
    "Out for Delivery",
    "Delivered",
  ],
  default: "Order Confirmed",
},
});

module.exports = mongoose.model("Order", orderSchema);