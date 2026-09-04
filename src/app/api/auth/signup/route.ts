import { NextRequest, NextResponse } from "next/server";
import { isRateLimited } from "../rateLimit";
import { serverConfig } from "@/lib/serverConfig";

// Server-side so the client id is attached from the runtime env, not the browser.
const API_URL = serverConfig.apiUrl;
const API_PATH = serverConfig.apiPath;
const CLIENT_ID = serverConfig.clientId;

export async function POST(request: NextRequest) {
  if (!API_URL || !CLIENT_ID) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (
    typeof body.email !== "string" ||
    !body.email ||
    typeof body.password !== "string" ||
    !body.password ||
    typeof body.name !== "string" ||
    !body.name
  ) {
    return NextResponse.json(
      { error: "Email, password and name are required" },
      { status: 400 }
    );
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${API_PATH}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        name: body.name,
        client_id: CLIENT_ID,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Upstream service unavailable" },
      { status: 502 }
    );
  }

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
