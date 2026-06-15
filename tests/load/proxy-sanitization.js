import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 10 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    errors: ["rate<0.05"],
    http_req_duration: ["p(95)<500"],
  },
};

const BASE_URL = __ENV.BASE_URL ?? "http://127.0.0.1:8082";

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 200ms": (r) => r.timings.duration < 200,
  });
  errorRate.add(!ok);

  const loginRes = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({ email: "loadtest@oclushion.local", password: "LoadTestPass1!" }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(loginRes, {
    "login returns 401 for unknown user": (r) => r.status === 401,
  });

  sleep(1);
}
