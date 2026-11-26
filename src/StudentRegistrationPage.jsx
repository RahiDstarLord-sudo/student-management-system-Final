import React, { useEffect, useState } from "react";
import { API_BASE } from "./services/apiConfig";
import SearchableSelect from "./SearchableSelect";

const emptyOptions = { departments: [], courses: [], academicYears: [], semesters: [] };

export default function StudentRegistrationPage({ onBack }) {
  const [type, setType] = useState("student");
  const [registrationId, setRegistrationId] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [options, setOptions] = useState(emptyOptions);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [departmentId, setDepartmentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [nid, setNid] = useState("");
  const [designation, setDesignation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/registration/options`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load registration options");
        if (active) setOptions({
          departments: Array.isArray(data.departments) ? data.departments : [],
          courses: Array.isArray(data.courses) ? data.courses : [],
          academicYears: Array.isArray(data.academicYears) ? data.academicYears : [],
          semesters: Array.isArray(data.semesters) ? data.semesters : [],
        });
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setOptionsLoading(false));
    return () => { active = false; };
  }, []);

  const departmentOptions = options.departments.map((item) => ({
    id: item.id,
    label: `${item.department_code} — ${item.department_name}`,
  }));
  const courseOptions = options.courses
    .filter((item) => !departmentId || String(item.department_id) === String(departmentId))
    .map((item) => ({ id: item.id, label: `${item.course_code} — ${item.course_name}` }));

  function changeType(nextType) {
    setType(nextType);
    setRegistrationId("");
    setActivationCode("");
    setVerified(false);
    setDepartmentId("");
    setCourseId("");
    setName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setNid("");
    setDesignation("");
    setError("");
    setMessage("");
  }

  async function verifyActivation(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/registration/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id: registrationId.trim(), activationCode: activationCode.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Registration ID verification failed");
      setVerified(true);
      setMessage("ID verified. Complete your registration details below.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitRegistration(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!departmentId) return setError("Select a department from the database suggestions.");
    if (type === "student" && !courseId) return setError("Select a course from the database suggestions.");
    if (password.length < 8) return setError("Password must contain at least 8 characters.");
    if (new TextEncoder().encode(password).length > 72) {
      return setError("Password must not exceed 72 UTF-8 bytes.");
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/registration/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          id: registrationId.trim(),
          activationCode: activationCode.trim(),
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          nid: nid.trim(),
          departmentId: Number(departmentId),
          courseId: courseId ? Number(courseId) : null,
          designation: designation.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Registration could not be submitted");
      setMessage(data.message || "Registration submitted. Wait for admin approval before signing in.");
      setVerified(false);
      setRegistrationId("");
      setActivationCode("");
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card registration-card">
        <div className="brand-mark">G</div>
        <h1>Greenfield University</h1>
        <p>Register with an ID issued by the university administration.</p>

        <div className="registration-type-switch" role="group" aria-label="Registration type">
          <button type="button" className={type === "student" ? "active" : ""} onClick={() => changeType("student")}>Student</button>
          <button type="button" className={type === "teacher" ? "active" : ""} onClick={() => changeType("teacher")}>Teacher</button>
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}
        {message && <div className="registration-success" role="status">{message}</div>}

        {optionsLoading ? <p>Loading available departments and courses...</p> : !verified ? (
          <form onSubmit={verifyActivation}>
            <label>
              {type === "student" ? "Student ID" : "Teacher ID"}
              <input required value={registrationId} onChange={(event) => setRegistrationId(event.target.value.toUpperCase())} placeholder={type === "student" ? "Enter your Student ID" : "Enter your Teacher ID"} autoComplete="off" />
            </label>
            <label>
              Activation code
              <input required maxLength={32} value={activationCode} onChange={(event) => setActivationCode(event.target.value.toUpperCase())} placeholder="Enter the activation code" autoComplete="off" />
            </label>
            <button className="button button-primary" type="submit" disabled={loading}>{loading ? "Verifying..." : "Verify ID"}</button>
          </form>
        ) : (
          <form onSubmit={submitRegistration}>
            <label>
              {type === "student" ? "Student ID" : "Teacher ID"}
              <input value={registrationId} readOnly />
            </label>
            <label>
              Full name
              <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your full name" />
            </label>
            <label>
              Email address
              <input required type="email" maxLength={100} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" />
            </label>
            <label>
              Create password
              <input required type="password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
            </label>
            <label>
              Phone number
              <input maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Enter your phone number" />
            </label>
            <SearchableSelect label="Department" options={departmentOptions} value={departmentId} onChange={(value) => { setDepartmentId(value); setCourseId(""); }} required placeholder="Search active departments..." />
            {type === "student" ? (
              <>
                <SearchableSelect label="Requested course" options={courseOptions} value={courseId} onChange={setCourseId} required disabled={!departmentId} placeholder="Search courses in selected department..." />
                <label>
                  NID number
                  <input maxLength={30} value={nid} onChange={(event) => setNid(event.target.value)} placeholder="Enter your NID number" />
                </label>
              </>
            ) : (
              <label>
                Designation
                <input required maxLength={100} value={designation} onChange={(event) => setDesignation(event.target.value)} placeholder="e.g. Lecturer, Assistant Professor" />
              </label>
            )}
            <button className="button button-primary" type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit registration"}</button>
          </form>
        )}

        <button type="button" onClick={onBack} className="registration-back">Back to login</button>
      </div>
    </div>
  );
}
