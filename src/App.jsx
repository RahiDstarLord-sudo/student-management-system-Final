
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "./services/apiConfig";
import "./App.css";
import StudentPortal from "./StudentPortal";
import { ExaminationsPage, TimetablePage, MessagesPage, SettingsPage } from "./AdminModules";
import CourseRequestsPage from "./CourseRequestsPage";
import TeacherPortal from "./TeacherPortal";
import StudentRegistrationPage from "./StudentRegistrationPage";
import RegistrationManagementPage from "./RegistrationManagementPage";
import TeacherCourseAssignmentsPage from "./TeacherCourseAssignmentsPage";
import AcademicStructurePage from "./AcademicStructurePage";
import TeacherProfileApprovalsPage from "./TeacherProfileApprovalsPage";
import TeacherAvailabilityPage from "./TeacherAvailabilityPage";

/* =========================================================
   01. API CONFIGURATION & AUTHENTICATION
========================================================= */

const API_URL = `${API_BASE}/students`;
const LEAVES_API = `${API_BASE}/leaves`;

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");

  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  };
}

/* =========================================================
   02. NAVIGATION & STATIC DATA
========================================================= */

const navigation = [
  { heading: "OVERVIEW", items: [{ label: "Dashboard", icon: "DB" }] },
  {
    heading: "ACADEMIC",
    items: [
      { label: "Students", icon: "ST" },
      { label: "Registration & IDs", icon: "ID" },
      { label: "Course Requests", icon: "CR" },
      { label: "Teachers", icon: "TC" },
      { label: "Teacher Course Assignments", icon: "TC" },
      { label: "Teacher Availability", icon: "AT" },
      { label: "Academic Structure", icon: "CO" },
      { label: "Teacher Profile Approvals", icon: "PA" },
      { label: "Courses", icon: "CO" },
      { label: "Attendance", icon: "AT" },
      { label: "Examinations", icon: "EX" },
      { label: "Results", icon: "RS" },
      { label: "Timetable", icon: "TT" },
    ],
  },
  {
    heading: "ADMINISTRATION",
    items: [
      { label: "Fees & Payments", icon: "FE" },
      { label: "Leave Requests", icon: "LV" },
      { label: "Messages", icon: "MS" },
      { label: "Settings", icon: "SE" },
    ],
  },
];

const navIconPaths = {
  DB: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  ST: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  ID: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="11" r="2" /><path d="M5.5 16a3 3 0 0 1 6 0M14 10h4M14 14h4" /></>,
  CR: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" /></>,
  TC: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  PA: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 12-4.9M16 19l2 2 4-5" /></>,
  CO: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" /><path d="M4 5.5v13M8 7h8M8 11h8" /></>,
  AT: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 9h18M8 14l2 2 5-5" /></>,
  EX: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  RS: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  TT: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 9h18M8 13h2M14 13h2M8 17h2" /></>,
  FE: <><rect x="3" y="6" width="18" height="15" rx="2" /><path d="M3 10h18M16 15h2M7 6V4a2 2 0 0 1 2-2h9" /></>,
  LV: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2M16.5 3.5l2 2" /></>,
  MS: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></>,
  SE: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-2 .9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-2-.9l-1.7.7-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 2-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 2 .9l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2z" /></>
};

function NavIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {navIconPaths[name] || <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
/* =========================================================
   REUSABLE SUCCESS TOAST
========================================================= */
function SuccessToast({ message, onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, duration]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "24px",
        right: "24px",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        maxWidth: "min(460px, calc(100vw - 32px))",
        padding: "14px 16px",
        color: "#166534",
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        borderLeft: "4px solid #16a34a",
        borderRadius: "12px",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.16)",
        fontWeight: 600,
      }}
    >
      <span aria-hidden="true" style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: "26px", height: "26px", flexShrink: 0, borderRadius: "50%",
        color: "#fff", background: "#16a34a", fontSize: "16px",
      }}>✓</span>
      <span style={{ flex: 1, overflowWrap: "anywhere" }}>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification"
        style={{ border: 0, background: "transparent", color: "#166534",
          cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "2px 4px" }}>×</button>
    </div>
  );
}

/* =========================================================
   03. MAIN APPLICATION
========================================================= */

