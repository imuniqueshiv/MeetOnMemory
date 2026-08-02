import axios from "axios";

const api = axios.create({
  baseURL: "/api/saved-filters",
  withCredentials: true,
});

export const getSavedFilters = () => api.get("/");
export const createSavedFilter = (data) => api.post("/", data);
export const updateSavedFilter = (id, data) => api.patch(`/${id}`, data);
export const deleteSavedFilter = (id) => api.delete(`/${id}`);
export const togglePinSavedFilter = (id) => api.patch(`/${id}/pin`);

const savedFilterApi = {
  getSavedFilters,
  createSavedFilter,
  updateSavedFilter,
  deleteSavedFilter,
  togglePinSavedFilter,
};

export default savedFilterApi;
