
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import StudentPortal from "./StudentPortal";
import RegistrationManagementPage from "./RegistrationManagementPage";
import { ExaminationsPage, TimetablePage, MessagesPage, SettingsPage } from "./AdminModules";
import CourseRequestsPage from "./CourseRequestsPage";
import TeacherPortal from "./TeacherPortal";
import StudentRegistrationPage from "./StudentRegistrationPage";

/* =========================================================
   01. API CONFIGURATION & AUTHENTICATION
========================================================= */

const API_BASE = "http://localhost:5000/api";
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
  {
    heading: "OVERVIEW",
    items: [{ label: "Dashboard", icon: "▦" }],
  },
  {
    heading: "ACADEMIC",
    items: [
      { label: "Students", icon: "♙" },
      { label: "Student Registrations", icon: "♖" },
      { label: "Course Requests", icon: "▤" },
      { label: "Teachers", icon: "♧" },
      { label: "Courses", icon: "▤" },
      { label: "Attendance", icon: "◷" },
      { label: "Examinations", icon: "▣" },
      { label: "Results", icon: "▥" },
      { label: "Timetable", icon: "▦" },
    ],
  },
  {
    heading: "ADMINISTRATION",
    items: [
      { label: "Fees & Payments", icon: "৳" },
      { label: "Leave Requests", icon: "✎" },
      { label: "Messages", icon: "✉" },
      { label: "Settings", icon: "⚙" },
    ],
  },
];

