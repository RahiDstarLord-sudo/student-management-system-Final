
import React, { useEffect, useState } from "react";

const API = "http://localhost:5000/api";

export default function RegistrationManagementPage() {
  const [registrations, setRegistrations] = useState([]);
  const [activation, setActivation] = useState(null);
  const [approvedCredentials, setApprovedCredentials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    };
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: headers(),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  async function loadRegistrations() {
    setLoading(true);
    setError("");

    try {
      const data = await request("/admin/registrations/pending");
      setRegistrations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRegistrations();
  }, []);

  async function createActivation() {
    setError("");
    setMessage("");
    setActivation(null);

    try {
      const data = await request("/students/activation", {
        method: "POST",
      });

      setActivation(data);
      setMessage("Student ID and activation code created.");
      await loadRegistrations();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateRegistration(studentId, action) {
  if (!window.confirm(`Are you sure you want to ${action} ${studentId}?`)) {
    return;
  }

  setError("");
  setMessage("");
  setApprovedCredentials(null);

  try {
    const data = await request(
      `/admin/registrations/${encodeURIComponent(studentId)}/${action}`,
      { method: "PUT" }
    );

    if (action === "approve") {
      setApprovedCredentials({
        studentId: data.studentId || studentId,
        temporaryPassword: data.temporaryPassword,
      });
    }

    setMessage(data.message || "Registration updated successfully.");
    await loadRegistrations();
  } catch (err) {
    setError(err.message);
  }
}

  return (
    <div className="module-page registration-page">

      <div className="module-intro">
        <div>
          <span className="module-eyebrow">ACADEMIC MANAGEMENT</span>
          <h2>Student Registrations</h2>
          <p>Generate student IDs and review registration applications.</p>
        </div>

        <button
          className="module-button module-button-primary"
          onClick={createActivation}
        >
          + Generate Student ID
        </button>
      </div>

      <div className="module-stats">
        <div className="module-stat">
          <span>Pending Applications</span>
          <strong>{registrations.length}</strong>
          <small>Awaiting admin review</small>
        </div>

        <div className="module-stat">
          <span>Registration Process</span>
          <strong>2 Steps</strong>
          <small>Student submission → Admin approval</small>
        </div>

        <div className="module-stat">
          <span>Student ID</span>
          <strong>Admin Issued</strong>
          <small>Activation code required</small>
        </div>
      </div>

      {error && <div className="module-error">{error}</div>}
      {message && <div className="module-notice">{message}</div>}

      {activation && (
        <section className="module-panel activation-result">
          <div className="module-toolbar">
            <div>
              <h3>New Student Credentials</h3>
              <p>Share these credentials with the student.</p>
            </div>
            <span className="module-status active">Created</span>
          </div>

          <div className="credential-grid">
            <div>
              <span>Student ID</span>
              <strong>{activation.studentId}</strong>
            </div>

            <div>
              <span>Activation Code</span>
              <strong>{activation.activationCode}</strong>
            </div>
          </div>

          <p className="credential-expiry">
            Expires:{" "}
            {activation.expiresAt
              ? new Date(activation.expiresAt).toLocaleString()
              : "7 days"}
          </p>

          <button
            className="module-button module-button-quiet"
            onClick={() =>
              navigator.clipboard.writeText(
                `Student ID: ${activation.studentId}\nActivation Code: ${activation.activationCode}`
              )
            }
          >
            Copy Credentials
          </button>
        </section>
      )}
{approvedCredentials && (
  <section className="module-panel activation-result">
    <div className="module-toolbar">
      <div>
        <h3>Student Login Credentials</h3>
        <p>Save these credentials. The temporary password will not be shown again.</p>
      </div>
      <span className="module-status active">Approved</span>
    </div>

    <div className="credential-grid">
      <div>
        <span>Student Login ID</span>
        <strong>{approvedCredentials.studentId}</strong>
      </div>

      <div>
        <span>Temporary Password</span>
        <strong>{approvedCredentials.temporaryPassword}</strong>
      </div>
    </div>

    <button
      className="module-button module-button-quiet"
      onClick={() =>
        navigator.clipboard.writeText(
          `Student ID: ${approvedCredentials.studentId}\nTemporary Password: ${approvedCredentials.temporaryPassword}`
        )
      }
    >
      Copy Login Credentials
    </button>
  </section>
)}
      <section className="module-panel">
        <div className="module-toolbar">
          <div>
            <h3>Pending Registrations</h3>
            <p>Review student information before approving.</p>
          </div>

          <button
            className="module-button module-button-quiet"
            onClick={loadRegistrations}
            disabled={loading}
          >
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="module-loading">Loading registrations...</div>
        ) : registrations.length === 0 ? (
          <div className="module-empty">
            <div className="module-empty-icon">♙</div>
            <strong>No pending registrations</strong>
            <p>New student applications will appear here.</p>
          </div>
        ) : (
          <div className="module-table-wrap">
            <table className="module-table registration-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Student</th>
                  <th>Department</th>
                  <th>NID</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {registrations.map((student) => (
                  <tr key={student.student_id}>
                    <td>
                      <strong>{student.student_id}</strong>
                    </td>

                    <td>
                      <strong>{student.name || "Not submitted"}</strong>
                      <small>{student.email || "No email"}</small>
                    </td>

                    <td>{student.department_name || "Not selected"}</td>
                    <td>{student.nid || "—"}</td>
                    <td>{student.phone || "—"}</td>

                    <td>
                      <span className="module-status pending">Pending</span>
                    </td>

                    <td>
                      <div className="module-row-actions">
                        <button
                          onClick={() =>
                            updateRegistration(student.student_id, "approve")
                          }
                        >
                          Approve
                        </button>

                        <button
                          className="danger"
                          onClick={() =>
                            updateRegistration(student.student_id, "reject")
                          }
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
