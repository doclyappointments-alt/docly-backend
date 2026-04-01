import axios from "axios";
import { BASE_URL } from "./env.js";

export const http = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  validateStatus: () => true,
});

export function authHeader(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}
export const httpClient = http;
