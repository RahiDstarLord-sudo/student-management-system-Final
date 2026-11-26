import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "./services/apiConfig";
import SearchableSelect from "./SearchableSelect";

const emptyOptions = { departments: [], courses: [], academicYears: [], semesters: [] };

function statusClass(status) {
  return `module-status ${String(status || "unknown").toLowerCase().replace(/[^a-z]+/g, "-")}`;
}

export default function RegistrationManagementPage() {
  const [registrations, setRegistrations] = useState([]);
  const [ids, setIds] = useState([]);
  const [options, setOptions] = useState(emptyOptions);
  const [selected, setSelected] = useState(null);
  const [review, setReview] = useState({ departmentId: "", courseId: "", academicYearId: "", semesterId: "", designation: "", courseIds: [] });
  const [activation, setActivation] = useState(null);
  const [activeTab, setActiveTab] = useState("requests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseSearch, setCourseSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function headers(json = false) {
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    };
  }

  async function request(path, init = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...headers(Boolean(init.body)), ...(init.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [requestRows, idRows, lookup] = await Promise.all([
        request("/admin/registrations/pending"),
        request("/admin/registration-ids"),
        request("/registration/options"),
      ]);
      setRegistrations(Array.isArray(requestRows) ? requestRows : []);
      setIds(Array.isArray(idRows) ? idRows : []);
      setOptions({
        departments: Array.isArray(lookup.departments) ? lookup.departments : [],
        courses: Array.isArray(lookup.courses) ? lookup.courses : [],
        academicYears: Array.isArray(lookup.academicYears) ? lookup.academicYears : [],
        semesters: Array.isArray(lookup.semesters) ? lookup.semesters : [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const departmentOptions = options.departments.map((item) => ({ id: item.id, label: `${item.department_code} — ${item.department_name}` }));
  const courseOptions = options.courses
    .filter((item) => !review.departmentId || String(item.department_id) === String(review.departmentId))
    .map((item) => ({ id: item.id, label: `${item.course_code} — ${item.course_name}` }));
  const yearOptions = options.academicYears.map((item) => ({ id: item.id, label: item.year_name }));
  const semesterOptions = options.semesters
    .filter((item) => !review.departmentId || String(item.department_id) === String(review.departmentId))
    .map((item) => ({ id: item.id, label: `Semester ${item.semester_number} — ${item.semester_name}` }));
  const filteredTeacherCourses = courseOptions.filter((item) => item.label.toLowerCase().includes(courseSearch.toLowerCase()));

  const filteredIds = useMemo(() => ids.filter((item) => {
    const text = `${item.id} ${item.type} ${item.status}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (statusFilter === "all" || item.status === statusFilter);
  }), [ids, search, statusFilter]);

  const filteredRegistrations = useMemo(() => registrations.filter((item) => {
    const text = `${item.registration_id} ${item.name} ${item.email} ${item.type} ${item.department_name}`.toLowerCase();
    return text.includes(search.toLowerCase());
  }), [registrations, search]);

  async function generateId(type) {
    setSaving(true); setError(""); setMessage(""); setActivation(null);
    try {
      const data = await request(`/registration-ids/${type}`, { method: "POST" });
      setActivation(data);
      setMessage(`${type === "student" ? "Student" : "Teacher"} ID generated. Share the ID and activation code with the registrant.`);
      await loadData();
      setActiveTab("ids");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function revokeId(item) {
    if (!window.confirm(`Revoke unused ${item.type} ID ${item.id}? This action cannot be undone.`)) return;
    setError(""); setMessage("");
    try {
      const data = await request(`/admin/registration-ids/${item.type}/${encodeURIComponent(item.id)}/revoke`, { method: "POST" });
      setMessage(data.message || "Registration ID revoked.");
      await loadData();
    } catch (err) { setError(err.message); }
  }

  function openReview(item) {
    setSelected(item);
    setCourseSearch("");
    const matchingDepartment = options.departments.find((department) => String(department.id) === String(item.department_id));
    const matchingCourse = options.courses.find((course) => String(course.department_id) === String(item.department_id) && String(course.course_name).toLowerCase() === String(item.course || "").toLowerCase());
    setReview({
      departmentId: matchingDepartment ? String(matchingDepartment.id) : "",
      courseId: matchingCourse ? String(matchingCourse.id) : "",
      academicYearId: "",
      semesterId: "",
      designation: item.designation || "Lecturer",
      courseIds: [],
    });
    setError(""); setMessage("");
  }

  async function processRegistration(action) {
    if (!selected) return;
    if (action === "approve") {
      if (!review.departmentId) return setError("Select an active department from the database options.");
      if (selected.type === "student" && (!review.courseId || !review.academicYearId || !review.semesterId)) {
        return setError("Select the department, course, academic session and semester before approving this student.");
      }
      if (selected.type === "teacher" && !review.designation.trim()) return setError("Enter the teacher designation before approval.");
    }
    const verb = action === "approve" ? "approve" : "reject";
    if (!window.confirm(`Are you sure you want to ${verb} ${selected.type} registration ${selected.registration_id}?`)) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = selected.type === "student" ? {
        departmentId: Number(review.departmentId),
        courseId: Number(review.courseId),
        academicYearId: Number(review.academicYearId),
        semesterId: Number(review.semesterId),
      } : {
        departmentId: Number(review.departmentId),
        designation: review.designation.trim(),
        courseIds: review.courseIds.map(Number),
      };
      const data = await request(`/admin/registrations/${selected.type}/${encodeURIComponent(selected.registration_id)}/${action}`, {
        method: "PUT",
        body: action === "approve" ? JSON.stringify(payload) : JSON.stringify({}),
      });
      setMessage(data.message || `${selected.type} registration ${action}d.`);
      setSelected(null);
      await loadData();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  const pendingStudentCount = registrations.filter((item) => item.type === "student").length;
  const pendingTeacherCount = registrations.filter((item) => item.type === "teacher").length;
  const unusedCount = ids.filter((item) => item.status === "unused").length;

  return (
    <section className="module-page registration-page">
      <div className="module-intro">
        <div>
          <span className="module-eyebrow">IDENTITY &amp; ADMISSIONS</span>
          <h2>Registration &amp; ID Management</h2>
          <p>Issue unique registration IDs, review applications and approve portal access.</p>
        </div>
        <div className="registration-generate-actions">
          <button className="module-button module-button-primary" type="button" onClick={() => generateId("student")} disabled={saving}>Generate Student ID</button>
          <button className="module-button module-button-primary" type="button" onClick={() => generateId("teacher")} disabled={saving}>Generate Teacher ID</button>
        </div>
      </div>

      <div className="module-stats">
        <div className="module-stat"><span>Pending student applications</span><strong>{pendingStudentCount}</strong><small>Awaiting admin review</small></div>
        <div className="module-stat"><span>Pending teacher applications</span><strong>{pendingTeacherCount}</strong><small>Awaiting admin review</small></div>
        <div className="module-stat"><span>Unused registration IDs</span><strong>{unusedCount}</strong><small>Issued and not yet used</small></div>
      </div>

      {error && <div className="module-error" role="alert">{error}</div>}
      {message && <div className="module-notice" role="status">{message}</div>}

      {activation && (
        <section className="module-panel activation-result">
          <div className="module-toolbar"><div><h3>New {activation.type} registration credentials</h3><p>Share these details securely. The activation code is shown only once.</p></div><span className={statusClass("issued")}>Issued</span></div>
          <div className="credential-grid">
            <div><span>{activation.type === "student" ? "Student ID" : "Teacher ID"}</span><strong>{activation.id}</strong></div>
            <div><span>Activation code</span><strong>{activation.activationCode}</strong></div>
          </div>
          <p className="credential-expiry">Expires: {new Date(activation.expiresAt).toLocaleString()}</p>
          <button className="module-button module-button-quiet" type="button" onClick={() => navigator.clipboard?.writeText(`${activation.type === "student" ? "Student" : "Teacher"} ID: ${activation.id}\nActivation code: ${activation.activationCode}`)}>Copy credentials</button>
        </section>
      )}

      <div className="registration-tabs" role="tablist" aria-label="Registration management views">
        <button type="button" role="tab" aria-selected={activeTab === "requests"} className={activeTab === "requests" ? "active" : ""} onClick={() => setActiveTab("requests")}>Pending applications ({registrations.length})</button>
        <button type="button" role="tab" aria-selected={activeTab === "ids"} className={activeTab === "ids" ? "active" : ""} onClick={() => setActiveTab("ids")}>Generated IDs ({ids.length})</button>
      </div>

      <section className="module-panel">
        <div className="module-toolbar">
          <div><h3>{activeTab === "requests" ? "Registration applications" : "Issued registration IDs"}</h3><p>{activeTab === "requests" ? "Only approved accounts can sign in to their portal." : "Track ID usage and revoke unused IDs when necessary."}</p></div>
          <button className="module-button module-button-quiet" type="button" onClick={loadData} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
        </div>
        <div className="registration-filters">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by ID, name, email or type" aria-label="Search registrations" />
          {activeTab === "ids" && <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter ID status"><option value="all">All statuses</option><option value="unused">Unused</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="revoked">Revoked</option><option value="expired">Expired</option></select>}
        </div>

        {loading ? <div className="module-loading">Loading registration data...</div> : activeTab === "requests" ? (
          filteredRegistrations.length ? (
            <div className="module-table-wrap">
              <table className="module-table registration-table">
                <thead><tr><th>Type / ID</th><th>Applicant</th><th>Department</th><th>Contact</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{filteredRegistrations.map((item) => (
                  <tr key={`${item.type}-${item.registration_id}`}>
                    <td><strong>{item.type === "student" ? "Student" : "Teacher"}</strong><small>{item.registration_id}</small></td>
                    <td><strong>{item.name}</strong><small>{item.email}</small></td>
                    <td>{item.department_name || "Not selected"}</td>
                    <td>{item.phone || "—"}</td>
                    <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
                    <td><span className={statusClass("pending")}>Pending</span></td>
                    <td><button type="button" className="module-button module-button-primary" onClick={() => openReview(item)}>Review</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="module-empty"><strong>No pending applications</strong><p>New student and teacher applications will appear here.</p></div>
        ) : (
          filteredIds.length ? (
            <div className="module-table-wrap">
              <table className="module-table registration-table">
                <thead><tr><th>Registration ID</th><th>Type</th><th>Created</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{filteredIds.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <td><strong>{item.id}</strong></td><td>{item.type === "student" ? "Student" : "Teacher"}</td>
                    <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
                    <td><span className={statusClass(item.status)}>{item.status}</span></td>
                    <td>{item.status === "unused" ? <button type="button" className="module-button module-button-danger" onClick={() => revokeId(item)}>Revoke</button> : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="module-empty"><strong>No registration IDs found</strong><p>Generate a Student ID or Teacher ID to get started.</p></div>
        )}
      </section>

      {selected && (
        <div className="registration-review-backdrop" role="presentation" onClick={() => !saving && setSelected(null)}>
          <section className="registration-review-panel" role="dialog" aria-modal="true" aria-labelledby="registration-review-title" onClick={(event) => event.stopPropagation()}>
            <div className="module-toolbar"><div><span className="module-eyebrow">{selected.type.toUpperCase()} APPLICATION</span><h3 id="registration-review-title">Review {selected.name}</h3><p>{selected.registration_id} · {selected.email}</p></div><button type="button" className="registration-close" onClick={() => setSelected(null)} aria-label="Close review">×</button></div>
            <div className="registration-applicant-summary"><span>Phone: {selected.phone || "Not provided"}</span><span>Department requested: {selected.department_name || "Not selected"}</span>{selected.type === "student" && <span>Requested course: {selected.course || "Not selected"}</span>}</div>
            <div className="registration-review-fields">
              <SearchableSelect label="Confirm department" options={departmentOptions} value={review.departmentId} onChange={(value) => setReview((current) => ({ ...current, departmentId: value, courseId: "", semesterId: "", courseIds: [] }))} required />
              {selected.type === "student" ? (
                <>
                  <SearchableSelect label="Assign course" options={courseOptions} value={review.courseId} onChange={(value) => setReview((current) => ({ ...current, courseId: value }))} required disabled={!review.departmentId} />
                  <SearchableSelect label="Academic session" options={yearOptions} value={review.academicYearId} onChange={(value) => setReview((current) => ({ ...current, academicYearId: value }))} required />
                  <SearchableSelect label="Semester" options={semesterOptions} value={review.semesterId} onChange={(value) => setReview((current) => ({ ...current, semesterId: value }))} required disabled={!review.departmentId} />
                </>
              ) : (
                <>
                  <label className="registration-field"><span>Designation</span><input required maxLength={100} value={review.designation} onChange={(event) => setReview((current) => ({ ...current, designation: event.target.value }))} placeholder="Enter teacher designation" /></label>
                  <fieldset className="registration-course-choices"><legend>Assign courses (optional)</legend><input type="search" value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} placeholder="Search courses in this department..." aria-label="Search teacher course assignments" />{filteredTeacherCourses.length ? filteredTeacherCourses.map((course) => <label key={course.id}><input type="checkbox" checked={review.courseIds.includes(String(course.id))} onChange={(event) => setReview((current) => ({ ...current, courseIds: event.target.checked ? [...current.courseIds, String(course.id)] : current.courseIds.filter((id) => id !== String(course.id)) }))} />{course.label}</label>) : <p>No matching courses are configured for this department.</p>}</fieldset>
                </>
              )}
            </div>
            <div className="registration-review-actions"><button type="button" className="module-button module-button-quiet" onClick={() => processRegistration("reject")} disabled={saving}>Reject</button><button type="button" className="module-button module-button-primary" onClick={() => processRegistration("approve")} disabled={saving}>{saving ? "Processing..." : "Approve registration"}</button></div>
          </section>
        </div>
      )}
    </section>
  );
}
