import { useEffect, useState } from "react";
import axios from "axios";

function Drivers({ onTrackDriver }) {
  const [drivers, setDrivers] = useState([]);

  const [driver, setDriver] = useState({
    name: "",
    phone: "",
    vehicle: "",
  });

  const [scanningDriver, setScanningDriver] =
    useState(null);

  const [scannedDriver, setScannedDriver] =
    useState(null);

  /* =========================================
     LOAD DRIVERS
  ========================================= */

  const loadDrivers = async () => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/drivers"
      );

      setDrivers(response.data);
    } catch (error) {
      console.error(
        "Error loading drivers:",
        error
      );
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  /* =========================================
     REGISTER DRIVER
  ========================================= */

  const addDriver = async (e) => {
    e.preventDefault();

    if (
      !driver.name ||
      !driver.phone ||
      !driver.vehicle
    ) {
      alert("Please fill all driver details.");
      return;
    }

    try {
      const response = await axios.post(
        "http://localhost:5000/api/drivers",
        driver
      );

      setDrivers((currentDrivers) => [
        ...currentDrivers,
        response.data.driver,
      ]);

      setDriver({
        name: "",
        phone: "",
        vehicle: "",
      });

      alert(
        "DRIVER REGISTERED SUCCESSFULLY"
      );
    } catch (error) {
      console.error(
        "Error adding driver:",
        error
      );

      alert(
        error.response?.data?.message ||
        "Could not add driver."
      );
    }
  };

  /* =========================================
     DELETE DRIVER
  ========================================= */

  const deleteDriver = async (id) => {
    try {
      await axios.delete(
        `http://localhost:5000/api/drivers/${id}`
      );

      setDrivers((currentDrivers) =>
        currentDrivers.filter(
          (item) => item._id !== id
        )
      );
    } catch (error) {
      console.error(
        "Error deleting driver:",
        error
      );

      alert(
        error.response?.data?.message ||
        "Could not delete driver."
      );
    }
  };

  /* =========================================
     SCAN DRIVER
  ========================================= */

  const scanDriver = (selectedDriver) => {
    setScannedDriver(null);

    setScanningDriver(selectedDriver);

    setTimeout(() => {
      setScanningDriver(null);

      setScannedDriver(selectedDriver);
    }, 2200);
  };

  /* =========================================
     CLOSE SCAN
  ========================================= */

  const closeScanResult = () => {
    setScannedDriver(null);
  };

  /* =========================================
     TRACK DRIVER
  ========================================= */

  const trackDriver = (selectedDriver) => {
    if (onTrackDriver) {
      onTrackDriver(selectedDriver);
    } else {
      alert(
        `Opening tracking for ${selectedDriver.name}`
      );
    }
  };

  return (
    <div className="drivers-page">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="cyber-header">

        <div>

          <h1>
            DRIVER COMMAND CENTER
          </h1>

          <p>
            REAL-TIME DRIVER REGISTRY //
            VEHICLE MONITORING
          </p>

        </div>

        <div className="system-status">

          <span>●</span>

          SYSTEM ONLINE

        </div>

      </div>


      {/* =====================================
          REGISTER DRIVER
      ===================================== */}

      <div className="driver-form">

        <h2>
          + REGISTER NEW DRIVER
        </h2>

        <input
          type="text"
          placeholder="DRIVER NAME"
          value={driver.name}
          onChange={(e) =>
            setDriver({
              ...driver,
              name: e.target.value,
            })
          }
        />

        <input
          type="text"
          placeholder="CONTACT NUMBER"
          value={driver.phone}
          onChange={(e) =>
            setDriver({
              ...driver,
              phone: e.target.value,
            })
          }
        />

        <input
          type="text"
          placeholder="VEHICLE ID / NUMBER"
          value={driver.vehicle}
          onChange={(e) =>
            setDriver({
              ...driver,
              vehicle: e.target.value,
            })
          }
        />

        <button
          type="submit"
          onClick={addDriver}
        >
          + REGISTER DRIVER
        </button>

      </div>


      {/* =====================================
          COMMAND BAR
      ===================================== */}

      <div className="driver-command-bar">

        <div>

          <span>
            ACTIVE DRIVERS
          </span>

          <strong>
            {drivers.length}
          </strong>

        </div>


        <div>

          <span>
            NETWORK
          </span>

          <strong className="status-online">
            ● ONLINE
          </strong>

        </div>


        <div>

          <span>
            MONITOR
          </span>

          <strong className="status-active">
            LIVE
          </strong>

        </div>

      </div>


      {/* =====================================
          DRIVER LIST
      ===================================== */}

      <div className="drivers-list">

        {drivers.length === 0 ? (

          <div className="empty-module">

            <div className="module-icon">
              ◉
            </div>

            <h3>
              NO DRIVERS DETECTED
            </h3>

            <p>
              REGISTER A DRIVER TO INITIALIZE
              THE DELIVERY NETWORK.
            </p>

          </div>

        ) : (

          drivers.map((item, index) => (

            <div
              className="driver-card cyber-driver"
              key={item._id}
            >

              <div className="driver-scan-line"></div>


              {/* DRIVER IDENTITY */}

              <div className="driver-identity">

                <div className="driver-avatar">
                  ◉
                </div>

                <div>

                  <div className="driver-number">

                    DRIVER-
                    {String(index + 1).padStart(
                      3,
                      "0"
                    )}

                  </div>

                  <h3>
                    {item.name}
                  </h3>

                  <div className="driver-online">

                    <span>
                      ●
                    </span>

                    {" "}

                    {item.status ||
                      "Available"}

                  </div>

                </div>

              </div>


              {/* DRIVER DETAILS */}

              <div className="driver-data">

                <div>

                  <small>
                    CONTACT
                  </small>

                  <strong>
                    {item.phone}
                  </strong>

                </div>


                <div>

                  <small>
                    VEHICLE ID
                  </small>

                  <strong>
                    {item.vehicle}
                  </strong>

                </div>

              </div>


              {/* DRIVER ACTIONS */}

              <div className="driver-actions">

                {/* TRACK */}

                <button
                  onClick={() =>
                    trackDriver(item)
                  }
                >
                  ◉ TRACK
                </button>


                {/* SCAN */}

                <button
                  onClick={() =>
                    scanDriver(item)
                  }
                >
                  ⌕ SCAN
                </button>


                {/* DELETE */}

                <button
                  className="delete-button"
                  onClick={() =>
                    deleteDriver(item._id)
                  }
                >
                  × DELETE
                </button>

              </div>

            </div>

          ))

        )}

      </div>


      {/* =====================================
          SCANNING SCREEN
      ===================================== */}

      {scanningDriver && (

        <div className="driver-scan-overlay">

          <div className="driver-scan-modal">

            <div className="scan-corner top-left"></div>

            <div className="scan-corner top-right"></div>

            <div className="scan-corner bottom-left"></div>

            <div className="scan-corner bottom-right"></div>


            <div className="scan-title">

              SCANNING DRIVER

            </div>


            {/* SCANNING IMAGE / ANIMATION */}

            <div className="scan-visual">

              <div className="scan-avatar">
                ◉
              </div>

              <div className="scan-ring ring-one"></div>

              <div className="scan-ring ring-two"></div>

              <div className="scan-line"></div>

              <div className="scan-grid"></div>

            </div>


            <h2>
              {scanningDriver.name}
            </h2>


            <p className="scan-status-text">

              SCANNING DRIVER DETAILS...

            </p>


            <div className="scan-progress">

              <div className="scan-progress-bar"></div>

            </div>


            <div className="scan-details-loading">

              <span>
                CONTACT
              </span>

              <span>
                VEHICLE
              </span>

              <span>
                STATUS
              </span>

            </div>

          </div>

        </div>

      )}


      {/* =====================================
          SCAN RESULT
      ===================================== */}

      {scannedDriver && (

        <div className="driver-scan-overlay">

          <div className="driver-scan-modal scan-complete">


            <div className="scan-success-icon">
              ✓
            </div>


            <div className="scan-title">

              SCAN COMPLETE

            </div>


            <h2>
              {scannedDriver.name}
            </h2>


            <div className="scanned-driver-details">


              <div>

                <small>
                  DRIVER ID
                </small>

                <strong>
                  {scannedDriver._id}
                </strong>

              </div>


              <div>

                <small>
                  CONTACT
                </small>

                <strong>
                  {scannedDriver.phone}
                </strong>

              </div>


              <div>

                <small>
                  VEHICLE
                </small>

                <strong>
                  {scannedDriver.vehicle}
                </strong>

              </div>


              <div>

                <small>
                  CURRENT STATUS
                </small>

                <strong className="scan-status">

                  ●{" "}
                  {scannedDriver.status ||
                    "Available"}

                </strong>

              </div>

            </div>


            <div className="scan-verified">

              ✓ DRIVER DETAILS VERIFIED

            </div>


            <button
              className="close-scan-button"
              onClick={closeScanResult}
            >
              CLOSE SCAN
            </button>

          </div>

        </div>

      )}

    </div>
  );
}

export default Drivers;