import type { Options } from "k6/options";
import http from "k6/http";
import { check, sleep } from "k6";

interface Product {
  id: number;
  title: string;
  price: number;
  category: string;
}

interface DummyJsonResponse {
  products: Product[];
  total: number;
  skip: number;
  limit: number;
}

export const options: Options = {
  vus: 2,
  duration: "10s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function() {
  const URL = "https://dummyjson.com/products";

  const res = http.get(URL, {
    headers: {
      "Accept": "application/json",
    },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "body has products": (r) => {
      if (!r.body || typeof r.body !== "string") {
        return false;
      }

      try {
        const data: DummyJsonResponse = JSON.parse(r.body);
        return Array.isArray(data.products) && data.products.length > 0;
      } catch {
        return false;
      }
    },
  });
  sleep(1);
}
