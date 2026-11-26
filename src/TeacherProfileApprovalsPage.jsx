import React, { useCallback, useEffect, useState } from "react";
import { API_BASE } from "./services/apiConfig";
import "./TeacherProfileApprovals.css";

function headers(json = false) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  };
}

const PROFILE_FIELDS = [
  ["name", "Full name"],
  ["phone", "Phone"],
  ["dateOfBirth", "Date of birth"],
  ["gender", "Gender"],
  ["qualification", "Qualification"],
  ["specialization", "Specialization"],
  ["experienceYears", "Experience (years)"],
  ["emergencyContactName", "Emergency contact"],
  ["emergencyContactPhone", "Emergency phone"],
  ["address", "Address"],
  ["bio", "Professional bio"],
];

function displayValue(value) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  return String(value);
}

function valuesMatch(currentValue, submittedValue) {
  return String(currentValue ?? "").trim() ===
    String(submittedValue ?? "").trim();
}

export default function TeacherProfileApprovalsPage() {
  const [requests, setRequests] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/teachers/profile-requests`,
        { headers: headers() }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not load profile requests");
      }

      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Could not load profile requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function review(requestId, decision) {
    if (!["Approved", "Rejected"].includes(decision)) {
      return;
    }

    const action = decision === "Approved" ? "approve" : "reject";
    const confirmed = window.confirm(
      `Are you sure you want to ${action} this teacher profile request?`
    );

    if (!confirmed) {
      return;
    }

    setBusyId(requestId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/teachers/profile-requests/${requestId}/review`,
        {
          method: "PATCH",
          headers: headers(true),
          body: JSON.stringify({
            decision,
            adminNote: notes[requestId] || "",
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not review request");
      }

      setMessage(data.message || "Request reviewed successfully.");

      setNotes((current) => {
        const updated = { ...current };
        delete updated[requestId];
        return updated;
      });

      await load();
    } catch (err) {
      setError(err.message || "Could not review request");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="surface teacher-profile-approval-page">
      <div className="section-heading">
        <div>
          <h2>Teacher Profile Approvals</h2>
          <p>
            Compare submitted profile changes with the current profile before
            approving or rejecting them.
          </p>
        </div>

        <button
          type="button"
          className="button button-outline"
          onClick={load}
          disabled={loading || busyId !== null}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="teacher-approval-alert error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="teacher-approval-alert success" role="status">
          {message}
        </div>
      )}

      {loading ? (
        <p>Loading profile requests...</p>
      ) : requests.length === 0 ? (
        <div className="teacher-approval-empty">
          <h3>No Pending Requests</h3>
          <p>No teacher profile updates are waiting for approval.</p>
        </div>
      ) : (
        <div className="teacher-approval-list">
          {requests.map((request) => {
            const currentProfile = request.currentProfile || {};
            const submitted = request.submitted || {};

            return (
              <article className="teacher-approval-card" key={request.id}>
                <div className="teacher-approval-card-head">
                  <div>
                    <h3>
                      {request.currentName ||
                        submitted.name ||
                        "Teacher"}
                    </h3>

                    <p>
                      {request.teacherId || "No teacher ID"} |{" "}
                      {request.email || "No email"}
                    </p>
                  </div>

                  <span className="teacher-approval-status">Pending</span>
                </div>

                <div className="teacher-approval-comparison">
                  <div className="teacher-approval-comparison-heading">
                    <span>Profile field</span>
                    <span>Current information</span>
                    <span>Submitted information</span>
                  </div>

                  {PROFILE_FIELDS.map(([key, label]) => {
                    const currentValue = currentProfile[key];
                    const submittedValue = submitted[key];
                    const changed = !valuesMatch(
                      currentValue,
                      submittedValue
                    );

                    return (
                      <div
                        className={`teacher-approval-comparison-row ${
                          changed ? "is-changed" : ""
                        }`}
                        key={key}
                      >
                        <div className="teacher-approval-field-label">
                          {label}
                          {changed && (
                            <span className="teacher-approval-change-tag">
                              Changed
                            </span>
                          )}
                        </div>

                        <div className="teacher-approval-value">
                          <span className="teacher-approval-mobile-label">
                            Current
                          </span>
                          {displayValue(currentValue)}
                        </div>

                        <div className="teacher-approval-value">
                          <span className="teacher-approval-mobile-label">
                            Submitted
                          </span>
                          {displayValue(submittedValue)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <label className="teacher-approval-note">
                  Administrator Note
                  <textarea
                    rows="3"
                    maxLength="1000"
                    value={notes[request.id] || ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [request.id]: event.target.value,
                      }))
                    }
                    placeholder="Optional note for the teacher"
                    disabled={busyId === request.id}
                  />
                </label>

                <div className="teacher-approval-actions">
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={busyId !== null}
                    onClick={() => review(request.id, "Rejected")}
                  >
                    {busyId === request.id ? "Processing..." : "Reject"}
                  </button>

                  <button
                    type="button"
                    className="button button-primary"
                    disabled={busyId !== null}
                    onClick={() => review(request.id, "Approved")}
                  >
                    {busyId === request.id
                      ? "Processing..."
                      : "Approve Changes"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}