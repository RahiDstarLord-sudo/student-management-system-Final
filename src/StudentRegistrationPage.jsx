
import React, { useState } from "react";

const API = "http://localhost:5000/api";

export default function StudentRegistrationPage({ onBack }) {
  const [studentId, setStudentId] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [verified, setVerified] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nid, setNid] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function verifyActivation(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/registration/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentId.trim(),
          activationCode: activationCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Activation verification failed.");
      }

      setVerified(true);
      setMessage("Activation verified. Complete your registration.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitRegistration(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/registration/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentId.trim(),
          activationCode: activationCode.trim(),
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          nid: nid.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      setMessage(
        data.message ||
        "Registration submitted successfully. Please wait for Admin approval."
      );
      setVerified(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-mark">G</div>

        <h1>Student Registration</h1>
        <p>
          Greenfield College — Student Admission Registration
        </p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div role="status" style={{
            padding: "12px",
            marginBottom: "16px",
            borderRadius: "8px",
            background: "#f0fdf4",
            color: "#166534",
          }}>
            {message}
          </div>
        )}

        {!verified ? (
          <form onSubmit={verifyActivation}>
            <label>
              Student ID
              <input
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Enter your Student ID"
              />
            </label>

            <label>
              Activation Code
              <input
                required
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                placeholder="Enter your activation code"
              />
            </label>

            <button
              className="button button-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify Activation"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitRegistration}>
            <label>
              Student ID
              <input value={studentId} readOnly />
            </label>

            <label>
              Full Name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
              />
            </label>

            <label>
              Email Address
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </label>

            <label>
              Phone Number
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
              />
            </label>

            <label>
              NID Number
              <input
                value={nid}
                onChange={(e) => setNid(e.target.value)}
                placeholder="Enter your NID number"
              />
            </label>

            <button
              className="button button-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit Registration"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onBack}
          style={{
            width: "100%",
            marginTop: "14px",
            padding: "10px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
