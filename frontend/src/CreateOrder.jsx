import { useState } from "react";
import axios from "axios";

function CreateOrder({ onOrderCreated }) {
  const [order, setOrder] = useState({
    customer: "",
    pickup: "",
    delivery: "",
    package: "",
  });

  const handleChange = (e) => {
    setOrder({
      ...order,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !order.customer ||
      !order.pickup ||
      !order.delivery ||
      !order.package
    ) {
      alert("Please fill all order details.");
      return;
    }

    try {
      const response = await axios.post(
        "http://localhost:5000/api/orders",
        order
      );

      console.log(
        "Created order:",
        response.data.order
      );

      alert("ORDER CREATED SUCCESSFULLY 🚚");

      setOrder({
        customer: "",
        pickup: "",
        delivery: "",
        package: "",
      });

      // Tell App.jsx that a new order was created
      if (onOrderCreated) {
        onOrderCreated(response.data.order);
      }

    } catch (error) {
      console.error(
        "Create order error:",
        error
      );

      alert("Could not create order.");
    }
  };

  return (
    <main className="dashboard">

      <div className="cyber-header">

        <div>
          <h1>
            CREATE DELIVERY ORDER
          </h1>

          <p>
            NEW DELIVERY REGISTRATION //
            ORDER NETWORK
          </p>
        </div>

        <div className="system-status">
          ● SYSTEM ONLINE
        </div>

      </div>


      <div className="order-form">

        <h2>
          + REGISTER NEW ORDER
        </h2>


        <form onSubmit={handleSubmit}>

          <input
            type="text"
            name="customer"
            placeholder="CUSTOMER NAME"
            value={order.customer}
            onChange={handleChange}
          />


          <input
            type="text"
            name="pickup"
            placeholder="PICKUP LOCATION"
            value={order.pickup}
            onChange={handleChange}
          />


          <input
            type="text"
            name="delivery"
            placeholder="DELIVERY LOCATION"
            value={order.delivery}
            onChange={handleChange}
          />


          <input
            type="text"
            name="package"
            placeholder="PACKAGE DETAILS"
            value={order.package}
            onChange={handleChange}
          />


          <button type="submit">
            + CREATE ORDER
          </button>

        </form>

      </div>

    </main>
  );
}

export default CreateOrder;