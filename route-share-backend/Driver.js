const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  vehicle: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: "Available",
  },
});

module.exports = mongoose.model("Driver", driverSchema);