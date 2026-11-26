import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "./services/apiConfig";
import "./AdminModules.css";

const RESOURCE_CONFIG = {
  departments: {
    title: "Departments",
    fields: [
      { name: "faculty_id", label: "Faculty", type: "select", source: "faculties", required: true },
      { name: "department_code", label: "Department Code", required: true },
      { name: "department_name", label: "Department Name", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "status", label: "Status", type: "status" },
    ],
    columns: ["department_code", "department_name", "faculty_id", "status"],
  },
  faculties: {
    title: "Faculties",
    fields: [
      { name: "faculty_code", label: "Faculty Code", required: true },
      { name: "faculty_name", label: "Faculty Name", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "status", label: "Status", type: "status" },
    ],
    columns: ["faculty_code", "faculty_name", "status"],
  },
  programs: {
    title: "Programs",
    fields: [
      { name: "department_id", label: "Department", type: "select", source: "departments", required: true },
      { name: "program_code", label: "Program Code", required: true },
      { name: "program_name", label: "Program Name", required: true },
      { name: "degree_level", label: "Degree Level" },
      { name: "duration_semesters", label: "Duration (Semesters)", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
    columns: ["program_code", "program_name", "degree_level", "status"],
  },
  batches: {
    title: "Batches",
    fields: [
      { name: "program_id", label: "Program", type: "select", source: "programs", required: true },
      { name: "academic_year_id", label: "Academic Year", type: "select", source: "academicYears", required: true },
      { name: "batch_code", label: "Batch Code", required: true },
      { name: "admission_year", label: "Admission Year", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
    columns: ["batch_code", "program_id", "academic_year_id", "admission_year", "status"],
  },
  sections: {
    title: "Sections",
    fields: [
      { name: "batch_id", label: "Batch", type: "select", source: "batches", required: true },
      { name: "semester_id", label: "Semester", type: "select", source: "semesters", required: true },
      { name: "section_code", label: "Section Code", required: true },
      { name: "section_name", label: "Section Name", required: true },
      { name: "capacity", label: "Capacity", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
    columns: ["section_code", "section_name", "batch_id", "semester_id", "capacity", "status"],
  },
  rooms: {
    title: "Rooms",
    fields: [
      { name: "room_code", label: "Room Code", required: true },
      { name: "room_name", label: "Room Name" },
      { name: "building", label: "Building" },
      { name: "floor_name", label: "Floor" },
      { name: "room_type", label: "Room Type", type: "roomType" },
      { name: "capacity", label: "Capacity", type: "number" },
      { name: "has_projector", label: "Projector Available", type: "checkbox" },
      { name: "status", label: "Status", type: "status" },
    ],
    columns: ["room_code", "room_name", "building", "room_type", "capacity", "status"],
  },
};

const RESOURCE_NAMES = Object.keys(RESOURCE_CONFIG);
const EMPTY_LOOKUPS = {
  faculties: [],
  departments: [],
  academicYears: [],
  semesters: [],
};

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default function AcademicStructurePage() {
  const [activeResource, setActiveResource] = useState("faculties");
  const [records, setRecords] = useState({});
  const [lookups, setLookups] = useState(EMPTY_LOOKUPS);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [showForm, setShowForm] = useState(false);

  const config = RESOURCE_CONFIG[activeResource];
  const rows = records[activeResource] || [];

  function headers(json = false) {
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    };
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers(Boolean(options.body)),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all([
        ...RESOURCE_NAMES.map((name) => request(`/academic-structure/${name}`)),
        request("/departments"),
        request("/academic-years"),
        request("/semesters"),
      ]);

      const nextRecords = {};
      RESOURCE_NAMES.forEach((name, index) => {
        nextRecords[name] = Array.isArray(results[index]) ? results[index] : [];
      });

      setRecords(nextRecords);
      setLookups({
        faculties: nextRecords.faculties || [],
        departments: Array.isArray(results[6]) ? results[6] : [],
        academicYears: Array.isArray(results[7]) ? results[7] : [],
        semesters: Array.isArray(results[8]) ? results[8] : [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query))
    );
  }, [rows, search]);

  function relationOptions(source) {
    if (source === "faculties") {
      return lookups.faculties.map((item) => ({
        value: item.id,
        label: `${item.faculty_code || ""} ${item.faculty_name || ""}`.trim(),
      }));
    }
    if (source === "departments") {
      return lookups.departments.map((item) => ({
        value: item.id,
        label: `${item.department_code || ""} ${item.department_name || item.name || ""}`.trim(),
      }));
    }
    if (source === "academicYears") {
      return lookups.academicYears.map((item) => ({
        value: item.id,
        label: item.year_name || item.academic_year || `Year ${item.id}`,
      }));
    }
    if (source === "semesters") {
      return lookups.semesters.map((item) => ({
        value: item.id,
        label: item.semester_name || `Semester ${item.semester_number || item.id}`,
      }));
    }
    if (source === "programs") {
      return (records.programs || []).map((item) => ({
        value: item.id,
        label: `${item.program_code} — ${item.program_name}`,
      }));
    }
    if (source === "batches") {
      return (records.batches || []).map((item) => ({
        value: item.id,
        label: item.batch_code,
      }));
    }
    return [];
  }

  function relationLabel(field, value) {
    const source = {
      faculty_id: "faculties",
      department_id: "departments",
      program_id: "programs",
      academic_year_id: "academicYears",
      semester_id: "semesters",
      batch_id: "batches",
    }[field];

    if (!source) return displayValue(value);
    const option = relationOptions(source).find((item) => String(item.value) === String(value));
    return option ? option.label : displayValue(value);
  }

  function openCreate() {
    const initial = {};
    config.fields.forEach((field) => {
      if (field.name === "status") initial[field.name] = "Active";
      else if (field.name === "room_type") initial[field.name] = "classroom";
      else if (field.type === "checkbox") initial[field.name] = false;
      else initial[field.name] = "";
    });
    setEditing(null);
    setForm(initial);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function openEdit(record) {
    const initial = {};
    config.fields.forEach((field) => {
      const value = record[field.name];
      initial[field.name] = field.type === "checkbox" ? Boolean(value) : value ?? "";
    });
    setEditing(record);
    setForm(initial);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveRecord(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {};
      config.fields.forEach((field) => {
        const value = form[field.name];
        if (field.type === "checkbox") payload[field.name] = Boolean(value);
        else if (field.type === "number") payload[field.name] = value === "" ? null : Number(value);
        else payload[field.name] = typeof value === "string" ? value.trim() : value;
      });

      const path = `/academic-structure/${activeResource}${editing ? `/${editing.id}` : ""}`;
      await request(path, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setShowForm(false);
      setMessage(editing ? "Record updated successfully." : "Record created successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivateRecord(record) {
    if (!window.confirm(`Deactivate ${record.faculty_name || record.department_name || record.program_name || record.batch_code || record.section_name || record.room_code || `record #${record.id}`}?`)) return;

    setError("");
    setMessage("");
    try {
      await request(`/academic-structure/${activeResource}/${record.id}/deactivate`, {
        method: "PATCH",
      });
      setMessage("Record deactivated. Historical data has been preserved.");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  function renderField(field) {
    const common = {
      id: `academic-${field.name}`,
      name: field.name,
      required: Boolean(field.required),
      value: form[field.name] ?? "",
      onChange: (event) => updateField(field.name, event.target.value),
    };

    if (field.type === "checkbox") {
      return (
        <label className="academic-checkbox" key={field.name}>
          <input
            type="checkbox"
            checked={Boolean(form[field.name])}
            onChange={(event) => updateField(field.name, event.target.checked)}
          />
          {field.label}
        </label>
      );
    }

    if (field.type === "status" || field.type === "roomType" || field.type === "select") {
      let options = [];
      if (field.type === "status") {
        options = [{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }];
      } else if (field.type === "roomType") {
        options = ["classroom", "laboratory", "auditorium", "online", "other"].map((value) => ({ value, label: value }));
      } else {
        options = relationOptions(field.source);
      }

      return (
        <label className="academic-field" key={field.name}>
          <span>{field.label}{field.required ? " *" : ""}</span>
          <select {...common}>
            <option value="">Select {field.label}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      );
    }

    if (field.type === "textarea") {
      return (
        <label className="academic-field academic-field-wide" key={field.name}>
          <span>{field.label}</span>
          <textarea {...common} rows={3} />
        </label>
      );
    }

    return (
      <label className="academic-field" key={field.name}>
        <span>{field.label}{field.required ? " *" : ""}</span>
        <input
          {...common}
          type={field.type === "number" ? "number" : "text"}
          min={field.type === "number" ? 1 : undefined}
          step={field.type === "number" ? 1 : undefined}
        />
      </label>
    );
  }

  return (
    <section className="module-page academic-structure-page">
      <div className="module-intro">
        <div>
          <span className="module-eyebrow">UNIVERSITY CONFIGURATION</span>
          <h2>Academic Structure Management</h2>
          <p>Manage faculties, departments, programs, batches, sections and physical learning spaces.</p>
        </div>
        <button className="module-button module-button-primary" type="button" onClick={openCreate}>
          + Add {config.title.slice(0, -1)}
        </button>
      </div>

      <div className="academic-structure-tabs">
        {RESOURCE_NAMES.map((name) => (
          <button
            type="button"
            key={name}
            className={`academic-structure-tab ${activeResource === name ? "active" : ""}`}
            onClick={() => {
              setActiveResource(name);
              setSearch("");
              setShowForm(false);
              setError("");
              setMessage("");
            }}
          >
            {RESOURCE_CONFIG[name].title}
            <span>{(records[name] || []).length}</span>
          </button>
        ))}
      </div>

      <div className="academic-structure-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${config.title.toLowerCase()}...`}
          aria-label={`Search ${config.title}`}
        />
        <button className="module-button" type="button" onClick={loadData} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <div className="module-alert module-alert-error" role="alert">{error}</div>}
      {message && <div className="module-alert module-alert-success" role="status">{message}</div>}

      {showForm && (
        <form className="academic-structure-form" onSubmit={saveRecord}>
          <div className="academic-structure-form-heading">
            <h3>{editing ? `Edit ${config.title.slice(0, -1)}` : `Create ${config.title.slice(0, -1)}`}</h3>
            <button type="button" className="module-button" onClick={() => setShowForm(false)}>Close</button>
          </div>
          <div className="academic-structure-fields">
            {config.fields.map(renderField)}
          </div>
          <div className="academic-structure-form-actions">
            <button className="module-button" type="button" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
            <button className="module-button module-button-primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Record"}
            </button>
          </div>
        </form>
      )}

      <div className="surface academic-structure-table-wrap">
        {loading ? (
          <div className="academic-structure-empty">Loading academic structure...</div>
        ) : filteredRows.length === 0 ? (
          <div className="academic-structure-empty">No {config.title.toLowerCase()} found.</div>
        ) : (
          <div className="table-responsive">
            <table className="academic-structure-table">
              <thead>
                <tr>
                  <th>ID</th>
                  {config.columns.map((column) => (
                    <th key={column}>{column.replaceAll("_", " ")}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((record) => (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    {config.columns.map((column) => (
                      <td key={column}>
                        {column === "status" ? (
                          <span className={`module-status ${String(record[column] || "unknown").toLowerCase()}`}>
                            {displayValue(record[column])}
                          </span>
                        ) : relationLabel(column, record[column])}
                      </td>
                    ))}
                    <td>
                      <div className="academic-row-actions">
                        <button type="button" className="module-button" onClick={() => openEdit(record)}>Edit</button>
                        {record.status !== "Inactive" && (
                          <button type="button" className="module-button academic-deactivate-button" onClick={() => deactivateRecord(record)}>
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="academic-structure-footnote">Deactivation preserves historical records and does not permanently delete data.</p>
    </section>
  );
}