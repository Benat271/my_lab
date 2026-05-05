import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const TOKEN_STORAGE_KEY = "secot.auth.token";
const USER_STORAGE_KEY = "secot.auth.username";

const EMPTY_FORM = {
  senior_codigo: "",
  nombre: "",
  apellido1: "",
  apellido2: "",
  email_personal: "",
  email_secot: "",
  movil: "",
  fecha_alta: "",
  activo: true,
};

const EMPTY_GRUPO_FORM = {
  grupo_codigo: "",
  nombre_grupo: "",
  descripcion: "",
  color_hex: "#3b82f6",
  canal_teams: "",
  responsable_senior_id: "",
  activo: true,
};

const EMPTY_USER_FORM = {
  username: "",
  password: "",
  is_active: true,
};

function normalizeSeniorForm(form) {
  return {
    senior_codigo: Number(form.senior_codigo),
    nombre: form.nombre.trim(),
    apellido1: form.apellido1.trim(),
    apellido2: form.apellido2.trim() || null,
    email_personal: form.email_personal.trim() || null,
    email_secot: form.email_secot.trim() || null,
    movil: form.movil.trim() || null,
    fecha_alta: form.fecha_alta || null,
    activo: form.activo,
  };
}

function normalizeGrupoForm(form) {
  return {
    grupo_codigo: Number(form.grupo_codigo),
    nombre_grupo: form.nombre_grupo.trim(),
    descripcion: form.descripcion.trim() || null,
    color_hex: form.color_hex,
    canal_teams: form.canal_teams.trim() || null,
    responsable_senior_id: Number(form.responsable_senior_id),
    activo: form.activo,
  };
}

function normalizeUserForm(form) {
  return {
    username: form.username.trim(),
    password: form.password || undefined,
    is_active: form.is_active,
  };
}

