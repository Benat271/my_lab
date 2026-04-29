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
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadSeniors(query = "") {
    if (!token) {
      setSeniors([]);
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

  useEffect(() => {
    if (token) {
      loadSeniors(search);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      loadSeniors(search);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [search, token]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
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
    setSeniors([]);
    setSearch("");
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

  return (
    <main className="layout">
      <section className="hero">
        <p className="eyebrow">SECOT Bizkaia</p>
        <h1>Gestion de Seniors</h1>
        <p className="lede">
          MVP del calendario con React en frontend, FastAPI en backend y persistencia en Supabase.
        </p>
      </section>

      <section className="panel form-panel">
        <div className="panel-header">
          <div>
            <p className="section-kicker">{isAuthed ? "Sesion" : "Acceso"}</p>
            <h2>{isAuthed ? `Conectado como ${username || "usuario"}` : "Iniciar sesion"}</h2>
          </div>
          {isAuthed ? (
            <button className="ghost-button" type="button" onClick={handleLogout}>
              Cerrar sesion
            </button>
          ) : null}
        </div>

        {isAuthed ? (
          <>
            <div className="panel-header" style={{ marginTop: 18 }}>
              <div>
                <p className="section-kicker">Formulario</p>
                <h2>{editingId === null ? "Nuevo senior" : `Editar senior #${form.senior_codigo}`}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={resetForm}>
                Limpiar
              </button>
            </div>

            <form className="senior-form" onSubmit={handleSubmit}>
              <Field label="Codigo funcional">
                <input
                  type="number"
                  min="1"
                  required
                  value={form.senior_codigo}
                  onChange={(event) => updateField("senior_codigo", event.target.value)}
                />
              </Field>

              <Field label="Nombre">
                <input required value={form.nombre} onChange={(event) => updateField("nombre", event.target.value)} />
              </Field>

              <Field label="Primer apellido">
                <input
                  required
                  value={form.apellido1}
                  onChange={(event) => updateField("apellido1", event.target.value)}
                />
              </Field>

              <Field label="Segundo apellido">
                <input value={form.apellido2} onChange={(event) => updateField("apellido2", event.target.value)} />
              </Field>

              <Field label="Email personal">
                <input
                  type="email"
                  value={form.email_personal}
                  onChange={(event) => updateField("email_personal", event.target.value)}
                />
              </Field>

              <Field label="Email SECOT">
                <input
                  type="email"
                  value={form.email_secot}
                  onChange={(event) => updateField("email_secot", event.target.value)}
                />
              </Field>

              <Field label="Movil">
                <input value={form.movil} onChange={(event) => updateField("movil", event.target.value)} />
              </Field>

              <Field label="Fecha de alta">
                <input
                  type="date"
                  value={form.fecha_alta}
                  onChange={(event) => updateField("fecha_alta", event.target.value)}
                />
              </Field>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(event) => updateField("activo", event.target.checked)}
                />
                <span>Activo</span>
              </label>

              <div className="form-actions">
                <button className="primary-button" type="submit">
                  {editingId === null ? "Crear senior" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <form className="senior-form" onSubmit={handleLogin}>
            <Field label="Usuario">
              <input name="username" autoComplete="username" required defaultValue={username} />
            </Field>
            <Field label="Contrasena">
              <input name="password" type="password" autoComplete="current-password" required />
            </Field>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                Entrar
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="panel list-panel">
        <div className="panel-header">
          <div>
            <p className="section-kicker">Listado</p>
            <h2>Seniors registrados</h2>
          </div>
          <Field label="Buscar" compact>
            <input
              type="search"
              placeholder="Codigo, nombre o email SECOT"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={!isAuthed}
            />
          </Field>
        </div>

        {status && <p className={`status-banner ${status.kind}`}>{status.message}</p>}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Nombre completo</th>
                <th>Email SECOT</th>
                <th>Movil</th>
                <th>Alta</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!isAuthed ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    Inicia sesion para ver el listado.
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    Cargando seniors...
                  </td>
                </tr>
              ) : seniors.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No hay seniors para mostrar.
                  </td>
                </tr>
              ) : (
                seniors.map((senior) => {
                  const fullName = [senior.nombre, senior.apellido1, senior.apellido2].filter(Boolean).join(" ");
                  return (
                    <tr key={senior.id}>
                      <td>{senior.senior_codigo}</td>
                      <td>{fullName}</td>
                      <td>{senior.email_secot ?? "-"}</td>
                      <td>{senior.movil ?? "-"}</td>
                      <td>{senior.fecha_alta ?? "-"}</td>
                      <td>
                        <span className={`tag ${senior.activo ? "active" : "inactive"}`}>
                          {senior.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <button className="action-button edit" type="button" onClick={() => startEdit(senior)}>
                            Editar
                          </button>
                          <button className="action-button delete" type="button" onClick={() => removeSenior(senior)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
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
