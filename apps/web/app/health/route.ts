import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "oclushion-web",
    status: "ok",
  });
}
