import type { Options } from "k6/options";
import http from "k6/http";
import { check, sleep } from "k6";

interface LoginResponse {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: string;
  image: string;
  accessToken: string;
  refreshToken: string;
}

interface AuthData {
  token: string;
}

export const options: Options = {
  vus: 2,
  duration: "5s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export function setup(): AuthData {
  const URL = "https://dummyjson.com/user/login";
  const payload = JSON.stringify({
    username: "emilys",
    password: "emilyspass",
    expiresInMins: 30,
  });

  const res = http.post(URL, payload, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  const isLoginSuccessful = check(res, {
    "Auth status is 200": (r) => r.status === 200,
    "Auth body containes accessToken": (r) => typeof r.body === "string" && r.body.includes("accessToken"),
  });

  if (!isLoginSuccessful || !res.body) {
    throw new Error("Authentication failed! Aborting load test execution.");
  }

  const data: LoginResponse = JSON.parse(res.body as string);
  return { token: data.accessToken };
}

export default function(data: AuthData) {
  const protectedURL = "https://dummyjson.com/user/me";

  const res = http.get(protectedURL, {
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${data.token}`,
    },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "body has user data": (r) => {
      if (!r.body || typeof r.body !== "string") {
        return false;
      }
      try {
        const jsonData = JSON.parse(r.body);
        return !!jsonData.id && !!jsonData.username;
      } catch {
        return false;
      }
    },
  });
  sleep(1);
}
