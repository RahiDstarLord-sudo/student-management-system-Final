
import React, { useCallback, useEffect, useState } from "react";
import { API_BASE } from "./services/apiConfig";


export default function CourseRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const request = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: headers(),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await request("/admin/course-selection-requests");
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function reviewRequest(requestId, action) {
    const actionLabel = action === "approve" ? "approve" : "reject";

    if (
      !window.confirm(
        `Are you sure you want to ${actionLabel} request #${requestId}?`
      )
    ) {
      return;
    }

    setProcessingId(requestId);
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/admin/course-selection-requests/${requestId}/${action}`,
        { method: "PUT" }
      );

      setMessage(data.message || "Request updated successfully.");
      await loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="module-page registration-page">
      <div className="module-intro">
        <div>
          <span className="module-eyebrow">ACADEMIC MANAGEMENT</span>
          <h2>Course Selection Requests</h2>
          <p>Review and approve student course selection requests.</p>
        </div>

        <button
          className="module-button module-button-primary"
          onClick={loadRequests}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh Requests"}
        </button>
      </div>

      <div className="module-stats">
        <div className="module-stat">
          <span>Pending Requests</span>
          <strong>{requests.length}</strong>
          <small>Awaiting admin review</small>
        </div>

        <div className="module-stat">
          <span>Review Process</span>
          <strong>Admin</strong>
          <small>Approval required for enrollment</small>
        </div>

        <div className="module-stat">
          <span>Request Status</span>
          <strong>Pending</strong>
          <small>Only approved courses become active</small>
        </div>
      </div>

      {error && <div className="module-error">{error}</div>}
      {message && <div className="module-notice">{message}</div>}

      <section className="module-panel">
        <div className="module-toolbar">
          <div>
            <h3>Pending Course Requests</h3>
            <p>Review the selected courses before taking action.</p>
          </div>
        </div>

        {loading ? (
          <p>Loading course requests...</p>
        ) : requests.length === 0 ? (
          <p>No pending course selection requests found.</p>
        ) : (
          <div className="registration-list">
            {requests.map((item) => (
              <article
                className="registration-card"
                key={item.request_id}
              >
                <div className="module-toolbar">
                  <div>
                    <h3>
                      {item.student_name || "Unnamed Student"}
                    </h3>
                    <p>
                      Student ID: {item.student_id}
                    </p>
                    <p>
                      Email: {item.student_email || "Not available"}
                    </p>
                  </div>

                  <span className="module-status pending">
                    {item.status}
                  </span>
                </div>

                <div className="credential-grid">
                  <div>
                    <span>Academic Year</span>
                    <strong>{item.year_name}</strong>
                  </div>

                  <div>
                    <span>Semester</span>
                    <strong>
                      {item.semester_name ||
                        `Semester ${item.semester_number}`}
                    </strong>
                  </div>

                  <div>
                    <span>Request ID</span>
                    <strong>#{item.request_id}</strong>
                  </div>
                </div>

                <div className="course-request-courses">
                  <h4>Requested Courses</h4>

                  {item.courses?.length ? (
                    <ul>
                      {item.courses.map((course) => (
                        <li key={course.course_id}>
                          <strong>{course.course_code}</strong>
                          {" — "}
                          {course.course_name}
                          {" "}
                          ({course.credits} credits)
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No course details available.</p>
                  )}
                </div>

                <div className="registration-actions">
                  <button
                    className="module-button module-button-primary"
                    disabled={processingId !== null}
                    onClick={() =>
                      reviewRequest(item.request_id, "approve")
                    }
                  >
                    {processingId === item.request_id
                      ? "Processing..."
                      : "Approve"}
                  </button>

                  <button
                    className="module-button module-button-quiet"
                    disabled={processingId !== null}
                    onClick={() =>
                      reviewRequest(item.request_id, "reject")
                    }
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