const monthData = [
  { month: "Jan", value: 42 },
  { month: "Feb", value: 48 },
  { month: "Mar", value: 45 },
  { month: "Apr", value: 58 },
  { month: "May", value: 54 },
  { month: "Jun", value: 68 },
  { month: "Jul", value: 63 },
  { month: "Aug", value: 74 },
  { month: "Sep", value: 70 },
  { month: "Oct", value: 82 },
  { month: "Nov", value: 78 },
  { month: "Dec", value: 92 },
];

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

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
        throw new Error("Failed to update student");
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
      alert("Could not update the student.");
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
            <span>COLLEGE PORTAL</span>
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
            <strong>Greenfield College</strong>
            <span>Dhaka Campus</span>
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
                  <span className="nav-symbol">{item.icon}</span>
                  <span>{item.label}</span>

                  {item.label === "Messages" && (
                    <span className="message-count">3</span>
                  )}
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
            <div className="admin-avatar">JD</div>

            <div className="admin-details">
              <strong>James Davidson</strong>
              <span>Administrator</span>
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
              ☰
            </button>

            <div className="breadcrumb"></div>
          </div>

          <div className="topbar-right">

            {/* Global Search */}

            <div className="top-search">
              <span>⌕</span>

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

              <kbd>⌘ K</kbd>
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
                ♧<i />
              </button>

              {notificationsOpen && (
                <div className="dropdown">
                  <strong>Notifications</strong>
                  <p>Recent college updates</p>

                  <div className="dropdown-row">
                    <span className="notification-dot" />
                    <span>New student registration received.</span>
                  </div>

                  <div className="dropdown-row">
                    <span className="notification-dot amber" />
                    <span>Monthly attendance report is ready.</span>
                  </div>

                  <div className="dropdown-row">
                    <span className="notification-dot green-dot" />
                    <span>Fee payment update received.</span>
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
                <div className="admin-avatar small">JD</div>
                <span>James Davidson</span>
                <b>⌄</b>
              </button>

              {profileOpen && (
                <div className="dropdown profile-dropdown">
                  <strong>James Davidson</strong>
                  <p>College Administrator</p>

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

          <section className="page-heading">
            <div>
              <p className="eyebrow">{date}</p>

              <h1>
                {activePage === "Dashboard"
                  ? "Good morning, James"
                  : activePage}
              </h1>

              <p className="page-description">
                {activePage === "Dashboard"
                  ? "Here is an overview of what's happening at your college."
                  : `Manage and review your college ${activePage.toLowerCase()} information.`}
              </p>
            </div>

            <div className="heading-actions">
              <button
                className="button button-outline"
                onClick={() => window.print()}
              >
                <span>↓</span> Export
              </button>

              {activePage === "Students" && (
                <button
                  className="button button-primary"
                  onClick={() => setShowModal(true)}
                >
                  + Add student
                </button>
              )}
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
                  value="2,845"
                  change="+8.4%"
                  detail="Compared with last term"
                  icon="♙"
                />

                <Metric
                  label="Teaching staff"
                  value="148"
                  change="+3.2%"
                  detail="Compared with last term"
                  icon="♧"
                />

                <Metric
                  label="Active courses"
                  value="36"
                  change="+2"
                  detail="New courses this year"
                  icon="▤"
                />

                <Metric
                  label="Today's attendance"
                  value="94.6%"
                  change="+1.8%"
                  detail="Compared with yesterday"
                  icon="◷"
                />
              </section>

              {/* Dashboard Charts */}

              <section className="overview-grid">

                {/* Student Enrolment */}

                <article className="surface enrollment-card">
                  <div className="section-heading">
                    <div>
                      <h2>Student enrolment</h2>
                      <p>Admission activity throughout the year</p>
                    </div>

                    <select defaultValue="2026" aria-label="Select year">
                      <option value="2026">2026</option>
                      <option value="2025">2025</option>
                    </select>
                  </div>

                  <div className="chart-summary">
                    <strong>2,845</strong>
                    <span>Total enrolled students</span>
                  </div>

                  <div className="bar-chart">
                    <div className="chart-axis">
                      <span>3,000</span>
                      <span>2,250</span>
                      <span>1,500</span>
                      <span>750</span>
                      <span>0</span>
                    </div>

                    <div className="chart-area">
                      <div className="chart-guides">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>

                      <div className="chart-bars">
                        {monthData.map((item, index) => (
                          <div className="chart-item" key={item.month}>
                            <div
                              className={`chart-column ${
                                index === 10 ? "current-month" : ""
                              }`}
                              style={{ height: `${item.value}%` }}
                              title={`${item.month}: ${item.value}%`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="chart-labels">
                    {monthData.map((item) => (
                      <span key={item.month}>{item.month}</span>
                    ))}
                  </div>
                </article>

                {/* Attendance Summary */}

                <article className="surface attendance-card">
                  <div className="section-heading">
                    <div>
                      <h2>Attendance summary</h2>
                      <p>Today's student attendance</p>
                    </div>

                    <button className="plain-menu">•••</button>
                  </div>

                  <div className="attendance-visual">
                    <div className="attendance-ring">
                      <div className="ring-center">
                        <strong>94.6%</strong>
                        <span>Present</span>
                      </div>
                    </div>
                  </div>

                  <div className="attendance-details">
                    <div>
                      <span>
                        <i className="dot present-dot" />
                        Present
                      </span>
                      <strong>2,690</strong>
                    </div>

                    <div>
                      <span>
                        <i className="dot absent-dot" />
                        Absent
                      </span>
                      <strong>115</strong>
                    </div>

                    <div>
                      <span>
                        <i className="dot late-dot" />
                        Late
                      </span>
                      <strong>40</strong>
                    </div>
                  </div>
                </article>
              </section>

              {/* Recently Registered Students */}

              <section className="surface recent-section">
                <div className="section-heading recent-heading">
                  <div>
                    <h2>Recently registered students</h2>
                    <p>Latest student records added to the system</p>
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
                    <button onClick={() => selectPage("Student Registrations")}>
                      <span>＋</span>
                      <div>
                        <strong>Student Registrations</strong>
                        <small>Review and approve applications</small>
                      </div>

                      <b>→</b>
                    </button>

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
                  <p>ACADEMIC SESSION</p>
                  <h2>2026 – 2027</h2>

                  <span className="session-status">
                    <i /> Current session
                  </span>

                  <div className="session-divider" />

                  <div className="session-meta">
                    <span>Campus</span>
                    <strong>Dhaka</strong>
                  </div>

                  <div className="session-meta">
                    <span>Institution</span>
                    <strong>Greenfield College</strong>
                  </div>
                </article>
              </section>
            </>

          /* =================================================
             STUDENTS PAGE
          ================================================= */

          ) : activePage === "Students" ? (
            <section className="surface student-management">
              <div className="section-heading student-management-heading">
                <div>
                  <h2>Student directory</h2>
                  <p>Search and manage registered student records</p>
                </div>
              </div>

              <div className="student-filters">
                <div className="filter-search">
                  <span>⌕</span>

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, ID or course"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option>All</option>
                  <option>Active</option>
                  <option>Pending</option>
                  <option>Inactive</option>
                </select>
              </div>

              <StudentTable
                students={filteredStudents}
                onDelete={deleteStudent}
                onEdit={setEditingStudent}
              />

              <p className="table-count">
                Showing {filteredStudents.length} of {students.length} records
              </p>
            </section>

          /* =================================================
             OTHER MANAGEMENT PAGES
          ================================================= */

          ) : activePage === "Student Registrations" ? (
            <RegistrationManagementPage />

          ) : activePage === "Course Requests" ? (
            <CourseRequestsPage />

          ) : activePage === "Attendance" ? (
            <AttendanceManagementPage />

          ) : activePage === "Teachers" ? (
            <TeacherManagementPage />

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
              <div className="coming-icon">▤</div>
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
            <span>© 2026 Greenfield College · Administration Portal</span>
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
                Course
                <input
                  required
                  value={editingStudent.course}
                  onChange={(event) =>
                    setEditingStudent({
                      ...editingStudent,
                      course: event.target.value,
                    })
                  }
                />
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
        <div className="metric-icon">{icon}</div>
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

        <h1>Greenfield College</h1>
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
    courseIds: [],
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
      courseIds: (teacher.courses || []).map((course) => String(course.id)),
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
    const payload = {
      ...form,
      courseIds: form.courseIds.map(Number),
    };

    const path = editingId ? `/teachers/${editingId}` : "/teachers";
    const method = editingId ? "PUT" : "POST";

    const data = await request(path, {
      method,
      body: JSON.stringify(payload),
    });

    resetForm();

    setMessage(
      editingId
        ? "Teacher updated successfully."
        : `Teacher added successfully! Login ID: ${data.teacherId} | Temporary Password: ${data.temporaryPassword} (Save these credentials now. They will not be shown again.)`
    );

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

      <section className="surface teacher-form-card">
        <div className="section-heading">
          <div>
            <h2>{editingId ? "Edit teacher" : "Add new teacher"}</h2>
            <p>Enter the teacher's professional and contact information.</p>
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
            <label className="teacher-field teacher-course-field">
              <span>Assign courses</span>
              <select
                multiple
                value={form.courseIds}
                onChange={(event) =>
                  updateField(
                    "courseIds",
                    Array.from(event.target.selectedOptions, (option) => option.value)
                  )
                }
              >
                {courses.map((course) => (
                  <option key={course.id} value={String(course.id)}>
                    {course.course_code} — {course.course_name}
                  </option>
                ))}
              </select>
              <small>Hold Ctrl (Windows) to select more than one course.</small>
            </label>
          </div>

          {error && <p className="teacher-feedback teacher-error">{error}</p>}
          <SuccessToast message={message} onDismiss={() => setMessage("")} duration={message.includes("Temporary password") ? 12000 : 4000} />

          <div className="teacher-form-actions">
            <button type="button" className="button button-outline" onClick={resetForm}>
              Clear
            </button>
            <button type="submit" className="button button-primary" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Add teacher"}
            </button>
          </div>
        </form>
      </section>

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
          Welcome to Greenfield College.
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