function App() {
  // Navigation
  const [activePage, setActivePage] = useState("Dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  // Student data
  const [students, setStudents] = useState([]);
  const [studentDepartments, setStudentDepartments] = useState([]);
  const [studentCourses, setStudentCourses] = useState([]);
  const [dashboardMetrics, setDashboardMetrics] = useState({ teachers: null, courses: null, attendance: null });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentStudentPage, setCurrentStudentPage] = useState(1);
  const studentPageSize = 10;

  // Student forms and modals
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentToDelete, setStudentToDelete] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    course: "",
  });

  // Header dropdowns
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Authentication
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });

  /* -------------------- DATA LOADING -------------------- */

  useEffect(() => {
    if (!user || user.role === "student") return;

    fetch(API_URL, { headers: authHeaders() })
      .then((response) => {
        if (response.status === 401) {
          logout();
          throw new Error("Session expired");
        }

        return response.json();
      })
      .then((data) => {
        setStudents(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("Failed to load students:", error);
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || user.role === "student" || user.role === "teacher") return;

    Promise.all([
      fetch(`${API_BASE}/departments`, { headers: authHeaders() }),
      fetch(`${API_BASE}/courses`, { headers: authHeaders() }),
    ])
      .then(async ([departmentResponse, courseResponse]) => {
        const [departmentData, courseData] = await Promise.all([
          departmentResponse.json(),
          courseResponse.json(),
        ]);
        if (!departmentResponse.ok) throw new Error(departmentData.error || "Could not load departments");
        if (!courseResponse.ok) throw new Error(courseData.error || "Could not load courses");
        setStudentDepartments(Array.isArray(departmentData) ? departmentData.filter((item) => item.status === "Active") : []);
        setStudentCourses(Array.isArray(courseData) ? courseData : []);
      })
      .catch((error) => console.error("Failed to load student assignment options:", error));
  }, [user]);

  useEffect(() => {
    if (!user || user.role === "student" || user.role === "teacher") return;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const load = async (path) => {
      const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load dashboard data");
      return data;
    };

    Promise.allSettled([
      load("/teachers"),
      load("/courses"),
      load(`/attendance?date=${today}`),
    ]).then(([teacherResult, courseResult, attendanceResult]) => {
      const teacherRows = teacherResult.status === "fulfilled" && Array.isArray(teacherResult.value) ? teacherResult.value : null;
      const courseRows = courseResult.status === "fulfilled" && Array.isArray(courseResult.value) ? courseResult.value : null;
      let attendance = null;
      if (attendanceResult.status === "fulfilled" && Array.isArray(attendanceResult.value)) {
        const rows = attendanceResult.value;
        const marked = rows.filter((row) => ["Present", "Absent", "Late"].includes(row.status));
        attendance = marked.length ? Math.round((marked.filter((row) => row.status === "Present" || row.status === "Late").length / marked.length) * 1000) / 10 : null;
      }
      setDashboardMetrics({
        teachers: teacherRows ? teacherRows.length : null,
        courses: courseRows ? courseRows.length : null,
        attendance,
      });
    });
  }, [user]);

  /* -------------------- AUTHENTICATION -------------------- */

  function handleLogin(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }

  function logout() {
    const token = localStorage.getItem("token");

    // Clear the local session immediately; revoke the server-side session too.
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);

    if (token) {
      fetch(`${API_BASE}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch((error) => {
        console.error("Server-side logout request failed:", error);
      });
    }
  }

  /* -------------------- STUDENT FILTERING -------------------- */

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const searchText = `${student.name} ${student.email} ${student.id} ${student.course}`;

      const matchesSearch = searchText
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || student.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [students, search, statusFilter]);

  useEffect(() => {
    setCurrentStudentPage(1);
  }, [search, statusFilter]);

  const studentTotalPages = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
  const paginatedStudents = filteredStudents.slice(
    (currentStudentPage - 1) * studentPageSize,
    currentStudentPage * studentPageSize
  );

  /* -------------------- DATE -------------------- */

  const date = new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  /* -------------------- ADD STUDENT -------------------- */

  async function addStudent(event) {
    event.preventDefault();

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(form),
      });

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to save student");
      }

      const newRecord = await response.json();

      setStudents((current) => [newRecord, ...current]);
      setForm({ name: "", email: "", course: "" });
      setShowModal(false);
      setActivePage("Students");
    } catch (error) {
      console.error(error);
      alert("Could not save the student. Is the backend running?");
    }
  }

  /* -------------------- UPDATE STUDENT -------------------- */

  async function updateStudent(event) {
    event.preventDefault();

    try {
      const response = await fetch(
        `${API_URL}/${editingStudent.id}`,
        {
          method: "PUT",
          headers: authHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(editingStudent),
        }
      );

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update student");
      }

      const updated = await response.json();

      setStudents((current) =>
        current.map((student) =>
          student.id === updated.id ? updated : student
        )
      );

      setEditingStudent(null);
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not update the student.");
    }
  }

  /* -------------------- DELETE STUDENT -------------------- */

  async function deleteStudent(studentId) {
    

    try {
      const response = await fetch(`${API_URL}/${studentId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to delete student");
      }

      setStudents((current) =>
        current.filter((student) => student.id !== studentId)
      );
    } catch (error) {
      console.error(error);
      alert("Could not delete the student.");
    }
  }

  /* -------------------- NAVIGATION -------------------- */

  function selectPage(page) {
    setActivePage(page);
    setMobileMenu(false);
    setSearch("");
  }

  /* -------------------- AUTHENTICATION ROUTING -------------------- */

  /* -------------------- AUTHENTICATION ROUTING -------------------- */

if (!user) {
  if (showRegistration) {
    return (
      <StudentRegistrationPage
        onBack={() => setShowRegistration(false)}
      />
    );
  }

  return (
    <LoginPage
      onLogin={handleLogin}
      onRegister={() => setShowRegistration(true)}
    />
  );
}

// Student and Teacher must change temporary password first.
if (
  ["student", "teacher"].includes(user.role) &&
  user.mustChangePassword
) {
  return (
    <FirstLoginPasswordChange
      user={user}
      onLogout={logout}
      onPasswordChanged={() => {
        const updatedUser = {
          ...user,
          mustChangePassword: false,
        };

        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
      }}
    />
  );
}

if (user.role === "student") {
  return <StudentPortal user={user} onLogout={logout} />;
}

if (user.role === "teacher") {
  return <TeacherPortal user={user} onLogout={logout} />;
}

  /* =========================================================
     04. MAIN ADMIN LAYOUT
  ========================================================= */

  return (
    <div className="app">

      {/* Mobile Sidebar Backdrop */}

      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* ================= SIDEBAR ================= */}

      <aside
        className={`sidebar ${mobileMenu ? "sidebar-visible" : ""}`}
      >
        <div className="brand">
          <div className="brand-mark">G</div>

          <div>
            <h2>Greenfield</h2>
            <span>UNIVERSITY PORTAL</span>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <div className="institution">
          <div className="institution-symbol">G</div>

          <div>
            <strong>Greenfield University</strong>
            <span>University Portal</span>
          </div>

          <span className="institution-arrow">⌄</span>
        </div>

        <nav className="navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.heading}>
              <p className="nav-heading">{group.heading}</p>

              {group.items.map((item) => (
                <button
                  key={item.label}
                  className={`nav-link ${
                    activePage === item.label ? "selected" : ""
                  }`}
                  onClick={() => selectPage(item.label)}
                >
                  <span className="nav-symbol"><NavIcon name={item.icon} /></span>
                  <span>{item.label}</span>


                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}

        <div className="sidebar-footer">
          <div className="help-box">
            <span>SUPPORT</span>
            <strong>Need assistance?</strong>
            <p>Contact the administration support team.</p>

            <button onClick={() => selectPage("Help Center")}>
              Help centre <span>↗</span>
            </button>
          </div>

          <div className="admin-profile">
            <div className="admin-avatar">{(user.name || user.full_name || user.email || "AD").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>

            <div className="admin-details">
              <strong>{user.name || user.full_name || user.email || "Administrator"}</strong>
              <span>"Administrator"</span>
            </div>

            <span className="profile-dots">•••</span>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}

      <main className="main">

        {/* ================= TOPBAR ================= */}

        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              onClick={() => setMobileMenu(true)}
              aria-label="Open menu"
            >
              {"\u2630"}
            </button>

            <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{activePage}</strong></div>
          </div>

          <div className="topbar-right">

            {/* Global Search */}

            <div className="top-search">
              <span>{"\u2315"}</span>

              <input
                placeholder="Search students, courses..."
                value={search}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearch(value);

                  if (value.trim()) {
                    setActivePage("Students");
                  }
                }}
              />

              <kbd>Ctrl K</kbd>
            </div>

            {/* Notifications */}

            <div className="dropdown-wrap">
              <button
                className="header-icon"
                aria-label="Notifications"
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setProfileOpen(false);
                }}
              >
                {"\u25C9"}<i />
              </button>

              {notificationsOpen && (
                <div className="dropdown">
                  <strong>Notifications</strong>
                  <p>System notifications</p>
                  <div className="dropdown-row">
                    <span>No notification feed is connected yet.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Administrator Profile */}

            <div className="dropdown-wrap">
              <button
                className="header-profile"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotificationsOpen(false);
                }}
              >
                <div className="admin-avatar small">{(user.name || user.full_name || user.email || "AD").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>
                <span>{user.name || user.full_name || user.email || "Administrator"}</span>
                <b>{"\u2304"}</b>
              </button>

              {profileOpen && (
                <div className="dropdown profile-dropdown">
                  <strong>{user.name || user.full_name || user.email || "Administrator"}</strong>
                  <p>"Administrator"</p>

                  <button
                    onClick={() => {
                      selectPage("Settings");
                      setProfileOpen(false);
                    }}
                  >
                    Account settings
                  </button>

                  <button onClick={() => setProfileOpen(false)}>
                    Close menu
                  </button>

                  <button onClick={logout}>Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ================= PAGE CONTENT ================= */}

        <div className="content">

          {/* Page Heading */}

          <section className={`page-heading ${activePage === "Dashboard" ? "dashboard-page-heading" : ""}`}>
            <div>
              <p className="eyebrow">{date}</p>

              <h1>
                {activePage === "Dashboard"
                  ? `Welcome, ${(user.name || user.full_name || user.email || "Administrator").split(/[\s@]/)[0]}`
                  : activePage}
              </h1>

              <p className="page-description">
                {activePage === "Dashboard"
                  ? "Here is an overview of your university management workspace."
                  : `Manage and review university ${activePage.toLowerCase()} information.`}
              </p>
            </div>

            <div className="heading-actions">
              <button
                className="button button-outline"
                onClick={() => window.print()}
              >
                <span>↓</span> Export
              </button>


            </div>
          </section>

          {/* =================================================
             DASHBOARD PAGE
          ================================================= */}

          {activePage === "Dashboard" ? (
            <>

              {/* Dashboard Statistics */}

              <section className="metric-grid">
                <Metric
                  label="Total students"
                  value={students.length.toLocaleString("en-US")}
                  change="Live records"
                  detail="Loaded from the student directory"
                  icon="ST"
                />

                <Metric
                  label="Teaching staff"
                  value={dashboardMetrics.teachers === null ? "—" : dashboardMetrics.teachers.toLocaleString("en-US")}
                  change={dashboardMetrics.teachers === null ? "Unavailable" : "Live records"}
                  detail={dashboardMetrics.teachers === null ? "Teacher summary could not be loaded" : "Loaded from teacher records"}
                  icon="TC"
                />

                <Metric
                  label="Courses"
                  value={dashboardMetrics.courses === null ? "—" : dashboardMetrics.courses.toLocaleString("en-US")}
                  change={dashboardMetrics.courses === null ? "Unavailable" : "Live records"}
                  detail={dashboardMetrics.courses === null ? "Course summary could not be loaded" : "Loaded from course records"}
                  icon="CO"
                />

                <Metric
                  label="Today's attendance"
                  value={dashboardMetrics.attendance === null ? "—" : `${dashboardMetrics.attendance}%`}
                  change={dashboardMetrics.attendance === null ? "No data" : "Live records"}
                  detail={dashboardMetrics.attendance === null ? "No marked attendance records are available" : "Present and late records for today"}
                  icon="AT"
                />
              </section>

              {/* Academic insights */}

              <section className="overview-grid">
                <article className="surface enrollment-card">
                  <div className="section-heading">
                    <div>
                      <h2>Academic overview</h2>
                      <p>Verified information available from connected modules</p>
                    </div>
                  </div>
                  <div className="dashboard-empty-state">
                    <strong>{students.length.toLocaleString("en-US")}</strong>
                    <span>Student records currently available</span>
                    <p>Additional enrolment trends will appear when historical reporting data is connected.</p>
                  </div>
                </article>
                <article className="surface attendance-card">
                  <div className="section-heading">
                    <div>
                      <h2>Attendance summary</h2>
                      <p>Today's attendance based on marked records</p>
                    </div>
                  </div>
                  <div className="dashboard-empty-state">
                    <strong>{dashboardMetrics.attendance === null ? "No data" : `${dashboardMetrics.attendance}%`}</strong>
                    <span>{dashboardMetrics.attendance === null ? "No marked attendance records are available for today." : "Present and late attendance across today's marked records."}</span>
                    <p>Open Attendance to review or update the underlying records.</p>
                    <button className="button button-outline" onClick={() => selectPage("Attendance")}>Open attendance</button>
                  </div>
                </article>
              </section>

              {/* Recently Registered Students */}

              <section className="surface recent-section">
                <div className="section-heading recent-heading">
                  <div>
                    <h2>Student directory preview</h2>
                    <p>A quick look at records returned by the student directory</p>
                  </div>

                  <button
                    className="view-link"
                    onClick={() => selectPage("Students")}
                  >
                    View all students →
                  </button>
                </div>

                <StudentTable
                  students={students.slice(0, 5)}
                  onDelete={deleteStudent}
                  onEdit={setEditingStudent}
                />
              </section>

              {/* Dashboard Bottom Section */}

              <section className="bottom-overview">

                {/* Quick Access */}

                <article className="surface activity-card">
                  <div className="section-heading">
                    <div>
                      <h2>Quick access</h2>
                      <p>Commonly used administration tasks</p>
                    </div>
                  </div>

                  <div className="quick-links">
                    

                    <button onClick={() => selectPage("Attendance")}>
                      <span>◷</span>

                      <div>
                        <strong>Manage attendance</strong>
                        <small>Review daily attendance</small>
                      </div>

                      <b>→</b>
                    </button>

                    <button onClick={() => selectPage("Examinations")}>
                      <span>▣</span>

                      <div>
                        <strong>Examinations</strong>
                        <small>Manage exam schedules</small>
                      </div>

                      <b>→</b>
                    </button>
                  </div>
                </article>

                {/* Academic Session */}

                <article className="surface session-card">
                  <p>ACADEMIC CONFIGURATION</p>
                  <h2>Greenfield University</h2>
                  <span className="session-status">
                    <i /> Management workspace
                  </span>
                  <div className="session-divider" />
                  <div className="session-meta">
                    <span>Academic session</span>
                    <strong>Managed in Settings</strong>
                  </div>
                  <div className="session-meta">
                    <span>Reporting</span>
                    <strong>Live module data only</strong>
                  </div>
                </article>
              </section>
            </>

          /* =================================================
             STUDENTS PAGE
          ================================================= */

          ) : activePage === "Registration & IDs" ? (
            <RegistrationManagementPage />

          ) : activePage === "Students" ? (
            <section className="student-management-page">
              <div className="student-directory-intro">
                <div className="student-directory-copy">
                  <span className="student-directory-kicker">ACADEMIC RECORDS</span>
                  <h2>Student directory</h2>
                  <p>Review student profiles, track enrollment status, and manage academic records from one place.</p>
                </div>
                <div className="student-directory-total">
                  <span>Total records</span>
                  <strong>{students.length}</strong>
                  <small>Student profiles</small>
                </div>
              </div>

              <div className="student-directory-stats">
                <article className="student-directory-stat">
                  <span className="directory-stat-icon directory-stat-all">▦</span>
                  <div><small>All students</small><strong>{students.length}</strong></div>
                </article>
                <article className="student-directory-stat">
                  <span className="directory-stat-icon directory-stat-active">✓</span>
                  <div><small>Active students</small><strong>{students.filter((student) => String(student.status || "").toLowerCase() === "active").length}</strong></div>
                </article>
                <article className="student-directory-stat">
                  <span className="directory-stat-icon directory-stat-pending">◷</span>
                  <div><small>Pending students</small><strong>{students.filter((student) => String(student.status || "").toLowerCase() === "pending").length}</strong></div>
                </article>
              </div>

              <section className="surface student-management">
                <div className="section-heading student-management-heading">
                  <div>
                    <h2>All student records</h2>
                    <p>Search, filter, and update student information</p>
                  </div>
                  <span className="directory-live-label"><i /> Live records</span>
                </div>

              <div className="student-filters">
                <div className="filter-search">
                  <span>{"\u2315"}</span>

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, ID, email or course"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option>All</option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>

              <StudentTable
                students={paginatedStudents}
                onDelete={deleteStudent}
                onEdit={setEditingStudent}
              />

              <div className="student-pagination">
                <p className="table-count">
                  Showing {filteredStudents.length ? (currentStudentPage - 1) * studentPageSize + 1 : 0}–{Math.min(currentStudentPage * studentPageSize, filteredStudents.length)} of {filteredStudents.length} matching records
                </p>
                <div className="student-pagination-actions">
                  <button type="button" className="button button-outline" onClick={() => setCurrentStudentPage((page) => Math.max(1, page - 1))} disabled={currentStudentPage === 1}>Previous</button>
                  <span>Page {currentStudentPage} of {studentTotalPages}</span>
                  <button type="button" className="button button-outline" onClick={() => setCurrentStudentPage((page) => Math.min(studentTotalPages, page + 1))} disabled={currentStudentPage >= studentTotalPages}>Next</button>
                </div>
              </div>
              </section>
            </section>

          /* =================================================
             OTHER MANAGEMENT PAGES
          ================================================= */

          ) : activePage === "Course Requests" ? (
            <CourseRequestsPage />

          ) : activePage === "Attendance" ? (
            <AttendanceManagementPage />

          ) : activePage === "Teachers" ? (
            <TeacherManagementPage />

           ) : activePage === "Teacher Course Assignments" ? (
            <TeacherCourseAssignmentsPage />
          ) : activePage === "Teacher Availability" ? (
            <TeacherAvailabilityPage />
          ) : activePage === "Academic Structure" ? (
            <AcademicStructurePage />
          ) : activePage === "Teacher Profile Approvals" ? (
            <TeacherProfileApprovalsPage />

          ) : activePage === "Courses" ? (
            <CourseManagementPage />

          ) : activePage === "Fees & Payments" ? (
            <FeeManagementPage students={students} />

          ) : activePage === "Results" ? (
            <ResultsManagementPage students={students} />

          ) : activePage === "Leave Requests" ? (
            <LeaveRequestsPage />

          ) : activePage === "Examinations" ? (
            <ExaminationsPage />

          ) : activePage === "Timetable" ? (
            <TimetablePage />

          ) : activePage === "Messages" ? (
            <MessagesPage />

          ) : activePage === "Settings" ? (
            <SettingsPage user={user} onLogout={logout} />

          ) : (
            <section className="surface coming-soon">
              <div className="coming-icon">▦</div>
              <h2>{activePage}</h2>

              <p>
                This section is ready for development. We can build its
                management features next.
              </p>

              <button
                className="button button-primary"
                onClick={() => selectPage("Dashboard")}
              >
                Return to dashboard
              </button>
            </section>
          )}

          {/* ================= FOOTER ================= */}

          <footer className="footer">
            <span>© 2026 Greenfield University · Administration Portal</span>
            <span>Academic year 2026–2027</span>
          </footer>
        </div>
      </main>

      {/* =================================================
         05. EDIT STUDENT MODAL
      ================================================= */}

      {editingStudent && (
        <div
          className="modal-backdrop"
          onClick={() => setEditingStudent(null)}
        >
          <section
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">STUDENT RECORDS</p>
                <h2>Edit student</h2>
                <span>{editingStudent.id}</span>
              </div>

              <button
                className="modal-close"
                onClick={() => setEditingStudent(null)}
              >
                ×
              </button>
            </div>

            <form onSubmit={updateStudent}>
              <label>
                Full name
                <input
                  required
                  value={editingStudent.name}
                  onChange={(event) =>
                    setEditingStudent({
                      ...editingStudent,
                      name: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Email address
                <input
                  required
                  type="email"
                  value={editingStudent.email}
                  onChange={(event) =>
                    setEditingStudent({
                      ...editingStudent,
                      email: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Department
                <select
                  required
                  value={editingStudent.departmentId || ""}
                  onChange={(event) =>
                    setEditingStudent({
                      ...editingStudent,
                      departmentId: event.target.value,
                      courseId: "",
                      course: "",
                    })
                  }
                >
                  <option value="">Select department</option>
                  {studentDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.department_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Course
                <select
                  required
                  value={editingStudent.courseId || ""}
                  disabled={!editingStudent.departmentId}
                  onChange={(event) => {
                    const selectedCourse = studentCourses.find(
                      (course) => String(course.id) === event.target.value
                    );
                    setEditingStudent({
                      ...editingStudent,
                      courseId: event.target.value,
                      course: selectedCourse ? selectedCourse.course_name : "",
                    });
                  }}
                >
                  <option value="">Select course</option>
                  {studentCourses
                    .filter((course) => String(course.department_id) === String(editingStudent.departmentId))
                    .map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.course_code} - {course.course_name}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Year
                <select
                  value={editingStudent.year}
                  onChange={(event) =>
                    setEditingStudent({
                      ...editingStudent,
                      year: event.target.value,
                    })
                  }
                >
                  <option>1st Year</option>
                  <option>2nd Year</option>
                  <option>3rd Year</option>
                  <option>4th Year</option>
                </select>
              </label>

              <label>
                Status
                <select
                  value={editingStudent.status}
                  onChange={(event) =>
                    setEditingStudent({
                      ...editingStudent,
                      status: event.target.value,
                    })
                  }
                >
                  <option>Active</option>
                  <option>Pending</option>
                  <option>Inactive</option>
                </select>
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setEditingStudent(null)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="button button-primary"
                >
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* =================================================
         06. ADD STUDENT MODAL
      ================================================= */}

      {showModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowModal(false)}
        >
          <section
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">STUDENT RECORDS</p>
                <h2>Register a student</h2>
                <span>Add the student's basic information.</span>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={addStudent}>
              <label>
                Full name
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Enter student's full name"
                />
              </label>

              <label>
                Email address
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="student@example.com"
                />
              </label>

              <label>
                Course
                <input
                  required
                  value={form.course}
                  onChange={(event) =>
                    setForm({ ...form, course: event.target.value })
                  }
                  placeholder="Enter course name"
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="button button-primary"
                >
                  Save student
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}


/* =========================================================
   COURSE MANAGEMENT
========================================================= */

function CourseManagementPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    courseCode: "",
    courseName: "",
    teacher: "",
    credits: "3.00",
  };

  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [courseToDelete, setCourseToDelete] = useState(null);

  async function loadCourses() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/courses`, {
        headers: authHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load courses");
      }

      setCourses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
  }, []);

  function resetForm() {
  setForm(emptyForm);
  setEditForm(emptyForm);
  setEditingId(null);
}

  function startEdit(course) {
  setEditingId(course.id);

  setEditForm({
    courseCode: course.course_code,
    courseName: course.course_name,
    teacher: course.teacher,
    credits: String(course.credits),
  });

  setError("");
  setMessage("");
}

  async function addCourse(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/courses`, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not add course");
      }

      setMessage("Course added successfully.");
      setForm(emptyForm);

      await loadCourses();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateCourse(courseId) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/courses/${courseId}`,
        {
          method: "PUT",
          headers: authHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(editForm),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update course");
      }

      setMessage("Course updated successfully.");
      resetForm();

      await loadCourses();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

 
  async function deleteCourse(course) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/courses/${course.id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not delete course");
      }

      setMessage("Course deleted successfully.");
      setCourseToDelete(null);

      if (editingId === course.id) {
        resetForm();
      }

      await loadCourses();
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredCourses = courses.filter((course) => {
    const text = `${course.course_code} ${course.course_name} ${course.teacher}`;

    return text.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <section className="course-management-page">
      <div className="course-page-header">
        <div>
          <h2>Course Management</h2>
          <p>Manage academic courses, instructors and credit information.</p>
        </div>

        <div className="course-count">
          <span>{courses.length}</span>
          <small>Total Courses</small>
        </div>
      </div>

      <div className="course-form-card">
        <div className="course-section-heading">
          <div>
            <h3>Add New Course</h3>
            <p>Fill in the details below to add a new course.</p>
          </div>
        </div>

        <form onSubmit={addCourse}>
          <div className="course-form-grid">
            <label className="course-field">
              <span>Course Code</span>
              <input
                required
                value={form.courseCode}
                onChange={(event) =>
                  setForm({
                    ...form,
                    courseCode: event.target.value,
                  })
                }
                placeholder="e.g. CSE-101"
              />
            </label>

            <label className="course-field">
              <span>Course Name</span>
              <input
                required
                value={form.courseName}
                onChange={(event) =>
                  setForm({
                    ...form,
                    courseName: event.target.value,
                  })
                }
                placeholder="Enter course name"
              />
            </label>

            <label className="course-field">
              <span>Teacher Name</span>
              <input
                required
                value={form.teacher}
                onChange={(event) =>
                  setForm({
                    ...form,
                    teacher: event.target.value,
                  })
                }
                placeholder="Enter teacher name"
              />
            </label>

            <label className="course-field">
              <span>Credits</span>
              <input
                required
                type="number"
                min="0.5"
                max="99"
                step="0.5"
                value={form.credits}
                onChange={(event) =>
                  setForm({
                    ...form,
                    credits: event.target.value,
                  })
                }
                placeholder="3.00"
              />
            </label>
          </div>

          <div className="course-form-action">
            <button
              type="submit"
              className="course-add-button"
              disabled={saving}
            >
              {saving ? "Saving..." : "+ Add Course"}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="course-alert course-error">
          {error}
        </div>
      )}

      <SuccessToast message={message} onDismiss={() => setMessage("")} />

      <div className="course-directory">
        <div className="course-section-heading course-directory-heading">
          <div>
            <h3>Course Directory</h3>
            <p>View and manage all courses in your database.</p>
          </div>

          <input
            className="course-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search courses..."
          />
        </div>

        {loading ? (
          <div className="course-loading">
            Loading courses...
          </div>
        ) : (
          <div className="course-table-wrapper">
            <table className="course-table">
              <thead>
                <tr>
                  <th>COURSE CODE</th>
                  <th>COURSE NAME</th>
                  <th>TEACHER</th>
                  <th>CREDITS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {filteredCourses.length > 0 ? (
                  filteredCourses.map((course) => (
                    editingId === course.id ? (
                      <tr key={course.id} className="course-edit-row">
                        <td>
                          <input
                            required
                            value={editForm.courseCode}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                courseCode: event.target.value,
                              })
                            }
                          />
                        </td>

                        <td>
                          <input
                            required
                            value={editForm.courseName}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                courseName: event.target.value,
                              })
                            }
                          />
                        </td>

                        <td>
                          <input
                            required
                            value={editForm.teacher}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                teacher: event.target.value,
                              })
                            }
                          />
                        </td>

                        <td>
                          <input
                            required
                            type="number"
                            min="0.5"
                            max="99"
                            step="0.5"
                            value={editForm.credits}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                credits: event.target.value,
                              })
                            }
                          />
                        </td>

                        <td>
                          <div className="course-actions">
                            <button
                              type="button"
                              className="course-edit-button"
                              disabled={saving}
                              onClick={() => updateCourse(course.id)}
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>

                            <button
                              type="button"
                              className="course-delete-button"
                              onClick={resetForm}
                              disabled={saving}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={course.id}>
                        <td>
                          <span className="course-code">
                            {course.course_code}
                          </span>
                        </td>

                        <td className="course-name-cell">
                          {course.course_name}
                        </td>

                        <td>{course.teacher}</td>

                        <td>
                          <span className="course-credit">
                            {Number(course.credits).toFixed(2)}
                          </span>
                        </td>

                        <td>
                          <div className="course-actions">
                            <button
                              type="button"
                              className="course-edit-button"
                              onClick={() => startEdit(course)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="course-delete-button"
                              onClick={() => setCourseToDelete(course)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="course-empty">
                      No courses found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    {courseToDelete && (
  <div className="course-modal-overlay">
    <div
      className="course-delete-modal"
      role="dialog"
      aria-modal="true"
    >
      <h3>Delete Course?</h3>

      <p>
        Are you sure you want to delete
        <strong> {courseToDelete.course_name}</strong>?
        This action cannot be undone.
      </p>

      <div className="course-modal-actions">
        <button
          type="button"
          onClick={() => setCourseToDelete(null)}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => deleteCourse(courseToDelete)}
        >
          Delete Course
        </button>
      </div>
    </div>
  </div>
)}
    </section>
  );
}


/* =========================================================
   08. LEAVE REQUESTS MANAGEMENT
========================================================= */

function LeaveRequestsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Pending");

  /* Load Leave Requests */

  useEffect(() => {
    fetch(LEAVES_API, { headers: authHeaders() })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load leave requests");
        }

        return data;
      })
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  /* Approve or Reject Request */

  async function decide(id, status) {
    try {
      const response = await fetch(`${LEAVES_API}/${id}`, {
        method: "PUT",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update the request");
      }

      setItems((current) =>
        current.map((leave) =>
          leave.id === id ? { ...leave, status } : leave
        )
      );
    } catch (err) {
      alert(err.message);
    }
  }

  /* Filtered Data */

  const visible = items.filter(
    (leave) => filter === "All" || leave.status === filter
  );

  const pendingCount = items.filter(
    (leave) => leave.status === "Pending"
  ).length;

  const statusClass = {
    Pending: "status-pending",
    Approved: "status-active",
    Rejected: "status-inactive",
  };

  /* Render */

  return (
    <section className="surface student-management">
      <div className="section-heading student-management-heading">
        <div>
          <h2>Leave requests</h2>
          <p>{pendingCount} waiting for a decision</p>
        </div>

        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option>Pending</option>
          <option>Approved</option>
          <option>Rejected</option>
          <option>All</option>
        </select>
      </div>

      {loading ? (
        <p>Loading leave requests...</p>
      ) : error ? (
        <p style={{ color: "#c0392b" }}>{error}</p>
      ) : (
        <div className="table-scroll">
          <table className="student-table">
            <thead>
              <tr>
                <th>STUDENT</th>
                <th>TYPE</th>
                <th>DATES</th>
                <th>REASON</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {visible.length > 0 ? (
                visible.map((leave) => {
                  const days = leaveDays(leave.from, leave.to);

                  return (
                    <tr key={leave.id}>
                      <td>
                        <strong>
                          {leave.studentName || "Unknown student"}
                        </strong>

                        <div className="record-id">
                          {leave.studentId}
                        </div>
                      </td>

                      <td>{leave.type}</td>

                      <td>
                        {leaveDate(leave.from)}
                        {leave.to !== leave.from &&
                          ` to ${leaveDate(leave.to)}`}

                        <div className="record-id">
                          {days} day{days === 1 ? "" : "s"}
                        </div>
                      </td>

                      <td>{leave.reason}</td>

                      <td>
                        <span
                          className={`status ${statusClass[leave.status]}`}
                        >
                          {leave.status}
                        </span>
                      </td>

                      <td>
                        {leave.status === "Pending" ? (
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                            }}
                          >
                            <button
                              className="button button-primary"
                              onClick={() =>
                                decide(leave.id, "Approved")
                              }
                            >
                              Approve
                            </button>

                            <button
                              className="button button-outline"
                              onClick={() =>
                                decide(leave.id, "Rejected")
                              }
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="no-records">
                    No leave requests in this group.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   09. ATTENDANCE MANAGEMENT
========================================================= */

function AttendanceManagementPage() {
  const [date, setDate] = useState(() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;
  });

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  /* Load Attendance */

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");
    setMessage("");

    fetch(`${API_BASE}/attendance?date=${date}`, {
      headers: authHeaders(),
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load attendance");
        }

        return data;
      })
      .then((data) => {
        if (active) {
          setStudents(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [date]);

  /* Update Attendance Status */

  function updateStatus(studentId, status) {
    setStudents((current) =>
      current.map((student) =>
        student.studentId === studentId
          ? { ...student, status }
          : student
      )
    );

    setMessage("");
  }

  /* Save Attendance */

  async function saveAttendance() {
    const records = students
      .filter((student) => student.status)
      .map((student) => ({
        studentId: student.studentId,
        status: student.status,
      }));

    if (!records.length) {
      setError(
        "Please select attendance status for at least one student."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/attendance`, {
        method: "PUT",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ date, records }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save attendance");
      }

      setMessage(`Attendance saved for ${data.saved} student(s).`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const markedCount = students.filter(
    (student) => student.status
  ).length;

  /* Render */

  return (
    <section className="surface student-management">
      <div className="section-heading student-management-heading">
        <div>
          <h2>Daily attendance</h2>
          <p>
            Mark Present, Absent or Late for each registered student.
          </p>
        </div>

        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label="Attendance date"
        />
      </div>

      <div className="student-filters">
        <p>
          {students.length} students · {markedCount} marked
        </p>

        <button
          className="button button-primary"
          onClick={saveAttendance}
          disabled={loading || saving || students.length === 0}
        >
          {saving ? "Saving..." : "Save attendance"}
        </button>
      </div>

      {error && <p style={{ color: "#c0392b" }}>{error}</p>}

      <SuccessToast message={message} onDismiss={() => setMessage("")} />

      {loading ? (
        <p>Loading students...</p>
      ) : (
        <div className="table-scroll">
          <table className="student-table">
            <thead>
              <tr>
                <th>STUDENT ID</th>
                <th>STUDENT</th>
                <th>COURSE</th>
                <th>ATTENDANCE STATUS</th>
              </tr>
            </thead>

            <tbody>
              {students.length ? (
                students.map((student) => (
                  <tr key={student.studentId}>
                    <td>{student.studentId}</td>

                    <td>
                      <strong>{student.name}</strong>
                      <small style={{ display: "block" }}>
                        {student.email}
                      </small>
                    </td>

                    <td>{student.course}</td>

                    <td>
                      <select
                        value={student.status || ""}
                        onChange={(event) =>
                          updateStatus(
                            student.studentId,
                            event.target.value
                          )
                        }
                      >
                        <option value="">Not marked</option>
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Late">Late</option>
                      </select>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="no-records">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   10. RESULTS MANAGEMENT
========================================================= */


/* =========================================================
   FEE MANAGEMENT
========================================================= */

function FeeManagementPage({ students }) {
  const today = new Date().toISOString().slice(0, 10);
  const emptyInvoice = {
    studentId: "",
    title: "",
    amount: "",
    dueDate: today,
    notes: "",
  };

  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState(emptyInvoice);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "Cash",
    referenceNo: "",
    paidAt: today,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function loadInvoices() {
    setLoading(true);
    setError("");
    try {
      const data = await request("/fees");
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  function updateInvoiceField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function createInvoice(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await request("/fees", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyInvoice);
      setMessage("Fee invoice created successfully.");
      await loadInvoices();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openPayment(invoice) {
    setPaymentInvoice(invoice);
    setPaymentForm({
      amount: invoice.due.toFixed(2),
      paymentMethod: "Cash",
      referenceNo: "",
      paidAt: today,
    });
    setError("");
    setMessage("");
  }

  async function recordPayment(event) {
    event.preventDefault();
    if (!paymentInvoice) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await request(`/fees/${paymentInvoice.id}/payments`, {
        method: "POST",
        body: JSON.stringify(paymentForm),
      });
      setPaymentInvoice(null);
      setMessage("Payment recorded successfully.");
      await loadInvoices();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvoice(invoice) {
    const confirmed = window.confirm(
      `Delete invoice ${invoice.invoiceNo}? Its payment history will also be deleted.`
    );
    if (!confirmed) return;
    setError("");
    setMessage("");
    try {
      await request(`/fees/${invoice.id}`, { method: "DELETE" });
      setMessage("Invoice deleted successfully.");
      await loadInvoices();
    } catch (err) {
      setError(err.message);
    }
  }

  const visibleInvoices = invoices.filter((invoice) => {
    const query = search.toLowerCase();
    return `${invoice.invoiceNo} ${invoice.studentName} ${invoice.studentId} ${invoice.title}`
      .toLowerCase()
      .includes(query);
  });

  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + invoice.paid, 0);
  const totalDue = invoices.reduce((sum, invoice) => sum + invoice.due, 0);

  return (
    <div className="fee-management-page">
      <div className="fee-page-header">
        <div>
          <span className="eyebrow">FINANCE AND ACCOUNTS</span>
          <h2>Fees & Payments</h2>
          <p>Create student invoices and record payments.</p>
        </div>
        <button className="button button-outline" onClick={loadInvoices} disabled={loading}>
          ↻ Refresh
        </button>
      </div>

      <div className="fee-summary-grid">
        <article className="fee-summary-card">
          <span>Total invoiced</span>
          <strong>৳{totalAmount.toLocaleString("en-BD")}</strong>
        </article>
        <article className="fee-summary-card">
          <span>Total collected</span>
          <strong>৳{totalPaid.toLocaleString("en-BD")}</strong>
        </article>
        <article className="fee-summary-card">
          <span>Outstanding</span>
          <strong>৳{totalDue.toLocaleString("en-BD")}</strong>
        </article>
        <article className="fee-summary-card">
          <span>Invoices</span>
          <strong>{invoices.length}</strong>
        </article>
      </div>

      {error && <div className="fee-alert fee-alert-error">{error}</div>}
      <SuccessToast message={message} onDismiss={() => setMessage("")} />

      <section className="surface fee-form-card">
        <div className="section-heading">
          <div>
            <h2>Create fee invoice</h2>
            <p>Assign a fee to an individual student.</p>
          </div>
        </div>
        <form className="fee-form-grid" onSubmit={createInvoice}>
          <label className="fee-field">
            <span>Student</span>
            <select name="studentId" value={form.studentId} onChange={updateInvoiceField} required>
              <option value="">Select a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.id})
                </option>
              ))}
            </select>
          </label>
          <label className="fee-field">
            <span>Fee description</span>
            <input name="title" value={form.title} onChange={updateInvoiceField} placeholder="e.g. Semester tuition fee" maxLength={180} required />
          </label>
          <label className="fee-field">
            <span>Amount (BDT)</span>
            <input name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={updateInvoiceField} placeholder="Enter amount" required />
          </label>
          <label className="fee-field">
            <span>Due date</span>
            <input name="dueDate" type="date" value={form.dueDate} onChange={updateInvoiceField} required />
          </label>
          <label className="fee-field fee-field-full">
            <span>Notes (optional)</span>
            <textarea name="notes" rows="2" value={form.notes} onChange={updateInvoiceField} placeholder="Additional information for the student" />
          </label>
          <div className="fee-form-actions">
            <button className="button button-primary" type="submit" disabled={saving || students.length === 0}>
              {saving ? "Saving..." : "+ Create invoice"}
            </button>
          </div>
        </form>
        {students.length === 0 && <p className="fee-hint">Add students before creating fee invoices.</p>}
      </section>

      <section className="surface fee-invoice-card">
        <div className="section-heading fee-list-heading">
          <div>
            <h2>Invoice directory</h2>
            <p>Review balances, record payments and view payment history.</p>
          </div>
          <input className="fee-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice or student" />
        </div>
        {loading ? <div className="fee-empty">Loading fee invoices...</div> :
          visibleInvoices.length === 0 ? <div className="fee-empty">No fee invoices found.</div> : (
            <div className="table-scroll">
              <table className="student-table fee-table">
                <thead>
                  <tr>
                    <th>INVOICE</th><th>STUDENT</th><th>DESCRIPTION</th><th>AMOUNT</th>
                    <th>PAID</th><th>DUE</th><th>DUE DATE</th><th>STATUS</th><th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInvoices.map((invoice) => (
                    <React.Fragment key={invoice.id}>
                      <tr>
                        <td className="record-id">{invoice.invoiceNo}</td>
                        <td><strong>{invoice.studentName}</strong><div className="fee-muted">{invoice.studentId}</div></td>
                        <td>{invoice.title}</td>
                        <td>৳{invoice.amount.toLocaleString("en-BD")}</td>
                        <td>৳{invoice.paid.toLocaleString("en-BD")}</td>
                        <td>৳{invoice.due.toLocaleString("en-BD")}</td>
                        <td>{invoice.dueDate}</td>
                        <td><span className={`fee-status fee-status-${invoice.status.toLowerCase()}`}>{invoice.status}</span></td>
                        <td>
                          <div className="fee-row-actions">
                            {invoice.due > 0 && <button className="fee-action-button" onClick={() => openPayment(invoice)}>Record payment</button>}
                            <button className="fee-delete-button" onClick={() => deleteInvoice(invoice)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                      {invoice.payments.length > 0 && (
                        <tr className="fee-history-row">
                          <td colSpan="9">
                            <details>
                              <summary>Payment history ({invoice.payments.length})</summary>
                              <div className="fee-payment-list">
                                {invoice.payments.map((payment) => (
                                  <span key={payment.id}>
                                    {payment.paid_at} · {payment.payment_method} · ৳{Number(payment.amount).toLocaleString("en-BD")}
                                    {payment.reference_no ? ` · ${payment.reference_no}` : ""}
                                  </span>
                                ))}
                              </div>
                            </details>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      {paymentInvoice && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal fee-payment-modal" role="dialog" aria-modal="true" aria-labelledby="fee-payment-title">
            <div className="modal-heading">
              <div><p className="eyebrow">INVOICE {paymentInvoice.invoiceNo}</p><h2 id="fee-payment-title">Record payment</h2><span>Outstanding: ৳{paymentInvoice.due.toLocaleString("en-BD")}</span></div>
              <button className="modal-close" type="button" onClick={() => setPaymentInvoice(null)}>×</button>
            </div>
            <form onSubmit={recordPayment}>
              <label>Payment amount (BDT)<input type="number" min="0.01" max={paymentInvoice.due} step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} required /></label>
              <label>Payment method<select value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value })}><option>Cash</option><option>Bank transfer</option><option>Card</option><option>Mobile banking</option><option>Other</option></select></label>
              <label>Reference number (optional)<input value={paymentForm.referenceNo} onChange={(event) => setPaymentForm({ ...paymentForm, referenceNo: event.target.value })} maxLength="100" /></label>
              <label>Payment date<input type="date" value={paymentForm.paidAt} onChange={(event) => setPaymentForm({ ...paymentForm, paidAt: event.target.value })} required /></label>
              <div className="modal-actions">
                <button className="button button-outline" type="button" onClick={() => setPaymentInvoice(null)}>Cancel</button>
                <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save payment"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}


function ResultsManagementPage({ students }) {
  const [examinations, setExaminations] = useState([]);
  const [examCourses, setExamCourses] = useState([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedExamCourse, setSelectedExamCourse] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [marks, setMarks] = useState("");
  const [savedMarks, setSavedMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resultSummary, setResultSummary] = useState([]);
  const [resultsPublished, setResultsPublished] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState("");
  const [studentHistory, setStudentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const activeExamCourses = examCourses.filter(
    (item) => String(item.examination_id) === String(selectedExam)
  );
  const selectedCourse = activeExamCourses.find(
    (item) => String(item.exam_course_id) === String(selectedExamCourse)
  );

  async function readJson(response, fallback) {
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) {
      throw new Error(`${fallback} (HTTP ${response.status}: API returned HTML instead of JSON. Check that the examination results workflow route is installed in the backend.)`);
    }
    return response.json();
  }

  async function loadSetup() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/examinations/marks/setup`, {
        headers: authHeaders(),
      });
      const data = await readJson(response, "Could not load examination setup");
      if (!response.ok) throw new Error(data.error || "Could not load examination setup");
      setExaminations(data.examinations || []);
      setExamCourses(data.examCourses || []);
      if (!selectedExam && data.examinations?.length) {
        setSelectedExam(String(data.examinations[0].id));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMarks(examCourseId) {
    if (!examCourseId) { setSavedMarks([]); return; }
    try {
      const response = await fetch(
        `${API_BASE}/examinations/marks?examCourseId=${encodeURIComponent(examCourseId)}`,
        { headers: authHeaders() }
      );
      const data = await readJson(response, "Could not load saved marks");
      if (!response.ok) throw new Error(data.error || "Could not load saved marks");
      setSavedMarks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadSetup(); }, []);
  useEffect(() => {
    setSelectedExamCourse("");
    setSelectedStudent("");
    setMarks("");
    setSavedMarks([]);
  }, [selectedExam]);
  useEffect(() => {
    if (activeExamCourses.length && !activeExamCourses.some(x => String(x.exam_course_id) === String(selectedExamCourse))) {
      setSelectedExamCourse(String(activeExamCourses[0].exam_course_id));
    }
  }, [selectedExam, examCourses]);
  useEffect(() => { loadMarks(selectedExamCourse); }, [selectedExamCourse]);

  async function loadResultSummary() {
    if (!selectedExam) { setResultSummary([]); setResultsPublished(false); return; }
    setSummaryLoading(true);
    try {
      const response = await fetch(`${API_BASE}/exam-results/summary?examinationId=${encodeURIComponent(selectedExam)}`, { headers: authHeaders() });
      const data = await readJson(response, "Could not load result summary");
      if (!response.ok) throw new Error(data.error || "Could not load result summary");
      setResultSummary(data.results || []);
      setResultsPublished(Boolean(data.isPublished));
    } catch (err) { setError(err.message); }
    finally { setSummaryLoading(false); }
  }

  useEffect(() => { loadResultSummary(); }, [selectedExam]);

  async function toggleResultPublication() {
    setError(""); setMessage("");
    try {
      const response = await fetch(`${API_BASE}/exam-results/publish`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ examinationId: Number(selectedExam), published: !resultsPublished }),
      });
      const data = await readJson(response, "Could not update publication status");
      if (!response.ok) throw new Error(data.error || "Could not update publication status");
      setResultsPublished(Boolean(data.isPublished));
      setMessage(data.message || "Result publication status updated.");
      await loadResultSummary();
    } catch (err) { setError(err.message); }
  }

  async function loadStudentHistory() {
    if (!selectedHistoryStudent) { setError("Select a student to view result history."); return; }
    setHistoryLoading(true); setError(""); setStudentHistory([]);
    try {
      const response = await fetch(`${API_BASE}/exam-results/student/${encodeURIComponent(selectedHistoryStudent)}`, { headers: authHeaders() });
      const data = await readJson(response, "Could not load student result history");
      if (!response.ok) throw new Error(data.error || "Could not load student result history");
      setStudentHistory(Array.isArray(data) ? data : []);
    } catch (err) { setError(err.message); }
    finally { setHistoryLoading(false); }
  }

  const groupedSummary = Object.values(resultSummary.reduce((groups, row) => {
    if (!groups[row.student_id]) groups[row.student_id] = { student_id: row.student_id, student_name: row.student_name, courses: [] };
    groups[row.student_id].courses.push(row);
    return groups;
  }, {})).map((student) => {
    const credits = student.courses.reduce((sum, course) => sum + Number(course.credits || 0), 0);
    const weightedPoints = student.courses.reduce((sum, course) => sum + Number(course.point || 0) * Number(course.credits || 0), 0);
    const totalMarks = student.courses.reduce((sum, course) => sum + Number(course.marks || 0), 0);
    const maxMarks = student.courses.reduce((sum, course) => sum + Number(course.max_marks || 0), 0);
    return { ...student, gpa: credits ? (weightedPoints / credits).toFixed(2) : "0.00", percentage: maxMarks ? ((totalMarks / maxMarks) * 100).toFixed(2) : "0.00", status: student.courses.every((course) => course.status === "Pass") ? "Pass" : "Fail" };
  });

  async function saveExamMark(event) {
    event.preventDefault();
    setError(""); setMessage("");
    if (!selectedExamCourse || !selectedStudent) {
      setError("Select an examination course and a student."); return;
    }
    const numericMarks = Number(marks);
    if (!Number.isFinite(numericMarks) || numericMarks < 0 || numericMarks > Number(selectedCourse?.max_marks)) {
      setError(`Enter marks between 0 and ${selectedCourse?.max_marks}.`); return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/examinations/marks`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ examCourseId: Number(selectedExamCourse), studentId: selectedStudent, marks: numericMarks }),
      });
      const data = await readJson(response, "Could not save examination marks");
      if (!response.ok) throw new Error(data.error || "Could not save examination marks");
      setMessage("Marks saved successfully.");
      setMarks("");
      await loadMarks(selectedExamCourse);
      await loadResultSummary();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <section className="surface student-management">
      <div className="section-heading student-management-heading">
        <div><h2>Examination results &amp; marks entry</h2><p>Enter and update marks for courses assigned to each examination.</p></div>
      </div>
      {loading ? <p>Loading examination data...</p> : (
        <>
          <div className="student-filters">
            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
              <option value="">Select examination</option>
              {examinations.map(exam => <option key={exam.id} value={exam.id}>{exam.name} ({exam.academic_year})</option>)}
            </select>
            <select value={selectedExamCourse} onChange={e => setSelectedExamCourse(e.target.value)} disabled={!activeExamCourses.length}>
              <option value="">Select assigned course</option>
              {activeExamCourses.map(course => <option key={course.exam_course_id} value={course.exam_course_id}>{course.course_code} - {course.course_name}</option>)}
            </select>
          </div>
          {!examinations.length && <p>No examinations found. Create an examination first.</p>}
          {!!selectedExam && !activeExamCourses.length && <p>No courses have been assigned to this examination yet. Open Examinations and assign a course first.</p>}
          {selectedCourse && (
            <>
              <div className="section-heading"><div><h2>Enter student marks</h2><p>{selectedCourse.course_code} · Maximum: {Number(selectedCourse.max_marks).toFixed(2)} · Pass: {Number(selectedCourse.pass_marks).toFixed(2)}</p></div></div>
              <form onSubmit={saveExamMark}>
                <div className="student-filters">
                  <select required value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                    <option value="">Select student</option>
                    {students.map(student => <option key={student.student_id || student.id} value={student.student_id || student.id}>{student.name} ({student.student_id || student.id})</option>)}
                  </select>
                  <input type="number" min="0" max={selectedCourse.max_marks} step="0.01" required placeholder={`Enter marks (0-${selectedCourse.max_marks})`} value={marks} onChange={e => setMarks(e.target.value)} />
                  <small className="form-hint">Enter the actual marks, e.g. 6 for six marks (not 0.06).</small>
                  <button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving..." : "Save marks"}</button>
                </div>
              </form>
            </>
          )}
          {error && <p style={{color:"#c0392b"}}>{error}</p>}
          <SuccessToast message={message} onDismiss={() => setMessage("")} />
          {selectedCourse && <>
            <div className="section-heading"><div><h2>Saved examination marks</h2><p>Marks recorded for the selected examination course.</p></div></div>
            <div className="table-scroll"><table className="student-table"><thead><tr><th>STUDENT ID</th><th>STUDENT</th><th>MARKS</th><th>STATUS</th></tr></thead><tbody>
              {savedMarks.length ? savedMarks.map(row => <tr key={row.id}><td>{row.student_id}</td><td>{row.student_name}</td><td>{Number(row.marks).toFixed(2)} / {Number(selectedCourse.max_marks).toFixed(2)}</td><td>{Number(row.marks) >= Number(selectedCourse.pass_marks) ? "Pass" : "Fail"}</td></tr>) : <tr><td colSpan="4">No marks entered for this course yet.</td></tr>}
            </tbody></table></div>
          </>}
          <div className="section-heading" style={{ marginTop: 28 }}>
            <div><h2>Grade calculation &amp; result publication</h2><p>Grades are calculated from each course percentage using the college grade scale.</p></div>
            <button type="button" className="button button-primary" onClick={toggleResultPublication} disabled={!selectedExam || summaryLoading || !resultSummary.length}>
              {resultsPublished ? "Unpublish results" : "Publish results"}
            </button>
          </div>
          {summaryLoading ? <p>Calculating results...</p> : (
            <div className="table-scroll"><table className="student-table"><thead><tr><th>STUDENT ID</th><th>STUDENT</th><th>COURSES</th><th>AVERAGE</th><th>GPA</th><th>RESULT</th></tr></thead><tbody>
              {groupedSummary.length ? groupedSummary.map(student => <tr key={student.student_id}><td>{student.student_id}</td><td>{student.student_name}</td><td>{student.courses.length}</td><td>{student.percentage}%</td><td>{student.gpa}</td><td>{student.status}</td></tr>) : <tr><td colSpan="6">No marks available to calculate for this examination.</td></tr>}
            </tbody></table></div>
          )}
          <p style={{ marginTop: 8, color: resultsPublished ? "#16803c" : "#64748b" }}>{resultsPublished ? "Published: students can now view these results." : "Not published: results remain staff-only."}</p>

          <div className="section-heading" style={{ marginTop: 28 }}><div><h2>Student marksheet &amp; result history</h2><p>View all published examination results for an individual student.</p></div></div>
          <div className="student-filters">
            <select value={selectedHistoryStudent} onChange={e => { setSelectedHistoryStudent(e.target.value); setStudentHistory([]); }}>
              <option value="">Select student</option>
              {students.map(student => <option key={student.student_id || student.id} value={student.student_id || student.id}>{student.name} ({student.student_id || student.id})</option>)}
            </select>
            <button type="button" className="button button-primary" onClick={loadStudentHistory} disabled={!selectedHistoryStudent || historyLoading}>{historyLoading ? "Loading..." : "View marksheet"}</button>
            {studentHistory.length > 0 && <button type="button" className="button" onClick={() => window.print()}>Print marksheet</button>}
          </div>
          {studentHistory.length > 0 && <div className="table-scroll"><table className="student-table"><thead><tr><th>EXAMINATION</th><th>COURSE</th><th>MARKS</th><th>PERCENTAGE</th><th>GRADE</th><th>POINT</th><th>STATUS</th></tr></thead><tbody>
            {studentHistory.map((row, index) => <tr key={`${row.examination_id}-${row.exam_course_id}-${index}`}><td>{row.examination_name} ({row.academic_year})</td><td>{row.course_code} - {row.course_name}</td><td>{Number(row.marks).toFixed(2)} / {Number(row.max_marks).toFixed(2)}</td><td>{Number(row.percentage).toFixed(2)}%</td><td>{row.grade}</td><td>{Number(row.point).toFixed(2)}</td><td>{row.status}</td></tr>)}
          </tbody></table></div>}
          {selectedHistoryStudent && !historyLoading && studentHistory.length === 0 && <p>No published results found for this student.</p>}
        </>
      )}
    </section>
  );
}

function Metric({ label, value, change, detail, icon }) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <div className="metric-icon"><NavIcon name={icon} /></div>
      </div>

      <div className="metric-bottom">
        <strong>{value}</strong>
        <span className="metric-change">{change}</span>
      </div>

      <p>{detail}</p>
    </article>
  );
}

/* Student Table */

function StudentTable({ students, onDelete, onEdit }) {
  return (
    <div className="table-scroll">
      <table className="student-table">
        <thead>
          <tr>
            <th>STUDENT</th>
            <th>STUDENT ID</th>
            <th>COURSE</th>
            <th>YEAR</th>
            <th>STATUS</th>
            <th>ACTION</th>
          </tr>
        </thead>

        <tbody>
          {students.length > 0 ? (
            students.map((student) => (
              <tr key={student.id}>
                <td>
                  <div className="student-person">
                    <div className="student-initials">
                      {student.initials}
                    </div>

                    <div>
                      <strong>{student.name}</strong>
                      <span>{student.email}</span>
                    </div>
                  </div>
                </td>

                <td className="record-id">{student.id}</td>
                <td>{student.course}</td>
                <td>{student.year}</td>

                <td>
                  <span
                    className={`status status-${student.status.toLowerCase()}`}
                  >
                    {student.status}
                  </span>
                </td>

                <td>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <button
                      className="button button-outline"
                      onClick={() => onEdit(student)}
                    >
                      Edit
                    </button>

                    <button
                      className="button button-outline"
                      onClick={() => onDelete(student.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="no-records">
                No matching student records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   12. LOGIN PAGE
========================================================= */


function LoginPage({ onLogin, onRegister }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* Login Submission */

  async function submit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* Render */

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark">G</div>

        <h1>Greenfield University</h1>
        <p>Sign in to your portal</p>

        <label>
          Email / Student ID / Teacher ID
          <input
            required
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Enter your email or ID"
            autoComplete="username"
          />
        </label>

        <label>
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button
          className="button button-primary"
          type="submit"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>


        <button
          type="button"
          onClick={onRegister}
          style={{
            width: "100%",
            marginTop: "14px",
            padding: "10px",
            background: "transparent",
            border: "none",
            color: "#2563eb",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          New Student? Register Here
        </button>

        </form>
      </div>
    );
  }




/* =========================================================
   TEACHER MANAGEMENT
========================================================= */

function TeacherManagementPage() {
  const emptyForm = {
    teacherId: "",
    name: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    status: "Active",
  };

  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: authHeaders({
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [teacherRows, courseRows] = await Promise.all([
        request("/teachers"),
        request("/courses"),
      ]);
      setTeachers(Array.isArray(teacherRows) ? teacherRows : []);
      setCourses(Array.isArray(courseRows) ? courseRows : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    
  }

  function startEdit(teacher) {
    setEditingId(teacher.id);
    setForm({
      teacherId: teacher.teacher_id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone || "",
      department: teacher.department,
      designation: teacher.designation,
      status: teacher.status,
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  
async function saveTeacher(event) {
  event.preventDefault();
  setSaving(true);
  setError("");
  setMessage("");

  try {
    const payload = { ...form };

    if (!editingId) {
      throw new Error("Teacher accounts must be created through Registration & IDs.");
    }

    await request(`/teachers/${editingId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    resetForm();

    setMessage("Teacher updated successfully.");

    await loadData();

  } catch (err) {
    setError(err.message);
  } finally {
    setSaving(false);
  }
}

  const filteredTeachers = teachers.filter((teacher) => {
    const text = [
      teacher.teacher_id,
      teacher.name,
      teacher.email,
      teacher.phone,
      teacher.department,
      teacher.designation,
    ].join(" ").toLowerCase();
    return text.includes(search.toLowerCase()) &&
      (statusFilter === "All" || teacher.status === statusFilter);
  });

  const activeCount = teachers.filter((teacher) => teacher.status === "Active").length;
  const departmentCount = new Set(teachers.map((teacher) => teacher.department)).size;

  return (
    <section className="teacher-management-page">
      <div className="teacher-page-header">
        <div>
          <p className="eyebrow">ACADEMIC STAFF</p>
          <h2>Teacher directory</h2>
          <p>Manage teacher profiles, departments and course assignments.</p>
        </div>
        <button
          type="button"
          className="button button-outline"
          onClick={loadData}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="teacher-summary-grid">
        <article className="teacher-summary-card">
          <span>Total teachers</span>
          <strong>{teachers.length}</strong>
        </article>
        <article className="teacher-summary-card">
          <span>Active teachers</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="teacher-summary-card">
          <span>Departments</span>
          <strong>{departmentCount}</strong>
        </article>
        <article className="teacher-summary-card">
          <span>Available courses</span>
          <strong>{courses.length}</strong>
        </article>
      </div>

      {editingId && (
      <section className="surface teacher-form-card">
        <div className="section-heading">
          <div>
            <h2>Edit teacher</h2>
            <p>Update the selected teacher's professional and contact information.</p>
          </div>
          {editingId && (
            <button type="button" className="button button-outline" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>

        <form onSubmit={saveTeacher}>
          <div className="teacher-form-grid">
            <label className="teacher-field">
              <span>Teacher ID</span>
              <input
                required
                value={form.teacherId}
                onChange={(event) => updateField("teacherId", event.target.value)}
                placeholder="e.g. TCH-001"
              />
            </label>
            <label className="teacher-field">
              <span>Full name</span>
              <input
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Enter full name"
              />
            </label>
            <label className="teacher-field">
              <span>Email address</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="teacher@example.com"
              />
            </label>
            <label className="teacher-field">
              <span>Phone number</span>
              <input
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="Enter phone number"
              />
            </label>
            <label className="teacher-field">
              <span>Department</span>
              <input
                required
                value={form.department}
                onChange={(event) => updateField("department", event.target.value)}
                placeholder="e.g. Computer Science"
              />
            </label>
            <label className="teacher-field">
              <span>Designation</span>
              <select
                required
                value={form.designation}
                onChange={(event) => updateField("designation", event.target.value)}
              >
                <option value="">Select designation</option>
                <option>Professor</option>
                <option>Associate Professor</option>
                <option>Assistant Professor</option>
                <option>Senior Lecturer</option>
                <option>Lecturer</option>
                <option>Instructor</option>
              </select>
            </label>
            <label className="teacher-field">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) => updateField("status", event.target.value)}
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
          </div>

          {error && <p className="teacher-feedback teacher-error">{error}</p>}
          <SuccessToast message={message} onDismiss={() => setMessage("")} duration={message.includes("Temporary password") ? 12000 : 4000} />

          <div className="teacher-form-actions">
            <button type="button" className="button button-outline" onClick={resetForm}>
              Clear
            </button>
            <button type="submit" className="button button-primary" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>
      )}

      <section className="surface teacher-directory-card">
        <div className="teacher-directory-heading">
          <div>
            <h2>Registered teachers</h2>
            <p>Search, review and manage teaching staff records.</p>
          </div>
          <div className="teacher-filters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search teachers..."
            />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>All</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="teacher-empty">Loading teachers...</p>
        ) : filteredTeachers.length === 0 ? (
          <p className="teacher-empty">No teacher records found.</p>
        ) : (
          <div className="teacher-table-wrap">
            <table className="teacher-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Teacher ID</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Courses</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>
                      <strong>{teacher.name}</strong>
                      <small>{teacher.email}</small>
                      {teacher.phone && <small>{teacher.phone}</small>}
                    </td>
                    <td>{teacher.teacher_id}</td>
                    <td>{teacher.department}</td>
                    <td>{teacher.designation}</td>
                    <td>
                      {(teacher.courses || []).length
                        ? teacher.courses.map((course) => course.course_code).join(", ")
                        : "Not assigned"}
                    </td>
                    <td>
                      <span className={`teacher-status ${teacher.status.toLowerCase()}`}>
                        {teacher.status}
                      </span>
                    </td>
                    <td>
                      <div className="teacher-row-actions">
                        <button type="button" onClick={() => startEdit(teacher)}>Edit</button>
                        <button type="button" onClick={() => setDeleteTarget(teacher)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="teacher-record-count">
          Showing {filteredTeachers.length} of {teachers.length} teachers
        </p>
      </section>

      {deleteTarget && (
        <div className="teacher-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <section className="teacher-delete-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Delete teacher?</h3>
            <p>
              This will permanently delete <strong>{deleteTarget.name}</strong> and remove
              their course assignments.
            </p>
            <div className="teacher-form-actions">
              <button type="button" className="button button-outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="button button-primary" onClick={deleteTeacher} disabled={saving}>
                {saving ? "Deleting..." : "Delete teacher"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}


function FirstLoginPasswordChange({
  user,
  onLogout,
  onPasswordChanged,
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (newPassword.length < 8 || newPassword.length > 128) {
      setError("New password must be between 8 and 128 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("Your new password must be different from the temporary password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/change-password`, {
        method: "PUT",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not change password.");
      }

      onPasswordChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark">G</div>

        <h1>Change Your Password</h1>

        <p>
          Welcome to Greenfield University.
          For security, you must change your temporary password
          before accessing your portal.
        </p>

        <div style={{ marginBottom: "16px" }}>
          <strong>Account:</strong>{" "}
          {user.role === "student"
            ? user.studentId
            : user.teacherCode}
        </div>

        <label>
          Temporary Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) =>
              setCurrentPassword(event.target.value)
            }
            placeholder="Enter your temporary password"
          />
        </label>

        <label>
          New Password
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(event.target.value)
            }
            placeholder="Create a new password"
          />
        </label>

        <label>
          Confirm New Password
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            placeholder="Confirm your new password"
          />
        </label>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <button
          className="button button-primary"
          type="submit"
          disabled={loading}
        >
          {loading ? "Updating password..." : "Change Password"}
        </button>

        <button
          type="button"
          onClick={onLogout}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: "12px",
            padding: "10px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}


/* =========================================================
   13. EXPORT
========================================================= */

export default App;








