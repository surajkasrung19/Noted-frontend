import axios from "axios";

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const isBrowser = typeof window !== "undefined";
const isLocalHost =
  isBrowser && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

function apiBaseUrl() {
  if (rawApiBaseUrl) return rawApiBaseUrl.replace(/\/$/, "");
  if (isLocalHost) return "http://localhost:5000/api";
  return "/api";
}

const apiUrl = apiBaseUrl();

const api = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ERR_NETWORK") {
      error.message = isLocalHost
        ? `Cannot connect to Noted API at ${api.defaults.baseURL}. Start the backend and keep MongoDB connected.`
        : `Cannot connect to Noted API at ${api.defaults.baseURL}. Set VITE_API_BASE_URL to your deployed backend URL ending in /api, then redeploy.`;
    }

    if (error.code === "ECONNABORTED") {
      error.message = `Noted API timed out at ${api.defaults.baseURL}.`;
    }

    return Promise.reject(error);
  }
);

export async function getHealth() {
  const { data } = await api.get("/health");
  return data;
}

export async function signup(payload) {
  const { data } = await api.post("/auth/signup", payload);
  return data;
}

export async function login(payload) {
  const { data } = await api.post("/auth/login", payload);
  return data;
}

export async function verifyEmail(payload) {
  const { data } = await api.post("/auth/verify-email", payload);
  return data;
}

export async function resendVerification(payload) {
  const { data } = await api.post("/auth/resend-verification", payload);
  return data;
}

export async function forgotPassword(payload) {
  const { data } = await api.post("/auth/forgot-password", payload);
  return data;
}

export async function resetPassword(payload) {
  const { data } = await api.post("/auth/reset-password", payload);
  return data;
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function getNotes(params = {}) {
  const { data } = await api.get("/notes", { params });
  return data;
}

export async function getNote(id) {
  const { data } = await api.get(`/notes/${id}`);
  return data;
}

export async function createNote(payload) {
  const { data } = await api.post("/notes", payload);
  return data;
}

export async function updateNote(id, payload, config = {}) {
  const { data } = await api.put(`/notes/${id}`, payload, config);
  return data;
}

export async function patchNote(id, action, payload) {
  const { data } = await api.patch(`/notes/${id}/${action}`, payload);
  return data;
}

export async function trashNote(id) {
  const { data } = await api.delete(`/notes/${id}`);
  return data;
}

export async function deleteNoteForever(id) {
  await api.delete(`/notes/${id}/permanent`);
}

export async function restoreNote(id) {
  const { data } = await api.patch(`/notes/${id}/restore`);
  return data;
}

export async function getFolders(tree = false) {
  const { data } = await api.get("/folders", { params: { tree } });
  return data;
}

export async function createFolder(payload) {
  const { data } = await api.post("/folders", payload);
  return data;
}

export async function updateFolder(id, payload) {
  const { data } = await api.put(`/folders/${id}`, payload);
  return data;
}

export async function deleteFolder(id) {
  await api.delete(`/folders/${id}`);
}

export async function getTags() {
  const { data } = await api.get("/tags");
  return data;
}

export async function uploadImage(file) {
  const form = new FormData();
  form.append("image", file);
  const { data } = await api.post("/uploads/image", form, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data;
}

export async function createReminder(payload) {
  const { data } = await api.post("/reminders", payload);
  return data;
}

export async function getReminders() {
  const { data } = await api.get("/reminders");
  return data;
}

export async function markReminderSent(id) {
  const { data } = await api.patch(`/reminders/${id}/sent`);
  return data;
}

export async function getVersions(noteId) {
  const { data } = await api.get(`/notes/${noteId}/versions`);
  return data;
}

export async function restoreVersion(noteId, versionId) {
  const { data } = await api.post(`/notes/${noteId}/versions/${versionId}/restore`);
  return data;
}

export default api;
