import axios from "axios";

export const axiosInstance = axios.create({
    baseURL: "http://localhost:3001/api/",
    headers: {
        "Content-Type": "application/json",
    },
});

axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    config.headers.Authorization = `Bearer ${token}`;
    return config;
}
);

axiosInstance.interceptors.response.use( (res) => res, (error) => {
        if (error.response.status === 401) {
            console.error('Unauthorized request:', error.response.data);
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);