async function apiRequest(path, options = {}, token = "") {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "La solicitud no se pudo completar.";
    try {
      const payload = await response.json();
      message = payload.detail || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export default function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_STORAGE_KEY) || "");
  const [username, setUsername] = useState(() => window.localStorage.getItem(USER_STORAGE_KEY) || "");
  const isAuthed = useMemo(() => Boolean(token), [token]);

  const [seniors, setSeniors] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [grupoSearch, setGrupoSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingGrupoId, setEditingGrupoId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [grupoForm, setGrupoForm] = useState(EMPTY_GRUPO_FORM);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("selection"); // 'selection', 'seniors', 'grupos', 'admin'

  // Seniors Logic
  async function loadSeniors(query = "") {
    if (!token) return;
    if (view !== "seniors" && view !== "grupos") {
      if (view === "selection") setSeniors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
      const data = await apiRequest(`/api/seniors${suffix}`, {}, token);
      setSeniors(data);
    } catch (error) {
      setStatus({ kind: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  // Grupos Logic
  async function loadGrupos(query = "") {
    if (!token || view !== "grupos") return;
    setLoading(true);
    try {
      const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
      const data = await apiRequest(`/api/grupos${suffix}`, {}, token);
      setGrupos(data);
      // Cargamos seniors también para el desplegable del formulario
      const seniorsData = await apiRequest("/api/seniors", {}, token);
      setSeniors(seniorsData);
    } catch (error) {
      setStatus({ kind: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  // Users Logic
  async function loadUsers() {
    if (!token || view !== "admin") return;
    setLoading(true);
    try {
      const data = await apiRequest("/api/users", {}, token);
      setUsers(data);
    } catch (error) {
      setStatus({ kind: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  // Unificamos la carga de datos con debouncing para evitar peticiones excesivas
  useEffect(() => {
    if (!token) {
      setSeniors([]);
      setGrupos([]);
      setUsers([]);
      setLoading(false);
      return;
    }

    if (view === "selection") return;

    const timeoutId = window.setTimeout(() => {
      if (view === "seniors") {
        loadSeniors(search);
      } else if (view === "grupos") {
        loadGrupos(grupoSearch);
      } else if (view === "admin") {
        loadUsers();
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [token, view, search, grupoSearch]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function resetGrupoForm() {
    setEditingGrupoId(null);
    setGrupoForm(EMPTY_GRUPO_FORM);
  }

  function resetUserForm() {
    setEditingUserId(null);
    setUserForm(EMPTY_USER_FORM);
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateGrupoField(field, value) {
    setGrupoForm((current) => ({ ...current, [field]: value }));
  }

  function updateUserField(field, value) {
    setUserForm((current) => ({ ...current, [field]: value }));
  }

  async function handleLogin(event) {
    event.preventDefault();
    setStatus(null);

    const formData = new FormData(event.currentTarget);
    const nextUsername = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");

    try {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: nextUsername, password }),
      });

      if (!result?.access_token) {
        throw new Error("Login invalido.");
      }

      window.localStorage.setItem(TOKEN_STORAGE_KEY, result.access_token);
      window.localStorage.setItem(USER_STORAGE_KEY, nextUsername);
      setToken(result.access_token);
      setUsername(nextUsername);
      resetForm();
      setStatus({ kind: "success", message: `Sesion iniciada como ${nextUsername}.` });
    } catch (error) {
      setStatus({ kind: "error", message: error.message });
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    setToken("");
    setUsername("");
    resetForm();
    setStatus({ kind: "success", message: "Sesion cerrada." });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus(null);

    try {
      const payload = normalizeSeniorForm(form);
      if (editingId === null) {
        await apiRequest(
          "/api/seniors",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token
        );
        setStatus({ kind: "success", message: "Senior creado correctamente." });
      } else {
        await apiRequest(
          `/api/seniors/${editingId}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
          token
        );
        setStatus({ kind: "success", message: "Senior actualizado correctamente." });
      }

      resetForm();
      await loadSeniors(search);
    } catch (error) {
      setStatus({ kind: "error", message: error.message });
    }
  }

  async function handleGrupoSubmit(event) {
    event.preventDefault();
    setStatus(null);
    try {
      const payload = normalizeGrupoForm(grupoForm);
      if (editingGrupoId === null) {
        await apiRequest("/api/grupos", { method: "POST", body: JSON.stringify(payload) }, token);
        setStatus({ kind: "success", message: "Grupo creado." });
      } else {
        await apiRequest(`/api/grupos/${editingGrupoId}`, { method: "PUT", body: JSON.stringify(payload) }, token);
        setStatus({ kind: "success", message: "Grupo actualizado." });
      }
      resetGrupoForm();
      await loadGrupos(grupoSearch);
    } catch (error) {
      setStatus({ kind: "error", message: error.message });
    }
  }

  async function handleUserSubmit(event) {
    event.preventDefault();
    setStatus(null);
    try {
      const payload = normalizeUserForm(userForm);
      if (editingUserId === null) {
        await apiRequest("/api/users", { method: "POST", body: JSON.stringify(payload) }, token);
        setStatus({ kind: "success", message: "Usuario creado." });
      } else {
        await apiRequest(`/api/users/${editingUserId}`, { method: "PUT", body: JSON.stringify(payload) }, token);
        setStatus({ kind: "success", message: "Usuario actualizado." });
      }
      resetUserForm();
      await loadUsers();
    } catch (error) {
      setStatus({ kind: "error", message: error.message });
    }
  }

  function startGrupoEdit(g) {
    setEditingGrupoId(g.id);
    setGrupoForm({ ...g, responsable_senior_id: String(g.responsable_senior_id) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startUserEdit(u) {
    setEditingUserId(u.id);
    setUserForm({
      username: u.username,
      password: "",
      is_active: u.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(senior) {
    setEditingId(senior.id);
    setForm({
      senior_codigo: String(senior.senior_codigo),
      nombre: senior.nombre ?? "",
      apellido1: senior.apellido1 ?? "",
      apellido2: senior.apellido2 ?? "",
      email_personal: senior.email_personal ?? "",
      email_secot: senior.email_secot ?? "",
      movil: senior.movil ?? "",
      fecha_alta: senior.fecha_alta ?? "",
      activo: senior.activo,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeSenior(senior) {
    const confirmed = window.confirm(`Se eliminara el senior ${senior.nombre} ${senior.apellido1}.`);
    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(`/api/seniors/${senior.id}`, { method: "DELETE" }, token);
      setStatus({ kind: "success", message: "Senior eliminado correctamente." });
      if (editingId === senior.id) {
        resetForm();
      }
      await loadSeniors(search);
    } catch (error) {
      setStatus({ kind: "error", message: error.message });
    }
  }

  async function removeGrupo(g) {
    if (!window.confirm(`Eliminar grupo ${g.nombre_grupo}?`)) return;
    try {
      await apiRequest(`/api/grupos/${g.id}`, { method: "DELETE" }, token);
      loadGrupos(grupoSearch);
    } catch (error) { setStatus({ kind: "error", message: error.message }); }
  }

  async function removeUser(u) {
    if (!window.confirm(`Eliminar usuario ${u.username}?`)) return;
    try {
      await apiRequest(`/api/users/${u.id}`, { method: "DELETE" }, token);
      loadUsers();
    } catch (error) { setStatus({ kind: "error", message: error.message }); }
  }

  return (
    <main className="layout">
      <section className="hero">
        <p className="eyebrow">SECOT Bizkaia</p>
        <p className="lede">MVP del calendario de actividades y gestión de voluntarios.</p>
      </section>

      {status && <div className={`status-banner ${status.kind}`}>{status.message}</div>}

      {!isAuthed ? (
        <section className="panel form-panel">
          <div className="panel-header"><h2>Iniciar sesión</h2></div>
          <form className="senior-form" onSubmit={handleLogin}>
            <Field label="Usuario"><input name="username" required defaultValue={username} /></Field>
            <Field label="Contraseña"><input name="password" type="password" required /></Field>
            <div className="form-actions"><button className="primary-button" type="submit">Entrar</button></div>
          </form>
        </section>
      ) : view === "selection" ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Bienvenido, {username}</h2>
            <button className="ghost-button" onClick={handleLogout}>Cerrar sesión</button>
          </div>
          <div className="menu-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
            <button className="menu-card" onClick={() => setView("seniors")}><h3>Seniors</h3><p>Gestión de voluntarios</p></button>
            <button className="menu-card" onClick={() => setView("grupos")}><h3>Grupos</h3><p>Equipos de trabajo</p></button>
            <button className="menu-card" onClick={() => setView("admin")}><h3>Admin</h3><p>Usuarios del sistema</p></button>
          </div>
        </section>
      ) : (
        <>
          <button className="ghost-button" onClick={() => { setView("selection"); resetForm(); resetGrupoForm(); resetUserForm(); }}>
            &larr; Volver al menú
          </button>

          <section className="panel form-panel">
            <div className="panel-header">
              <h2>
                {view === "seniors" && (editingId ? "Editar Senior" : "Nuevo Senior")}
                {view === "grupos" && (editingGrupoId ? "Editar Grupo" : "Nuevo Grupo")}
                {view === "admin" && (editingUserId ? "Editar Usuario" : "Nuevo Usuario")}
              </h2>
            </div>

            {view === "seniors" && (
              <form className="senior-form" onSubmit={handleSubmit}>
                <Field label="Código"><input type="number" required value={form.senior_codigo} onChange={e => updateField("senior_codigo", e.target.value)} /></Field>
                <Field label="Nombre"><input required value={form.nombre} onChange={e => updateField("nombre", e.target.value)} /></Field>
                <Field label="Apellido"><input required value={form.apellido1} onChange={e => updateField("apellido1", e.target.value)} /></Field>
                <Field label="Email SECOT"><input type="email" value={form.email_secot} onChange={e => updateField("email_secot", e.target.value)} /></Field>
                <div className="form-actions"><button className="primary-button" type="submit">Guardar</button></div>
              </form>
            )}

            {view === "grupos" && (
              <form className="senior-form" onSubmit={handleGrupoSubmit}>
                <Field label="Código Grupo"><input type="number" required value={grupoForm.grupo_codigo} onChange={e => updateGrupoField("grupo_codigo", e.target.value)} /></Field>
                <Field label="Nombre"><input required value={grupoForm.nombre_grupo} onChange={e => updateGrupoField("nombre_grupo", e.target.value)} /></Field>
                <Field label="Color"><input type="color" value={grupoForm.color_hex} onChange={e => updateGrupoField("color_hex", e.target.value)} /></Field>
                <Field label="Responsable">
                  <select required value={grupoForm.responsable_senior_id} onChange={e => updateGrupoField("responsable_senior_id", e.target.value)}>
                    <option value="">Seleccione un responsable...</option>
                    {seniors.map(s => <option key={s.id} value={s.id}>{s.nombre} {s.apellido1}</option>)}
                  </select>
                </Field>
                <div className="form-actions"><button className="primary-button" type="submit">Guardar</button></div>
              </form>
            )}

            {view === "admin" && (
              <form className="senior-form" onSubmit={handleUserSubmit}>
                <Field label="Usuario"><input required value={userForm.username} onChange={e => updateUserField("username", e.target.value)} /></Field>
                <Field label="Contraseña"><input type="password" placeholder={editingUserId ? "Vacio para mantener" : ""} onChange={e => updateUserField("password", e.target.value)} /></Field>
                <div className="form-actions"><button className="primary-button" type="submit">Guardar</button></div>
              </form>
            )}
          </section>

          <section className="panel list-panel">
            <div className="panel-header">
              <h2>Listado de {view}</h2>
              {view !== "admin" && (
                <Field label="Buscar" compact>
                  <input type="search" value={view === "seniors" ? search : grupoSearch} onChange={e => view === "seniors" ? setSearch(e.target.value) : setGrupoSearch(e.target.value)} />
                </Field>
              )}
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  {view === "seniors" && <tr><th>Cód</th><th>Nombre</th><th>Email</th><th>Acciones</th></tr>}
                  {view === "grupos" && <tr><th>Cód</th><th>Nombre</th><th>Color</th><th>Acciones</th></tr>}
                  {view === "admin" && <tr><th>Usuario</th><th>Estado</th><th>Acciones</th></tr>}
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan="4" className="empty-state">Cargando...</td></tr> : (
                    <>
                      {view === "seniors" && seniors.map(s => (
                        <tr key={s.id}>
                          <td>{s.senior_codigo}</td>
                          <td>{s.nombre} {s.apellido1}</td>
                          <td>{s.email_secot}</td>
                          <td><button onClick={() => startEdit(s)}>Editar</button> <button onClick={() => removeSenior(s)}>X</button></td>
                        </tr>
                      ))}
                      {view === "grupos" && grupos.map(g => (
                        <tr key={g.id}>
                          <td>{g.grupo_codigo}</td>
                          <td>{g.nombre_grupo}</td>
                          <td><div style={{width:20, height:20, backgroundColor: g.color_hex, borderRadius:4}} /></td>
                          <td><button onClick={() => startGrupoEdit(g)}>Editar</button> <button onClick={() => removeGrupo(g)}>X</button></td>
                        </tr>
                      ))}
                      {view === "admin" && users.map(u => (
                        <tr key={u.id}>
                          <td>{u.username}</td>
                          <td>{u.is_active ? "Activo" : "Inactivo"}</td>
                          <td><button onClick={() => startUserEdit(u)}>Editar</button> <button onClick={() => removeUser(u)}>X</button></td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Field({ label, compact = false, children }) {
  return (
    <label className={compact ? "field compact" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}
